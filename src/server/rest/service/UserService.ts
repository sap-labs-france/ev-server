import { Action, Entity } from '../../../types/Authorization';
import { HTTPAuthError, HTTPError } from '../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';
import { OCPITokenType, OCPITokenWhitelist } from '../../../types/ocpi/OCPIToken';

import Address from '../../../types/Address';
import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import Authorizations from '../../../authorization/Authorizations';
import BillingFactory from '../../../integration/billing/BillingFactory';
import ConnectionStorage from '../../../storage/mongodb/ConnectionStorage';
import Constants from '../../../utils/Constants';
import EmspOCPIClient from '../../../client/ocpi/EmspOCPIClient';
import Logging from '../../../utils/Logging';
import NotificationHandler from '../../../notification/NotificationHandler';
import OCPIClientFactory from '../../../client/ocpi/OCPIClientFactory';
import { OCPIRole } from '../../../types/ocpi/OCPIRole';
import { ServerAction } from '../../../types/Server';
import SettingStorage from '../../../storage/mongodb/SettingStorage';
import SiteStorage from '../../../storage/mongodb/SiteStorage';
import TenantComponents from '../../../types/TenantComponents';
import TenantStorage from '../../../storage/mongodb/TenantStorage';
import TransactionStorage from '../../../storage/mongodb/TransactionStorage';
import { UserInErrorType } from '../../../types/InError';
import UserNotifications from '../../../types/UserNotifications';
import UserSecurity from './security/UserSecurity';
import { UserStatus } from '../../../types/User';
import UserStorage from '../../../storage/mongodb/UserStorage';
import Utils from '../../../utils/Utils';
import UtilsService from './UtilsService';
import fs from 'fs';

const MODULE_NAME = 'UserService';

export default class UserService {

  public static async handleAssignSitesToUser(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.UPDATE, Entity.SITES, 'SiteService', 'handleAssignSitesToUser');
    // Filter
    const filteredRequest = UserSecurity.filterAssignSitesToUserRequest(req.body);
    if (!filteredRequest.userID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'User\'s ID must be provided',
        module: MODULE_NAME, method: 'handleAssignSitesToUser',
        user: req.user,
        action: action
      });
    }
    if (!filteredRequest.siteIDs || (filteredRequest.siteIDs && filteredRequest.siteIDs.length <= 0)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Site\'s IDs must be provided',
        module: MODULE_NAME, method: 'handleAssignSitesToUser',
        user: req.user,
        action: action
      });
    }
    // Check auth
    if (!Authorizations.canReadUser(req.user, filteredRequest.userID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE, entity: Entity.USER,
        module: MODULE_NAME, method: 'handleAssignSitesToUser',
        value: filteredRequest.userID
      });
    }
    // Get the User
    const user = await UserStorage.getUser(req.user.tenantID, filteredRequest.userID);
    UtilsService.assertObjectExists(action, user, `User '${filteredRequest.userID}' does not exist`,
      MODULE_NAME, 'handleAssignSitesToUser', req.user);
    // Get Sites
    for (const siteID of filteredRequest.siteIDs) {
      const site = await SiteStorage.getSite(req.user.tenantID, siteID);
      UtilsService.assertObjectExists(action, site, `Site with ID '${siteID}' does not exist`,
        MODULE_NAME, 'handleUpdateSiteUserOwner', req.user);
      // Check auth
      if (!Authorizations.canUpdateSite(req.user, siteID)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: req.user,
          action: Action.UPDATE, entity: Entity.SITE,
          module: MODULE_NAME, method: 'handleAssignSitesToUser',
          value: siteID
        });
      }
    }
    // Save
    if (action.toLowerCase().includes('add')) {
      await UserStorage.addSitesToUser(req.user.tenantID, filteredRequest.userID, filteredRequest.siteIDs);
    } else {
      await UserStorage.removeSitesFromUser(req.user.tenantID, filteredRequest.userID, filteredRequest.siteIDs);
    }
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleAssignSitesToUser',
      message: 'User\'s Sites have been assigned successfully', action: action
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleDeleteUser(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const id = UserSecurity.filterUserByIDRequest(req.query);
    // Check Mandatory fields
    if (!id) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'User\'s ID must be provided',
        module: MODULE_NAME, method: 'handleDeleteUser',
        user: req.user,
        action: action
      });
    }
    // Check auth
    if (!Authorizations.canDeleteUser(req.user, id)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.DELETE, entity: Entity.USER,
        module: MODULE_NAME, method: 'handleDeleteUser',
        value: id
      });
    }
    // Same user
    if (id === req.user.id) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'User cannot delete himself',
        module: MODULE_NAME, method: 'handleDeleteUser',
        user: req.user,
        action: action
      });
    }
    // Check user
    const user = await UserStorage.getUser(req.user.tenantID, id);
    UtilsService.assertObjectExists(action, user, `User '${id}' does not exist`,
      MODULE_NAME, 'handleDeleteUser', req.user);
    // Deleted
    if (user.deleted) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        action: action,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: `User with ID '${id}' is already deleted`,
        module: MODULE_NAME, method: 'handleDeleteUser',
        user: req.user
      });
    }
    // Check Billing
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.BILLING)) {
      try {
        const billingImpl = await BillingFactory.getBillingImpl(req.user.tenantID);
        if (!billingImpl) {
          throw new AppError({
            source: Constants.CENTRAL_SERVER,
            action: action,
            errorCode: HTTPError.GENERAL_ERROR,
            message: 'Billing service is not configured',
            module: MODULE_NAME, method: 'handleGetBillingConnection',
            user: req.user, actionOnUser: user
          });
        }
        if (user.billingData) {
          const userCanBeDeleted = await billingImpl.checkIfUserCanBeDeleted(user);
          if (!userCanBeDeleted) {
            throw new AppError({
              source: Constants.CENTRAL_SERVER,
              action: action,
              errorCode: HTTPError.BILLING_DELETE_ERROR,
              message: 'User cannot be deleted due to billing constraints',
              module: MODULE_NAME, method: 'handleGetBillingConnection',
              user: req.user, actionOnUser: user
            });
          }
        }
      } catch (error) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          action: action,
          errorCode: HTTPError.BILLING_DELETE_ERROR,
          message: 'Error occurred in billing system',
          module: MODULE_NAME, method: 'handleDeleteUser',
          user: req.user, actionOnUser: user,
          detailedMessages: { error: error.message, stack: error.stack }
        });
      }
    }
    const userTransactions = await TransactionStorage.getTransactions(req.user.tenantID, { userIDs: [id] }, Constants.DB_PARAMS_COUNT_ONLY);
    // Delete user
    if (userTransactions.count > 0) {
      // Logically
      user.deleted = true;
      // Anonymize user
      user.name = Constants.ANONYMIZED_VALUE;
      user.firstName = '';
      user.email = user.id;
      user.costCenter = '';
      user.iNumber = '';
      user.mobile = '';
      user.phone = '';
      user.address = {} as Address;
      await UserStorage.saveUser(req.user.tenantID, user);
      await UserStorage.saveUserPassword(req.user.tenantID, user.id,
        {
          password: '',
          passwordWrongNbrTrials: 0,
          passwordResetHash: '',
          passwordBlockedUntil: null
        });
      await UserStorage.saveUserAdminData(req.user.tenantID, user.id,
        { plateID: '', notificationsActive: false, notifications: null });
      await UserStorage.saveUserMobileToken(req.user.tenantID, user.id,
        { mobileToken: null, mobileOs: null, mobileLastChangedOn: null });
      await UserStorage.saveUserEULA(req.user.tenantID, user.id,
        { eulaAcceptedHash: null, eulaAcceptedVersion: null, eulaAcceptedOn: null });
      await UserStorage.saveUserStatus(req.user.tenantID, user.id, UserStatus.INACTIVE);
      await UserStorage.saveUserAccountVerification(req.user.tenantID, user.id,
        { verificationToken: null, verifiedAt: null });

      for (const tag of user.tags) {
        if (tag.transactionsCount > 0) {
          tag.active = false;
          tag.lastChangedOn = new Date();
          tag.lastChangedBy = { id: req.user.id };
          await UserStorage.saveUserTag(req.user.tenantID, user.id, tag);
        } else {
          await UserStorage.deleteUserTag(req.user.tenantID, user.id, tag);
        }
      }
    } else {
      // Physically
      await UserStorage.deleteUser(req.user.tenantID, user.id);
    }

    // Delete billing user
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.BILLING)) {
      const billingImpl = await BillingFactory.getBillingImpl(req.user.tenantID);
      try {
        await billingImpl.deleteUser(user);
      } catch (error) {
        Logging.logError({
          tenantID: req.user.tenantID,
          action: action,
          module: MODULE_NAME, method: 'handleDeleteUser',
          message: `User '${user.firstName} ${user.name}' cannot be deleted in billing system`,
          user: req.user, actionOnUser: user,
          detailedMessages: { error: error.message, stack: error.stack }
        });
      }
    }
    // Synchronize badges with IOP
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.OCPI)) {
      const tenant = await TenantStorage.getTenant(req.user.tenantID);
      try {
        const ocpiClient: EmspOCPIClient = await OCPIClientFactory.getAvailableOcpiClient(tenant, OCPIRole.EMSP) as EmspOCPIClient;
        if (ocpiClient) {
          // Invalidate no more used tags
          for (const tag of user.tags) {
            if (tag.issuer) {
              await ocpiClient.pushToken({
                uid: tag.id,
                type: OCPITokenType.RFID,
                'auth_id': user.id,
                'visual_number': user.id,
                issuer: tenant.name,
                valid: false,
                whitelist: OCPITokenWhitelist.ALLOWED_OFFLINE,
                'last_updated': new Date()
              });
            }
          }
        }
      } catch (error) {
        Logging.logError({
          tenantID: req.user.tenantID,
          module: MODULE_NAME, method: 'handleUpdateUser',
          action: action,
          user: req.user, actionOnUser: user,
          message: `Unable to synchronize tokens of user ${user.id} with IOP`,
          detailedMessages: { error: error.message, stack: error.stack }
        });
      }
    }
    // Delete Connections
    await ConnectionStorage.deleteConnectionByUserId(req.user.tenantID, user.id);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, actionOnUser: user,
      module: MODULE_NAME, method: 'handleDeleteUser',
      message: `User with ID '${user.id}' has been deleted successfully`,
      action: action
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleUpdateUser(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    let statusHasChanged = false;
    // Filter
    const filteredRequest = UserSecurity.filterUserUpdateRequest(req.body, req.user);
    // Check Mandatory fields
    if (!filteredRequest.id) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'User\'s ID must be provided',
        module: MODULE_NAME, method: 'handleUpdateUser',
        user: req.user,
        action: action
      });
    }
    // Check auth
    if (!Authorizations.canUpdateUser(req.user, filteredRequest.id)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE, entity: Entity.USER,
        module: MODULE_NAME, method: 'handleUpdateUser',
        value: filteredRequest.id
      });
    }
    // Get User
    let user = await UserStorage.getUser(req.user.tenantID, filteredRequest.id);
    UtilsService.assertObjectExists(action, user, `User '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleUpdateUser', req.user);
    // Deleted?
    if (user.deleted) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: `User with ID '${filteredRequest.id}' is logically deleted`,
        module: MODULE_NAME, method: 'handleUpdateUser',
        user: req.user,
        action: action
      });
    }
    // Check email
    const userWithEmail = await UserStorage.getUserByEmail(req.user.tenantID, filteredRequest.email);
    // Check if EMail is already taken
    if (userWithEmail && user.id !== userWithEmail.id) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.USER_EMAIL_ALREADY_EXIST_ERROR,
        message: `Email '${filteredRequest.email}' already exists`,
        module: MODULE_NAME, method: 'handleUpdateUser',
        user: req.user,
        action: action
      });
    }
    // Check if Status has been changed
    if (filteredRequest.status &&
      filteredRequest.status !== user.status) {
      statusHasChanged = true;
    }
    // Update timestamp
    const lastChangedBy = { id: req.user.id };
    const lastChangedOn = new Date();
    const previousTags = user.tags;
    // Clean up request
    delete filteredRequest.passwords;
    // Check User validity
    Utils.checkIfUserValid(filteredRequest, user, req);
    // Check if Tag IDs are valid
    await Utils.checkIfUserTagsAreValid(user, filteredRequest.tags, req);
    // Update user
    user = { ...user, ...filteredRequest, tags: [] };
    // Update
    user.lastChangedBy = lastChangedBy;
    user.lastChangedOn = lastChangedOn;
    // Update User (override TagIDs because it's not of the same type as in filteredRequest)
    await UserStorage.saveUser(req.user.tenantID, user, true);
    // Check Billing
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.BILLING)) {
      const billingImpl = await BillingFactory.getBillingImpl(req.user.tenantID);
      if (billingImpl) {
        try {
          const billingUser = await billingImpl.updateUser(user);
          await UserStorage.saveUserBillingData(req.user.tenantID, user.id, billingUser.billingData);
        } catch (error) {
          Logging.logError({
            tenantID: req.user.tenantID,
            action: action,
            module: MODULE_NAME, method: 'handleUpdateUser',
            user: req.user, actionOnUser: user,
            message: 'User cannot be updated in billing system',
            detailedMessages: { error: error.message, stack: error.stack }
          });
        }
      }
    }
    // Save User password
    if (filteredRequest.password) {
      // Update the password
      const newPasswordHashed = await Utils.hashPasswordBcrypt(filteredRequest.password);
      await UserStorage.saveUserPassword(req.user.tenantID, filteredRequest.id,
        {
          password: newPasswordHashed,
          passwordWrongNbrTrials: 0,
          passwordResetHash: null,
          passwordBlockedUntil: null
        });
    }
    // Save Admin info
    if (Authorizations.isAdmin(req.user)) {
      // Save Tags
      for (const previousTag of previousTags) {
        const foundTag = filteredRequest.tags.find((tag) => tag.id === previousTag.id);
        if (!foundTag) {
          // Tag not found in the current tag list, will be deleted or deactivated.
          if (previousTag.transactionsCount > 0) {
            if (previousTag.active) {
              previousTag.active = false;
              previousTag.lastChangedOn = lastChangedOn;
              previousTag.lastChangedBy = lastChangedBy;
              await UserStorage.saveUserTag(req.user.tenantID, filteredRequest.id, previousTag);
            }
          } else {
            await UserStorage.deleteUserTag(req.user.tenantID, filteredRequest.id, previousTag);
          }
        }
      }
      for (const tag of filteredRequest.tags) {
        tag.lastChangedOn = lastChangedOn;
        tag.lastChangedBy = lastChangedBy;
        await UserStorage.saveUserTag(req.user.tenantID, filteredRequest.id, tag);
      }
      // Synchronize badges with IOP
      if (Utils.isComponentActiveFromToken(req.user, TenantComponents.OCPI)) {
        const tenant = await TenantStorage.getTenant(req.user.tenantID);
        try {
          const ocpiClient: EmspOCPIClient = await OCPIClientFactory.getAvailableOcpiClient(tenant, OCPIRole.EMSP) as EmspOCPIClient;
          if (ocpiClient) {
            // Invalidate no more used tags
            for (const previousTag of previousTags) {
              const foundTag = filteredRequest.tags.find((tag) => tag.id === previousTag.id);
              if (previousTag.issuer && (!foundTag || !foundTag.issuer)) {
                await ocpiClient.pushToken({
                  uid: previousTag.id,
                  type: OCPITokenType.RFID,
                  'auth_id': filteredRequest.id,
                  'visual_number': filteredRequest.id,
                  issuer: tenant.name,
                  valid: false,
                  whitelist: OCPITokenWhitelist.ALLOWED_OFFLINE,
                  'last_updated': new Date()
                });
              }
            }
            // Push new valid tags
            for (const currentTag of filteredRequest.tags) {
              const foundTag = previousTags.find((tag) => tag.id === currentTag.id);
              if (currentTag.issuer && (!foundTag || !foundTag.issuer || foundTag.active !== currentTag.active)) {
                await ocpiClient.pushToken({
                  uid: currentTag.id,
                  type: OCPITokenType.RFID,
                  'auth_id': filteredRequest.id,
                  'visual_number': filteredRequest.id,
                  issuer: tenant.name,
                  valid: currentTag.active,
                  whitelist: OCPITokenWhitelist.ALLOWED_OFFLINE,
                  'last_updated': new Date()
                });
              }
            }
          }
        } catch (error) {
          Logging.logError({
            tenantID: req.user.tenantID,
            action: action,
            module: MODULE_NAME, method: 'handleUpdateUser',
            message: `Unable to synchronize tokens of user ${filteredRequest.id} with IOP`,
            detailedMessages: { error: error.message, stack: error.stack }
          });
        }
      }
    }
    if (Authorizations.isAdmin(req.user) || Authorizations.isSuperAdmin(req.user)) {
      // Save User Status
      if (filteredRequest.status) {
        await UserStorage.saveUserStatus(req.user.tenantID, user.id, filteredRequest.status);
      }
      // Save User Role
      if (filteredRequest.role) {
        await UserStorage.saveUserRole(req.user.tenantID, user.id, filteredRequest.role);
      }
      // Save Admin Data
      if (filteredRequest.plateID || Utils.objectHasProperty(filteredRequest, 'notificationsActive')) {
        const adminData: { plateID?: string; notificationsActive?: boolean; notifications?: UserNotifications } = {};
        if (filteredRequest.plateID) {
          adminData.plateID = filteredRequest.plateID;
        }
        if (Utils.objectHasProperty(filteredRequest, 'notificationsActive')) {
          adminData.notificationsActive = filteredRequest.notificationsActive;
          if (filteredRequest.notifications) {
            adminData.notifications = filteredRequest.notifications;
          }
        }
        // Save User Admin data
        await UserStorage.saveUserAdminData(req.user.tenantID, user.id, adminData);
      }
    }
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, actionOnUser: user,
      module: MODULE_NAME, method: 'handleUpdateUser',
      message: 'User has been updated successfully',
      action: action
    });
    // Notify
    if (statusHasChanged && req.user.tenantID !== Constants.DEFAULT_TENANT) {
      // Send notification (Async)
      NotificationHandler.sendUserAccountStatusChanged(
        req.user.tenantID,
        Utils.generateGUID(),
        user,
        {
          'user': user,
          'evseDashboardURL': Utils.buildEvseURL((await TenantStorage.getTenant(req.user.tenantID)).subdomain)
        }
      ).catch(() => {});
    }
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleUpdateUserMobileToken(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = UserSecurity.filterUserUpdateMobileTokenRequest(req.body);
    // Check Mandatory fields
    if (!filteredRequest.mobileToken) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'User\'s mobile token ID must be provided',
        module: MODULE_NAME, method: 'handleUpdateUserMobileToken',
        user: req.user,
        action: action
      });
    }
    // Check auth
    if (!Authorizations.canUpdateUser(req.user, filteredRequest.id)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE, entity: Entity.USER,
        module: MODULE_NAME, method: 'handleUpdateUserMobileToken',
        value: filteredRequest.id
      });
    }
    // Get User
    const user = await UserStorage.getUser(req.user.tenantID, filteredRequest.id);
    UtilsService.assertObjectExists(action, user, `User '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleUpdateUserMobileToken', req.user);
    // Deleted?
    if (user.deleted) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: `User with ID '${filteredRequest.id}' is logically deleted`,
        module: MODULE_NAME, method: 'handleUpdateUserMobileToken',
        user: req.user,
        action: action
      });
    }
    // Update User (override TagIDs because it's not of the same type as in filteredRequest)
    await UserStorage.saveUserMobileToken(req.user.tenantID, user.id, {
      mobileToken: filteredRequest.mobileToken,
      mobileOs: filteredRequest.mobileOS,
      mobileLastChangedOn: new Date()
    });
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: user,
      module: MODULE_NAME, method: 'handleUpdateUserMobileToken',
      message: 'User\'s mobile token has been updated successfully',
      action: action,
      detailedMessages: {
        mobileToken: filteredRequest.mobileToken,
        mobileOS: filteredRequest.mobileOS
      }
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetUser(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const id = UserSecurity.filterUserByIDRequest(req.query);
    // User mandatory
    if (!id) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'User\'s ID must be provided',
        module: MODULE_NAME, method: 'handleGetUser',
        user: req.user,
        action: action
      });
    }
    // Check auth
    if (!Authorizations.canReadUser(req.user, id)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ, entity: Entity.USER,
        module: MODULE_NAME, method: 'handleGetUser',
        value: id
      });
    }
    // Get the user
    const user = await UserStorage.getUser(req.user.tenantID, id);
    UtilsService.assertObjectExists(action, user, `User '${id}' does not exist`,
      MODULE_NAME, 'handleGetUser', req.user);
    // Deleted?
    if (user.deleted) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: `User with ID '${id}' is logically deleted`,
        module: MODULE_NAME, method: 'handleGetUser',
        user: req.user,
        action: action
      });
    }
    // Ok
    res.json(
      // Filter
      UserSecurity.filterUserResponse(user, req.user)
    );
    next();
  }

  public static async handleGetUserImage(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = { ID: UserSecurity.filterUserByIDRequest(req.query) };
    // User mandatory
    if (!filteredRequest.ID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'User\'s ID must be provided',
        module: MODULE_NAME, method: 'handleGetUserImage',
        user: req.user,
        action: action
      });
    }
    // Check auth
    if (!Authorizations.canReadUser(req.user, filteredRequest.ID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ, entity: Entity.USER,
        module: MODULE_NAME, method: 'handleGetUserImage',
        value: filteredRequest.ID
      });
    }
    // Get the logged user
    const user = await UserStorage.getUser(req.user.tenantID, filteredRequest.ID);
    UtilsService.assertObjectExists(action, user, `User '${filteredRequest.ID}' does not exist`,
      MODULE_NAME, 'handleGetUserImage', req.user);
    // Deleted?
    if (user.deleted) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: `User with ID '${filteredRequest.ID}' is logically deleted`,
        module: MODULE_NAME, method: 'handleGetUserImage',
        user: req.user,
        action: action
      });
    }
    // Get the user image
    const userImage = await UserStorage.getUserImage(req.user.tenantID, filteredRequest.ID);
    // Ok
    res.json(userImage);
    next();
  }

  public static async handleGetSites(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.UPDATE, Entity.USER, MODULE_NAME, 'handleGetSites');
    // Filter
    const filteredRequest = UserSecurity.filterUserSitesRequest(req.query);
    // Check Mandatory fields
    if (!filteredRequest.UserID) {
      // Not Found!
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The User\'s ID must be provided',
        module: MODULE_NAME, method: 'handleGetSites',
        user: req.user,
        action: action
      });
    }
    const user = await UserStorage.getUser(req.user.tenantID, filteredRequest.UserID);
    UtilsService.assertObjectExists(action, user, `User with ID '${filteredRequest.UserID}' does not exist`,
      MODULE_NAME, 'handleGetSites', req.user);
    // Check auth
    if (!Authorizations.canUpdateUser(req.user, filteredRequest.UserID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE, entity: Entity.USER,
        module: MODULE_NAME, method: 'handleGetSites',
        value: user.id
      });
    }
    // Get users
    const userSites = await UserStorage.getUserSites(req.user.tenantID,
      {
        search: filteredRequest.Search,
        userID: filteredRequest.UserID
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.Sort,
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      ['site.id', 'site.name', 'site.address.city', 'site.address.country', 'siteAdmin', 'siteOwner', 'userID']
    );
    // Filter
    userSites.result = userSites.result.map((userSite) => ({
      userID: userSite.userID,
      siteAdmin: userSite.siteAdmin,
      siteOwner: userSite.siteOwner,
      site: userSite.site
    }));
    res.json(userSites);
    next();
  }

  public static async handleGetUsers(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!Authorizations.canListUsers(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST, entity: Entity.USERS,
        module: MODULE_NAME, method: 'handleGetUsers'
      });
    }
    // Filter
    const filteredRequest = UserSecurity.filterUsersRequest(req.query);
    // Check component
    if (filteredRequest.SiteID || filteredRequest.ExcludeSiteID) {
      UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
        Action.READ, Entity.USER, MODULE_NAME, 'handleGetUsers');
    }
    if (filteredRequest.NotAssignedToCarID) {
      UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR,
        Action.READ, Entity.USER, MODULE_NAME, 'handleGetUsers');
    }
    // Get users
    const users = await UserStorage.getUsers(req.user.tenantID,
      {
        search: filteredRequest.Search,
        issuer: filteredRequest.Issuer,
        siteIDs: (filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : null),
        roles: (filteredRequest.Role ? filteredRequest.Role.split('|') : null),
        statuses: (filteredRequest.Status ? filteredRequest.Status.split('|') : null),
        excludeSiteID: filteredRequest.ExcludeSiteID,
        excludeUserIDs: (filteredRequest.ExcludeUserIDs ? filteredRequest.ExcludeUserIDs.split('|') : null),
        includeCarUserIDs: (filteredRequest.IncludeCarUserIDs ? filteredRequest.IncludeCarUserIDs.split('|') : null),
        notAssignedToCarID: filteredRequest.NotAssignedToCarID
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.Sort,
        onlyRecordCount: filteredRequest.OnlyRecordCount
      }
    );
    // Filter
    UserSecurity.filterUsersResponse(users, req.user);
    // Ok
    res.json(users);
    next();
  }

  public static async handleGetUsersInError(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!Authorizations.canListUsers(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST, entity: Entity.USERS,
        module: MODULE_NAME, method: 'handleGetUsersInError'
      });
    }
    // Filter
    const filteredRequest = UserSecurity.filterUsersRequest(req.query);
    // Check component
    if (filteredRequest.SiteID || filteredRequest.ExcludeSiteID) {
      UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
        Action.READ, Entity.USER, MODULE_NAME, 'handleGetUsersInError');
    }
    // Get users
    const users = await UserStorage.getUsersInError(req.user.tenantID,
      {
        search: filteredRequest.Search,
        roles: (filteredRequest.Role ? filteredRequest.Role.split('|') : null),
        errorTypes: (filteredRequest.ErrorType ? filteredRequest.ErrorType.split('|') : Object.values(UserInErrorType))
      },
      {
        limit: filteredRequest.Limit,
        onlyRecordCount: filteredRequest.OnlyRecordCount,
        skip: filteredRequest.Skip,
        sort: filteredRequest.Sort
      }
    );
    // Filter
    UserSecurity.filterUsersResponse(users, req.user);
    // Limit to 100
    if (users.result.length > 100) {
      users.result.length = 100;
    }
    // Return
    res.json(users);
    next();
  }

  public static async handleCreateUser(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!Authorizations.canCreateUser(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.CREATE, entity: Entity.USER,
        module: MODULE_NAME, method: 'handleCreateUser'
      });
    }
    // Filter
    const filteredRequest = UserSecurity.filterUserCreateRequest(req.body, req.user);
    // Check Mandatory fields
    Utils.checkIfUserValid(filteredRequest, null, req);
    // Get the email
    const foundUser = await UserStorage.getUserByEmail(req.user.tenantID, filteredRequest.email);
    if (foundUser) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.USER_EMAIL_ALREADY_EXIST_ERROR,
        message: `Email '${filteredRequest.email}' already exists`,
        module: MODULE_NAME, method: 'handleCreateUser',
        user: req.user,
        action: action
      });
    }
    // Check if Tag IDs are valid
    await Utils.checkIfUserTagsAreValid(null, filteredRequest.tags, req);
    // Clean request
    delete filteredRequest.passwords;
    filteredRequest.issuer = true;
    // Set timestamp
    const createdBy = { id: req.user.id };
    const createdOn = new Date();
    // Create the User
    const newUserID = await UserStorage.saveUser(req.user.tenantID, filteredRequest, true);
    // Save password
    if (filteredRequest.password) {
      const newPasswordHashed = await Utils.hashPasswordBcrypt(filteredRequest.password);
      await UserStorage.saveUserPassword(req.user.tenantID, newUserID,
        {
          password: newPasswordHashed,
          passwordWrongNbrTrials: 0,
          passwordResetHash: null,
          passwordBlockedUntil: null
        });
    }
    // Save Admin Data
    if (Authorizations.isAdmin(req.user)) {
      // Save the Tag IDs
      for (const tag of filteredRequest.tags) {
        tag.lastChangedOn = createdOn;
        tag.lastChangedBy = createdBy;
        await UserStorage.saveUserTag(req.user.tenantID, newUserID, tag);
      }
      // Synchronize badges with IOP
      if (Utils.isComponentActiveFromToken(req.user, TenantComponents.OCPI)) {
        const tenant = await TenantStorage.getTenant(req.user.tenantID);
        try {
          const ocpiClient: EmspOCPIClient = await OCPIClientFactory.getAvailableOcpiClient(tenant, OCPIRole.EMSP) as EmspOCPIClient;
          if (ocpiClient) {
            for (const tag of filteredRequest.tags) {
              if (tag.issuer) {
                await ocpiClient.pushToken({
                  uid: tag.id,
                  type: OCPITokenType.RFID,
                  'auth_id': newUserID,
                  'visual_number': newUserID,
                  issuer: tenant.name,
                  valid: true,
                  whitelist: OCPITokenWhitelist.ALLOWED_OFFLINE,
                  'last_updated': new Date()
                });
              }
            }
          }
        } catch (error) {
          Logging.logError({
            tenantID: req.user.tenantID,
            action: action,
            module: MODULE_NAME, method: 'handleCreateUser',
            message: `Unable to synchronize tokens of user ${newUserID} with IOP`,
            detailedMessages: { error: error.message, stack: error.stack }
          });
        }
      }
      // For integration with billing
      const billingImpl = await BillingFactory.getBillingImpl(req.user.tenantID);
      if (billingImpl) {
        try {
          const user = await UserStorage.getUser(req.user.tenantID, newUserID);
          const billingUser = await billingImpl.createUser(user);
          await UserStorage.saveUserBillingData(req.user.tenantID, user.id, billingUser.billingData);
          Logging.logInfo({
            tenantID: req.user.tenantID,
            action: action,
            module: MODULE_NAME, method: 'handleCreateUser',
            user: newUserID,
            message: 'User successfully created in billing system',
          });
        } catch (error) {
          Logging.logError({
            tenantID: req.user.tenantID,
            module: MODULE_NAME, method: 'handleCreateUser',
            action: action,
            user: newUserID,
            message: 'User cannot be created in billing system',
            detailedMessages: { error: error.message, stack: error.stack }
          });
        }
      }
    }

    if (Authorizations.isAdmin(req.user) || Authorizations.isSuperAdmin(req.user)) {
      // Save User Status
      if (filteredRequest.status) {
        await UserStorage.saveUserStatus(req.user.tenantID, newUserID, filteredRequest.status);
      }
      // Save User Role
      if (filteredRequest.role) {
        await UserStorage.saveUserRole(req.user.tenantID, newUserID, filteredRequest.role);
      }
      // Save Admin Data
      if (filteredRequest.plateID || Utils.objectHasProperty(filteredRequest, 'notificationsActive')) {
        const adminData: { plateID?: string; notificationsActive?: boolean; notifications?: UserNotifications } = {};
        if (filteredRequest.plateID) {
          adminData.plateID = filteredRequest.plateID;
        }
        if (Utils.objectHasProperty(filteredRequest, 'notificationsActive')) {
          adminData.notificationsActive = filteredRequest.notificationsActive;
          if (filteredRequest.notifications) {
            adminData.notifications = filteredRequest.notifications;
          }
        }
        // Save User Admin data
        await UserStorage.saveUserAdminData(req.user.tenantID, newUserID, adminData);
      }
    }
    // Assign user to all sites with auto-assign flag set
    const sites = await SiteStorage.getSites(req.user.tenantID,
      { withAutoUserAssignment: true },
      Constants.DB_PARAMS_MAX_LIMIT
    );
    if (sites.count > 0) {
      const siteIDs = sites.result.map((site) => site.id);
      if (siteIDs && siteIDs.length > 0) {
        await UserStorage.addSitesToUser(req.user.tenantID, newUserID, siteIDs);
      }
    }
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, actionOnUser: req.user,
      module: MODULE_NAME, method: 'handleCreateUser',
      message: `User with ID '${newUserID}' has been created successfully`,
      action: action
    });
    // Ok
    res.json(Object.assign({ id: newUserID }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleGetUserInvoice(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const id = UserSecurity.filterUserByIDRequest(req.query);
    // User mandatory
    if (!id) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'User\'s ID must be provided',
        module: MODULE_NAME, method: 'handleGetUserInvoice',
        user: req.user,
        action: action
      });
    }
    // Check auth
    if (!Authorizations.canReadUser(req.user, id)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ, entity: Entity.USER,
        module: MODULE_NAME, method: 'handleGetUserInvoice',
        value: id
      });
    }
    // Get the user
    const user = await UserStorage.getUser(req.user.tenantID, id);
    UtilsService.assertObjectExists(action, user, `User '${id}' does not exist`,
      MODULE_NAME, 'handleGetUserInvoice', req.user);
    // Deleted?
    if (user.deleted) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        module: MODULE_NAME, method: 'handleGetUserInvoice',
        action: action,
        user: req.user,
        message: `User with ID '${id}' is logically deleted`,
      });
    }
    // Get the settings
    const pricingSetting = await SettingStorage.getPricingSettings(req.user.tenantID);
    if (!pricingSetting || !pricingSetting.convergentCharging) {
      Logging.logException(
        new Error('Convergent Charging setting is missing'),
        action, Constants.CENTRAL_SERVER, MODULE_NAME, 'handleGetUserInvoice', req.user.tenantID, req.user);
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        action: action,
        module: MODULE_NAME, method: 'handleGetUserInvoice',
        user: req.user,
        message: 'An issue occurred while creating the invoice',
      });
    }
    // Create services
    // FIXME: The calls to external pricing services need to be integrated inside the pricing integration interface definition, see https://github.com/LucasBrazi06/ev-dashboard/issues/1542
    // const ratingService = ConvergentChargingPricingIntegration.getRatingServiceClient(pricingSetting.convergentCharging.url, pricingSetting.convergentCharging.user, pricingSetting.convergentCharging.password);
    // const erpService = ConvergentChargingPricingIntegration.getERPServiceClient(pricingSetting.convergentCharging.url, pricingSetting.convergentCharging.user, pricingSetting.convergentCharging.password);
    let invoiceNumber;
    try {
      // pragma await ratingService.loadChargedItemsToInvoicing();
      // invoiceNumber = await erpService.createInvoice(req.user.tenantID, user);
    } catch (error) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'An issue occurred while creating the invoice',
        module: MODULE_NAME, method: 'handleGetUserInvoice',
        user: req.user,
        action: action,
        detailedMessages: { error: error.message, stack: error.stack }
      });
    }
    if (!invoiceNumber) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: 404,
        message: 'No invoices available',
        module: MODULE_NAME, method: 'handleGetUserInvoice',
        user: req.user,
        action: action
      });
    }
    let invoice;
    try {
      // pragma const invoiceHeader = await erpService.getInvoiceDocumentHeader(invoiceNumber);
      // invoice = await erpService.getInvoiceDocument(invoiceHeader, invoiceNumber);
      if (!invoice) {
        // Retry to get invoice
        // invoice = await erpService.getInvoiceDocument(invoiceHeader, invoiceNumber);
      }
      if (!invoice) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.PRICING_REQUEST_INVOICE_ERROR,
          message: `An error occurred while requesting invoice ${invoiceNumber}`,
          module: MODULE_NAME, method: 'handleGetUserInvoice',
          user: req.user,
          action: action
        });
      }
      const filename = 'invoice.pdf';
      fs.writeFile(filename, invoice, (err) => {
        if (err) {
          throw err;
        }
        res.download(filename, (err2) => {
          if (err2) {
            throw err2;
          }
          fs.unlink(filename, (err3) => {
            if (err3) {
              throw err3;
            }
          });
        });
      });
    } catch (error) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.PRICING_REQUEST_INVOICE_ERROR,
        message: `An error occurred while requesting invoice ${invoiceNumber}`,
        module: MODULE_NAME, method: 'handleGetUserInvoice',
        user: req.user,
        action: action,
        detailedMessages: { error: error.message, stack: error.stack }
      });
    }
  }
}
