import { Action, Entity } from '../../../../types/Authorization';
import { ActionsResponse, ImportStatus } from '../../../../types/GlobalType';
import { AsyncTaskType, AsyncTasks } from '../../../../types/AsyncTask';
import { Car, CarType } from '../../../../types/Car';
import { HTTPAuthError, HTTPError } from '../../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';
import User, { ImportedUser, UserRequiredImportProperties } from '../../../../types/User';

import AppAuthError from '../../../../exception/AppAuthError';
import AppError from '../../../../exception/AppError';
import AsyncTaskManager from '../../../../async-task/AsyncTaskManager';
import AuthorizationService from './AuthorizationService';
import Authorizations from '../../../../authorization/Authorizations';
import BillingFactory from '../../../../integration/billing/BillingFactory';
import Busboy from 'busboy';
import CSVError from 'csvtojson/v2/CSVError';
import CarStorage from '../../../../storage/mongodb/CarStorage';
import Constants from '../../../../utils/Constants';
import Cypher from '../../../../utils/Cypher';
import { DataResult } from '../../../../types/DataResult';
import EmspOCPIClient from '../../../../client/ocpi/EmspOCPIClient';
import JSONStream from 'JSONStream';
import LockingHelper from '../../../../locking/LockingHelper';
import LockingManager from '../../../../locking/LockingManager';
import Logging from '../../../../utils/Logging';
import NotificationHandler from '../../../../notification/NotificationHandler';
import OCPIClientFactory from '../../../../client/ocpi/OCPIClientFactory';
import { OCPIRole } from '../../../../types/ocpi/OCPIRole';
import { OCPITokenWhitelist } from '../../../../types/ocpi/OCPIToken';
import OCPIUtils from '../../../ocpi/OCPIUtils';
import { ServerAction } from '../../../../types/Server';
import SettingStorage from '../../../../storage/mongodb/SettingStorage';
import SiteStorage from '../../../../storage/mongodb/SiteStorage';
import { StatusCodes } from 'http-status-codes';
import TagStorage from '../../../../storage/mongodb/TagStorage';
import TenantComponents from '../../../../types/TenantComponents';
import TenantStorage from '../../../../storage/mongodb/TenantStorage';
import { UserInErrorType } from '../../../../types/InError';
import UserNotifications from '../../../../types/UserNotifications';
import UserSecurity from './security/UserSecurity';
import UserStorage from '../../../../storage/mongodb/UserStorage';
import UserToken from '../../../../types/UserToken';
import UserValidator from '../validator/UserValidator';
import Utils from '../../../../utils/Utils';
import UtilsService from './UtilsService';
import csvToJson from 'csvtojson/v2';
import fs from 'fs';
import moment from 'moment';

const MODULE_NAME = 'UserService';

export default class UserService {

  public static async handleGetUserDefaultTagCar(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!await Authorizations.canReadTag(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.READ, entity: Entity.TAG,
        module: MODULE_NAME, method: 'handleGetUserDefaultTagCar'
      });
    }
    // Check auth
    if (!await Authorizations.canReadCar(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.READ, entity: Entity.CAR,
        module: MODULE_NAME, method: 'handleGetUserDefaultTagCar'
      });
    }
    const userID = UserSecurity.filterDefaultTagCarRequestByUserID(req.query);
    UtilsService.assertIdIsProvided(action, userID, MODULE_NAME, 'handleGetUserDefaultTagCar', req.user);
    // Check auth
    if (!await Authorizations.canReadUser(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.READ, entity: Entity.USER,
        module: MODULE_NAME, method: 'handleGetUserDefaultTagCar'
      });
    }
    // Get authorization filters
    const authorizationUserFilters = await AuthorizationService.checkAndGetUserAuthorizationFilters(
      req.tenant, req.user, { ID: userID });
    // Check user
    const user = await UserStorage.getUser(
      req.user.tenantID, userID, authorizationUserFilters.filters);
    UtilsService.assertObjectExists(action, user, `User ID '${userID}' does not exist`, MODULE_NAME, 'handleDeleteUser', req.user);
    // Handle Tag
    // Get the default Tag
    let tag = await TagStorage.getDefaultUserTag(req.user.tenantID, userID, {
      issuer: true
    }, ['id', 'description', 'active']);
    if (!tag) {
      // Get the first active Tag
      tag = await TagStorage.getFirstActiveUserTag(req.user.tenantID, userID, {
        issuer: true
      }, ['id', 'description', 'active']);
    }
    // Handle Car
    let car: Car;
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.CAR)) {
      // Get the default Car
      car = await CarStorage.getDefaultUserCar(req.user.tenantID, userID, {
      }, [
        'id', 'type', 'licensePlate', 'carCatalog.vehicleMake', 'carCatalog.vehicleModel', 'carCatalog.vehicleModelVersion',
      ]);
      if (!car) {
        // Get the first available car
        car = await CarStorage.getFirstAvailableUserCar(req.user.tenantID, userID, [
          'id', 'type', 'licensePlate', 'carCatalog.vehicleMake', 'carCatalog.vehicleModel', 'carCatalog.vehicleModelVersion',
        ]);
      }
    }
    // Return
    res.json({ tag, car });
    next();
  }

  public static async handleAssignSitesToUser(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.UPDATE, Entity.SITES, 'SiteService', 'handleAssignSitesToUser');
    // Check auth
    if (action === ServerAction.ADD_SITES_TO_USER) {
      if (!await Authorizations.canAssignUsersSites(req.user)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.FORBIDDEN,
          user: req.user,
          action: Action.ASSIGN, entity: Entity.USERS_SITES,
          module: MODULE_NAME, method: 'handleAssignSitesToUser'
        });
      }
    } else if (!await Authorizations.canUnassignUsersSites(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.UNASSIGN, entity: Entity.USERS_SITES,
        module: MODULE_NAME, method: 'handleAssignSitesToUser'
      });
    }
    // Filter
    const filteredRequest = UserSecurity.filterAssignSitesToUserRequest(req.body);
    // Check
    UtilsService.assertIdIsProvided(action, filteredRequest.userID, MODULE_NAME, 'handleAssignSitesToUser', req.user);
    if (!filteredRequest.siteIDs || Utils.isEmptyArray(filteredRequest.siteIDs)) {
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
    if (!await Authorizations.canReadUser(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.UPDATE, entity: Entity.USER,
        module: MODULE_NAME, method: 'handleAssignSitesToUser',
        value: filteredRequest.userID
      });
    }
    // Get authorization filters
    const authorizationUserFilters = await AuthorizationService.checkAndGetUserAuthorizationFilters(
      req.tenant, req.user, { ID: filteredRequest.userID });
    // Get the User
    const user = await UserStorage.getUser(
      req.user.tenantID, filteredRequest.userID, authorizationUserFilters.filters);
    UtilsService.assertObjectExists(action, user, `User ID '${filteredRequest.userID}' does not exist`,
      MODULE_NAME, 'handleAssignSitesToUser', req.user);
    // OCPI User
    if (!user.issuer) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'User not issued by the organization',
        module: MODULE_NAME, method: 'handleAssignSitesToUser',
        user: req.user, actionOnUser: user,
        action: action
      });
    }
    // Check auth
    const authorizationUserSitesFilters = await AuthorizationService.checkAndAssignUserSitesAuthorizationFilters(
      req.tenant, action, req.user, filteredRequest);
    if (!authorizationUserSitesFilters.authorized) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: action === ServerAction.ADD_SITES_TO_USER ? Action.ASSIGN : Action.UNASSIGN,
        entity: Entity.USERS_SITES,
        module: MODULE_NAME, method: 'handleAssignSitesToUser'
      });
    }
    // Save
    if (action === ServerAction.ADD_SITES_TO_USER) {
      await UserStorage.addSitesToUser(req.user.tenantID, filteredRequest.userID, filteredRequest.siteIDs);
    } else {
      await UserStorage.removeSitesFromUser(req.user.tenantID, filteredRequest.userID, filteredRequest.siteIDs);
    }
    // Log
    await Logging.logSecurityInfo({
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
    const userID = UserSecurity.filterUserByIDRequest(req.query);
    UtilsService.assertIdIsProvided(action, userID, MODULE_NAME, 'handleDeleteUser', req.user);
    // Check auth
    if (!await Authorizations.canDeleteUser(req.user, userID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.DELETE, entity: Entity.USER,
        module: MODULE_NAME, method: 'handleDeleteUser',
        value: userID
      });
    }
    // Same user
    if (userID === req.user.id) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'User cannot delete himself',
        module: MODULE_NAME, method: 'handleDeleteUser',
        user: req.user,
        action: action
      });
    }
    // Get authorization filters
    const authorizationUserFilters = await AuthorizationService.checkAndGetUserAuthorizationFilters(
      req.tenant, req.user, { ID: userID });
    // Check user
    const user = await UserStorage.getUser(
      req.user.tenantID, userID, authorizationUserFilters.filters);
    UtilsService.assertObjectExists(action, user, `User ID '${userID}' does not exist`, MODULE_NAME, 'handleDeleteUser', req.user);
    // OCPI User
    if (!user.issuer) {
      // Delete all tags
      const numberOfDeletedTags = await TagStorage.deleteTagsByUser(req.user.tenantID, user.id);
      // Delete User
      await UserStorage.deleteUser(req.user.tenantID, user.id);
      // Log
      await Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, actionOnUser: user,
        module: MODULE_NAME, method: 'handleDeleteUser',
        message: `User with ID '${user.id}' has been deleted successfully along '${numberOfDeletedTags}' Tag(s)`,
        action: action
      });
      // Ok
      res.json(Constants.REST_RESPONSE_SUCCESS);
      next();
      return;
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
    // Synchronize badges with IOP
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.OCPI)) {
      try {
        const tenant = await TenantStorage.getTenant(req.user.tenantID);
        const ocpiClient: EmspOCPIClient = await OCPIClientFactory.getAvailableOcpiClient(tenant, OCPIRole.EMSP) as EmspOCPIClient;
        if (ocpiClient) {
          // Get tags
          const tags = (await TagStorage.getTags(req.user.tenantID,
            { userIDs: [user.id], withNbrTransactions: true }, Constants.DB_PARAMS_MAX_LIMIT)).result;
          for (const tag of tags) {
            await ocpiClient.pushToken({
              uid: tag.id,
              type: OCPIUtils.getOCPITokenTypeFromID(tag.id),
              auth_id: tag.id,
              visual_number: user.id,
              issuer: tenant.name,
              valid: false,
              whitelist: OCPITokenWhitelist.ALLOWED_OFFLINE,
              last_updated: new Date()
            });
          }
        }
      } catch (error) {
        await Logging.logError({
          tenantID: req.user.tenantID,
          module: MODULE_NAME,
          method: 'handleUpdateTag',
          action: action,
          message: `Unable to synchronize tokens of user ${user.id} with IOP`,
          detailedMessages: { error: error.message, stack: error.stack }
        });
      }
    }
    // Delete billing user
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.BILLING)) {
      const billingImpl = await BillingFactory.getBillingImpl(req.user.tenantID);
      try {
        await billingImpl.deleteUser(user);
      } catch (error) {
        await Logging.logError({
          tenantID: req.user.tenantID,
          action: action,
          module: MODULE_NAME, method: 'handleDeleteUser',
          message: `User '${user.firstName} ${user.name}' cannot be deleted in billing system`,
          user: req.user, actionOnUser: user,
          detailedMessages: { error: error.message, stack: error.stack }
        });
      }
    }
    // Delete cars
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.CAR)) {
      const carUsers = await CarStorage.getCarUsers(req.user.tenantID, { userIDs : [user.id] }, Constants.DB_PARAMS_MAX_LIMIT);
      if (carUsers.count > 0) {
        for (const carUser of carUsers.result) {
          // Owner ?
          if (carUser.owner) {
            // Private ?
            const car = await CarStorage.getCar(req.tenant.id, carUser.carID, { type: CarType.PRIVATE });
            if (car) {
              // Delete All Users Car
              await CarStorage.deleteCarUsersByCarID(req.user.tenantID, car.id);
              // Delete Car
              await CarStorage.deleteCar(req.user.tenantID, car.id);
            } else {
              // Delete User Car
              await CarStorage.deleteCarUser(req.user.tenantID, carUser.id);
            }
          } else {
            // Delete User Car
            await CarStorage.deleteCarUser(req.user.tenantID, carUser.id);
          }
        }
      }
    }
    // Delete User
    await UserStorage.deleteUser(req.user.tenantID, user.id);
    // Log
    await Logging.logSecurityInfo({
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

  public static async handleUpdateUser(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    let statusHasChanged = false;
    // Filter
    const filteredRequest = UserSecurity.filterUserUpdateRequest({ ...req.params, ...req.body }, req.user);
    UtilsService.assertIdIsProvided(action, filteredRequest.id, MODULE_NAME, 'handleUpdateUser', req.user);
    // Check auth
    if (!await Authorizations.canUpdateUser(req.user, filteredRequest.id)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.UPDATE, entity: Entity.USER,
        module: MODULE_NAME, method: 'handleUpdateUser',
        value: filteredRequest.id
      });
    }
    // Get authorization filters
    const authorizationUserFilters = await AuthorizationService.checkAndGetUserAuthorizationFilters(
      req.tenant, req.user, { ID: filteredRequest.id });
    // Get User
    let user = await UserStorage.getUser(
      req.user.tenantID, filteredRequest.id, authorizationUserFilters.filters);
    UtilsService.assertObjectExists(action, user, `User ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleUpdateUser', req.user);
    // OCPI User
    if (!user.issuer) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'User not issued by the organization',
        module: MODULE_NAME, method: 'handleUpdateUser',
        user: req.user, actionOnUser: user,
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
    // Clean up request
    delete filteredRequest['passwords'];
    // Check User validity
    UtilsService.checkIfUserValid(filteredRequest, user, req);
    // Update user
    user = {
      ...user,
      ...filteredRequest,
      name: filteredRequest.name.toUpperCase(),
      email: filteredRequest.email.toLowerCase(),
      lastChangedBy: lastChangedBy,
      lastChangedOn: lastChangedOn,
    };
    // Update User (override TagIDs because it's not of the same type as in filteredRequest)
    await UserStorage.saveUser(req.user.tenantID, user, true);
    // Check Billing
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.BILLING)) {
      const billingImpl = await BillingFactory.getBillingImpl(req.user.tenantID);
      if (billingImpl) {
        try {
          await billingImpl.synchronizeUser(user);
        } catch (error) {
          await Logging.logError({
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
      if (Utils.objectHasProperty(filteredRequest, 'plateID')) {
        const adminData: { plateID?: string; } = {};
        adminData.plateID = filteredRequest.plateID || null;
        await UserStorage.saveUserAdminData(req.user.tenantID, user.id, adminData);
      }
    }
    // Log
    await Logging.logSecurityInfo({
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
        Utils.generateUUID(),
        user,
        {
          'user': user,
          'evseDashboardURL': Utils.buildEvseURL((await TenantStorage.getTenant(req.user.tenantID)).subdomain)
        }
      ).catch(() => { });
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
    if (!await Authorizations.canUpdateUser(req.user, filteredRequest.id)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.UPDATE, entity: Entity.USER,
        module: MODULE_NAME, method: 'handleUpdateUserMobileToken',
        value: filteredRequest.id
      });
    }
    // Get authorization filters
    const authorizationUserFilters = await AuthorizationService.checkAndGetUserAuthorizationFilters(
      req.tenant, req.user, { ID: filteredRequest.id });
    // Get User
    const user = await UserStorage.getUser(
      req.user.tenantID, filteredRequest.id, authorizationUserFilters.filters);
    UtilsService.assertObjectExists(action, user, `User ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleUpdateUserMobileToken', req.user);
    // Update User (override TagIDs because it's not of the same type as in filteredRequest)
    await UserStorage.saveUserMobileToken(req.user.tenantID, user.id, {
      mobileToken: filteredRequest.mobileToken,
      mobileOs: filteredRequest.mobileOS,
      mobileLastChangedOn: new Date()
    });
    // Log
    await Logging.logSecurityInfo({
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
    const filteredRequest = UserSecurity.filterUserRequest(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleGetUser', req.user);
    // Check auth
    if (!await Authorizations.canReadUser(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.READ, entity: Entity.USER,
        module: MODULE_NAME, method: 'handleGetUser',
        value: filteredRequest.ID
      });
    }
    // Get authorization filters
    const authorizationUserFilters = await AuthorizationService.checkAndGetUserAuthorizationFilters(
      req.tenant, req.user, filteredRequest);
    // Get the user
    const user = await UserStorage.getUser(req.user.tenantID, filteredRequest.ID,
      {
        withImage: true,
        ...authorizationUserFilters.filters
      },
      authorizationUserFilters.projectFields
    );
    UtilsService.assertObjectExists(action, user, `User ID '${filteredRequest.ID}' does not exist`,
      MODULE_NAME, 'handleGetUser', req.user);
    res.json(user);
    next();
  }

  public static async handleGetUserImage(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const userID = UserSecurity.filterUserByIDRequest(req.query);
    UtilsService.assertIdIsProvided(action, userID, MODULE_NAME, 'handleGetUserImage', req.user);
    // Check auth
    if (!await Authorizations.canReadUser(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.READ, entity: Entity.USER,
        module: MODULE_NAME, method: 'handleGetUserImage',
        value: userID
      });
    }
    // Get authorization filters
    const authorizationUserFilters = await AuthorizationService.checkAndGetUserAuthorizationFilters(
      req.tenant, req.user, { ID: userID });
    // Get the logged user
    const user = await UserStorage.getUser(
      req.user.tenantID, userID, authorizationUserFilters.filters);
    UtilsService.assertObjectExists(action, user, `User ID '${userID}' does not exist`,
      MODULE_NAME, 'handleGetUserImage', req.user);
    // Get the user image
    const userImage = await UserStorage.getUserImage(req.user.tenantID, userID);
    // Ok
    res.json(userImage);
    next();
  }

  public static async handleExportUsers(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Export with tags
    req.query['WithTag'] = 'true';
    await UtilsService.exportToCSV(req, res, 'exported-users.csv',
      UserService.getUsers.bind(this),
      UserService.convertToCSV.bind(this));
  }

  public static async handleGetSites(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.UPDATE, Entity.USER, MODULE_NAME, 'handleGetSites');
    // Check auth
    if (!await Authorizations.canListUsersSites(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.LIST, entity: Entity.USERS_SITES,
        module: MODULE_NAME, method: 'handleGetSites'
      });
    }
    // Filter
    const filteredRequest = UserSecurity.filterUserSitesRequest(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.UserID, MODULE_NAME, 'handleGetSites', req.user);
    // Check auth
    if (!await Authorizations.canReadUser(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.UPDATE, entity: Entity.USER,
        module: MODULE_NAME, method: 'handleGetSites',
        value: filteredRequest.UserID
      });
    }
    // Get authorization filters
    const authorizationUserFilters = await AuthorizationService.checkAndGetUserAuthorizationFilters(
      req.tenant, req.user, { ID: filteredRequest.UserID });
    if (!authorizationUserFilters.authorized) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
    }
    // Get User
    const user = await UserStorage.getUser(
      req.user.tenantID, filteredRequest.UserID, authorizationUserFilters.filters);
    if (!user) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
    }
    // Check auth
    const authorizationUserSitesFilters = await AuthorizationService.checkAndGetUserSitesAuthorizationFilters(
      req.tenant, req.user, filteredRequest);
    if (!authorizationUserSitesFilters.authorized) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
    }
    // Get users
    const userSites = await UserStorage.getUserSites(req.user.tenantID,
      {
        search: filteredRequest.Search,
        userID: filteredRequest.UserID,
        ...authorizationUserSitesFilters.filters
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.SortFields,
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      authorizationUserSitesFilters.projectFields
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
    // Return
    res.json(await UserService.getUsers(req, res, next));
    next();
  }

  public static async handleGetUsersInError(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!await Authorizations.canListUsersInErrors(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.IN_ERROR, entity: Entity.USERS,
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
    // Get authorization filters
    const authorizationUserInErrorFilters = await AuthorizationService.checkAndGetUsersInErrorAuthorizationFilters(
      req.tenant, req.user, filteredRequest);
    // Get users
    const users = await UserStorage.getUsersInError(req.user.tenantID,
      {
        search: filteredRequest.Search,
        roles: (filteredRequest.Role ? filteredRequest.Role.split('|') : null),
        errorTypes: (filteredRequest.ErrorType ? filteredRequest.ErrorType.split('|') : Object.values(UserInErrorType)),
        ...authorizationUserInErrorFilters.filters
      },
      {
        limit: filteredRequest.Limit,
        onlyRecordCount: filteredRequest.OnlyRecordCount,
        skip: filteredRequest.Skip,
        sort: filteredRequest.SortFields
      },
      authorizationUserInErrorFilters.projectFields
    );
    // Add Auth flags
    await AuthorizationService.addUsersAuthorizations(req.tenant, req.user, users.result, authorizationUserInErrorFilters);
    // Return
    res.json(users);
    next();
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public static async handleImportUsers(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!await Authorizations.canImportUsers(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.IMPORT, entity: Entity.USERS,
        module: MODULE_NAME, method: 'handleImportUser'
      });
    }
    // Acquire the lock
    const importUsersLock = await LockingHelper.createImportUsersLock(req.tenant.id);
    if (!importUsersLock) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        action: action,
        errorCode: HTTPError.CANNOT_ACQUIRE_LOCK,
        module: MODULE_NAME, method: 'handleImportUsers',
        message: 'Error in importing the Users: cannot acquire the lock',
        user: req.user
      });
    }
    // Default values for User import
    const importedBy = req.user.id;
    const importedOn = new Date();
    const usersToBeImported: ImportedUser[] = [];
    const startTime = new Date().getTime();
    const result: ActionsResponse = {
      inSuccess: 0,
      inError: 0
    };
    try {
      // Delete all previously imported users
      await UserStorage.deleteImportedUsers(req.user.tenantID);
      // Get the stream
      const busboy = new Busboy({ headers: req.headers });
      req.pipe(busboy);
      // Handle closed socket
      let connectionClosed = false;
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      req.socket.on('close', async () => {
        if (!connectionClosed) {
          connectionClosed = true;
          // Release the lock
          await LockingManager.release(importUsersLock);
        }
      });
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      busboy.on('file', async (fieldname, file, filename, encoding, mimetype) => {
        if (filename.slice(-4) === '.csv') {
          const converter = csvToJson({
            trim: true,
            delimiter: Constants.CSV_SEPARATOR,
            output: 'json',
          });
          void converter.subscribe(async (user: ImportedUser) => {
            // Check connection
            if (connectionClosed) {
              throw new Error('HTTP connection has been closed');
            }
            // Check the format of the first entry
            if (!result.inSuccess && !result.inError) {
              // Check header
              const userKeys = Object.keys(user);
              if (!UserRequiredImportProperties.every((property) => userKeys.includes(property))) {
                if (!res.headersSent) {
                  res.writeHead(HTTPError.INVALID_FILE_CSV_HEADER_FORMAT);
                  res.end();
                }
                throw new Error(`Missing one of required properties: '${UserRequiredImportProperties.join(', ')}'`);
              }
            }
            // Set default value
            user.importedBy = importedBy;
            user.importedOn = importedOn;
            // Import
            const importSuccess = await UserService.processUser(action, req, user, usersToBeImported);
            if (!importSuccess) {
              result.inError++;
            }
            // Insert batched
            if ((usersToBeImported.length % Constants.IMPORT_BATCH_INSERT_SIZE) === 0) {
              await UserService.insertUsers(req.user.tenantID, req.user, action, usersToBeImported, result);
            }
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          }, async (error: CSVError) => {
            // Release the lock
            await LockingManager.release(importUsersLock);
            // Log
            await Logging.logError({
              tenantID: req.user.tenantID,
              module: MODULE_NAME, method: 'handleImportUsers',
              action: action,
              user: req.user.id,
              message: `Exception while parsing the CSV '${filename}': ${error.message}`,
              detailedMessages: { error: error.message, stack: error.stack }
            });
            if (!res.headersSent) {
              res.writeHead(HTTPError.INVALID_FILE_FORMAT);
              res.end();
            }
          // Completed
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          }, async () => {
            // Consider the connection closed
            connectionClosed = true;
            // Insert batched
            if (usersToBeImported.length > 0) {
              await UserService.insertUsers(req.user.tenantID, req.user, action, usersToBeImported, result);
            }
            // Release the lock
            await LockingManager.release(importUsersLock);
            // Log
            const executionDurationSecs = Utils.truncTo((new Date().getTime() - startTime) / 1000, 2);
            await Logging.logActionsResponse(
              req.user.tenantID, action,
              MODULE_NAME, 'handleImportUsers', result,
              `{{inSuccess}} User(s) were successfully uploaded in ${executionDurationSecs}s and ready for asynchronous import`,
              `{{inError}} User(s) failed to be uploaded in ${executionDurationSecs}s`,
              `{{inSuccess}}  User(s) were successfully uploaded in ${executionDurationSecs}s and ready for asynchronous import and {{inError}} failed to be uploaded`,
              `No User have been uploaded in ${executionDurationSecs}s`, req.user
            );
            // Create and Save async task
            await AsyncTaskManager.createAndSaveAsyncTasks({
              name: AsyncTasks.USERS_IMPORT,
              action: ServerAction.USERS_IMPORT,
              type: AsyncTaskType.TASK,
              tenantID: req.tenant.id,
              module: MODULE_NAME,
              method: 'handleImportUsers',
            });
            // Respond
            res.json({ ...result, ...Constants.REST_RESPONSE_SUCCESS });
            next();
          });
          // Start processing the file
          void file.pipe(converter);
        } else if (mimetype === 'application/json') {
          const parser = JSONStream.parse('users.*');
          // TODO: Handle the end of the process to send the data like the CSV
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          parser.on('data', async (user: ImportedUser) => {
            // Set default value
            user.importedBy = importedBy;
            user.importedOn = importedOn;
            // Import
            const importSuccess = await UserService.processUser(action, req, user, usersToBeImported);
            if (!importSuccess) {
              result.inError++;
            }
            // Insert batched
            if ((usersToBeImported.length % Constants.IMPORT_BATCH_INSERT_SIZE) === 0) {
              await UserService.insertUsers(req.user.tenantID, req.user, action, usersToBeImported, result);
            }
          });
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          parser.on('error', async (error) => {
            // Release the lock
            await LockingManager.release(importUsersLock);
            // Log
            await Logging.logError({
              tenantID: req.user.tenantID,
              module: MODULE_NAME, method: 'handleImportUsers',
              action: action,
              user: req.user.id,
              message: `Invalid Json file '${filename}'`,
              detailedMessages: { error: error.message, stack: error.stack }
            });
            if (!res.headersSent) {
              res.writeHead(HTTPError.INVALID_FILE_FORMAT);
              res.end();
            }
          });
          file.pipe(parser);
        } else {
          // Release the lock
          await LockingManager.release(importUsersLock);
          // Log
          await Logging.logError({
            tenantID: req.user.tenantID,
            module: MODULE_NAME, method: 'handleImportUsers',
            action: action,
            user: req.user.id,
            message: `Invalid file format '${mimetype}'`
          });
          if (!res.headersSent) {
            res.writeHead(HTTPError.INVALID_FILE_FORMAT);
            res.end();
          }
        }
      });
    } catch (error) {
      // Release the lock
      await LockingManager.release(importUsersLock);
      throw error;
    }
  }

  public static async handleCreateUser(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!await Authorizations.canCreateUser(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.CREATE, entity: Entity.USER,
        module: MODULE_NAME, method: 'handleCreateUser'
      });
    }
    // Filter
    const filteredRequest = UserSecurity.filterUserCreateRequest(req.body, req.user);
    // Check Mandatory fields
    UtilsService.checkIfUserValid(filteredRequest, null, req);
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
    // Clean request
    delete filteredRequest['passwords'];
    // Create
    const newUser: User = {
      ...filteredRequest,
      name: filteredRequest.name.toUpperCase(),
      email: filteredRequest.email.toLowerCase(),
      createdBy: { id: req.user.id },
      createdOn: new Date(),
      issuer: true,
    } as User;
    // Create the User
    newUser.id = await UserStorage.saveUser(req.user.tenantID, newUser, true);
    // Save password
    if (newUser.password) {
      const newPasswordHashed = await Utils.hashPasswordBcrypt(newUser.password);
      await UserStorage.saveUserPassword(req.user.tenantID, newUser.id,
        {
          password: newPasswordHashed,
          passwordWrongNbrTrials: 0,
          passwordResetHash: null,
          passwordBlockedUntil: null
        });
    }
    // Save Admin Data
    if (Authorizations.isAdmin(req.user)) {
      // For integration with billing
      const billingImpl = await BillingFactory.getBillingImpl(req.user.tenantID);
      if (billingImpl) {
        try {
          const user = await UserStorage.getUser(req.user.tenantID, newUser.id);
          await billingImpl.synchronizeUser(user);
          await Logging.logInfo({
            tenantID: req.user.tenantID,
            action: action,
            module: MODULE_NAME, method: 'handleCreateUser',
            user: newUser.id,
            message: 'User successfully created in billing system',
          });
        } catch (error) {
          await Logging.logError({
            tenantID: req.user.tenantID,
            module: MODULE_NAME, method: 'handleCreateUser',
            action: action,
            user: newUser.id,
            message: 'User cannot be created in billing system',
            detailedMessages: { error: error.message, stack: error.stack }
          });
        }
      }
    }
    if (Authorizations.isAdmin(req.user) || Authorizations.isSuperAdmin(req.user)) {
      // Save User Status
      if (newUser.status) {
        await UserStorage.saveUserStatus(req.user.tenantID, newUser.id, newUser.status);
      }
      // Save User Role
      if (newUser.role) {
        await UserStorage.saveUserRole(req.user.tenantID, newUser.id, newUser.role);
      }
      // Save Admin Data
      if (newUser.plateID || Utils.objectHasProperty(newUser, 'notificationsActive')) {
        const adminData: { plateID?: string; notificationsActive?: boolean; notifications?: UserNotifications } = {};
        if (newUser.plateID) {
          adminData.plateID = newUser.plateID;
        }
        if (Utils.objectHasProperty(newUser, 'notificationsActive')) {
          adminData.notificationsActive = newUser.notificationsActive;
          if (newUser.notifications) {
            adminData.notifications = newUser.notifications;
          }
        }
        // Save User Admin data
        await UserStorage.saveUserAdminData(req.user.tenantID, newUser.id, adminData);
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
        await UserStorage.addSitesToUser(req.user.tenantID, newUser.id, siteIDs);
      }
    }
    // Log
    await Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, actionOnUser: req.user,
      module: MODULE_NAME, method: 'handleCreateUser',
      message: `User with ID '${newUser.id}' has been created successfully`,
      action: action
    });
    // Ok
    res.json(Object.assign({ id: newUser.id }, Constants.REST_RESPONSE_SUCCESS));
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
    if (!await Authorizations.canReadUser(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.READ, entity: Entity.USER,
        module: MODULE_NAME, method: 'handleGetUserInvoice',
        value: id
      });
    }
    // Get authorization filters
    const authorizationUserFilters = await AuthorizationService.checkAndGetUserAuthorizationFilters(
      req.tenant, req.user, { ID: id });
    // Get the user
    const user = await UserStorage.getUser(req.user.tenantID, id, authorizationUserFilters.filters);
    UtilsService.assertObjectExists(action, user, `User ID '${id}' does not exist`,
      MODULE_NAME, 'handleGetUserInvoice', req.user);
    // Get the settings
    const pricingSetting = await SettingStorage.getPricingSettings(req.user.tenantID);
    if (!pricingSetting || !pricingSetting.convergentCharging) {
      await Logging.logException(
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
    // FIXME: The calls to external pricing services need to be integrated inside the pricing integration interface definition, see https://github.com/sap-labs-france/ev-dashboard/issues/1542
    // const ratingService = ConvergentChargingPricingIntegration.getRatingServiceClient(pricingSetting.convergentCharging.url, pricingSetting.convergentCharging.user, pricingSetting.convergentCharging.password);
    // const erpService = ConvergentChargingPricingIntegration.getERPServiceClient(pricingSetting.convergentCharging.url, pricingSetting.convergentCharging.user, pricingSetting.convergentCharging.password);
    let invoiceNumber: string;
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
        errorCode: StatusCodes.NOT_FOUND,
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

  private static async insertUsers(tenantID: string, user: UserToken, action: ServerAction, usersToBeImported: ImportedUser[], result: ActionsResponse): Promise<void> {
    try {
      const nbrInsertedUsers = await UserStorage.saveImportedUsers(tenantID, usersToBeImported);
      result.inSuccess += nbrInsertedUsers;
    } catch (error) {
      // Handle dup keys
      result.inSuccess += error.result.nInserted;
      result.inError += error.writeErrors.length;
      await Logging.logError({
        tenantID: tenantID,
        module: MODULE_NAME, method: 'insertUsers',
        action: action,
        user: user.id,
        message: `Cannot import ${error.writeErrors.length as number} users!`,
        detailedMessages: { error: error.message, stack: error.stack, tagsError: error.writeErrors }
      });
    }
    usersToBeImported.length = 0;
  }

  private static convertToCSV(req: Request, users: User[], writeHeader = true): string {
    let headers = null;
    // Header
    if (writeHeader) {
      const headerArray = [
        'id',
        'name',
        'firstName',
        'locale',
        'role',
        'status',
        'email',
        'eulaAcceptedOn',
        'createdOn',
        'changedOn',
        'changedBy'
      ];
      headers = headerArray.join(Constants.CSV_SEPARATOR);
    }
    // Content
    const rows = users.map((user) => {
      const row = [
        Cypher.hash(user.id),
        user.name,
        user.firstName,
        user.locale,
        user.role,
        user.status,
        user.email,
        moment(user.eulaAcceptedOn).format('YYYY-MM-DD'),
        moment(user.createdOn).format('YYYY-MM-DD'),
        moment(user.lastChangedOn).format('YYYY-MM-DD'),
        (user.lastChangedBy ? Utils.buildUserFullName(user.lastChangedBy as User, false) : '')
      ].map((value) => typeof value === 'string' ? '"' + value.replace(/^"|"$/g, '') + '"' : value);
      return row;
    }).join(Constants.CR_LF);
    return Utils.isNullOrUndefined(headers) ? Constants.CR_LF + rows : [headers, rows].join(Constants.CR_LF);
  }

  private static async getUsers(req: Request, res: Response, next: NextFunction): Promise<DataResult<User>> {
    // Check auth
    if (!await Authorizations.canListUsers(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.LIST, entity: Entity.USERS,
        module: MODULE_NAME, method: 'getUsers'
      });
    }
    // Filter
    const filteredRequest = UserSecurity.filterUsersRequest(req.query);
    // Check component
    if (filteredRequest.SiteID || filteredRequest.ExcludeSiteID) {
      UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
        Action.READ, Entity.USER, MODULE_NAME, 'getUsers');
    }
    if (filteredRequest.NotAssignedToCarID) {
      UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR,
        Action.READ, Entity.USER, MODULE_NAME, 'getUsers');
    }
    // Get authorization filters
    const authorizationUsersFilters = await AuthorizationService.checkAndGetUsersAuthorizationFilters(
      req.tenant, req.user, filteredRequest);
    if (!authorizationUsersFilters.authorized) {
      return Constants.DB_EMPTY_DATA_RESULT;
    }
    // Get users
    const users = await UserStorage.getUsers(req.user.tenantID,
      {
        search: filteredRequest.Search,
        issuer: filteredRequest.Issuer,
        siteIDs: (filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : null),
        userIDs: (filteredRequest.UserID ? filteredRequest.UserID.split('|') : null),
        roles: (filteredRequest.Role ? filteredRequest.Role.split('|') : null),
        statuses: (filteredRequest.Status ? filteredRequest.Status.split('|') : null),
        excludeSiteID: filteredRequest.ExcludeSiteID,
        excludeUserIDs: (filteredRequest.ExcludeUserIDs ? filteredRequest.ExcludeUserIDs.split('|') : null),
        includeCarUserIDs: (filteredRequest.IncludeCarUserIDs ? filteredRequest.IncludeCarUserIDs.split('|') : null),
        notAssignedToCarID: filteredRequest.NotAssignedToCarID,
        ...authorizationUsersFilters.filters
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.SortFields,
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      authorizationUsersFilters.projectFields
    );
    // Add Auth flags
    await AuthorizationService.addUsersAuthorizations(req.tenant, req.user, users.result, authorizationUsersFilters);
    // Return
    return users;
  }

  private static async processUser(action: ServerAction, req: Request, importedUser: ImportedUser, usersToBeImported: ImportedUser[]): Promise<boolean> {
    try {
      const newImportedUser: ImportedUser = {
        name: importedUser.name.toUpperCase().replace(/^"|"$/g, ''),
        firstName: importedUser.firstName.replace(/^"|"$/g, ''),
        email: importedUser.email.replace(/^"|"$/g, ''),
      };

      // Validate User data
      UserValidator.getInstance().validateImportedUserCreation(newImportedUser);
      // Set properties
      newImportedUser.importedBy = importedUser.importedBy;
      newImportedUser.importedOn = importedUser.importedOn;
      newImportedUser.status = ImportStatus.READY;
      // Save it later on
      usersToBeImported.push(newImportedUser);
      return true;
    } catch (error) {
      await Logging.logError({
        tenantID: req.user.tenantID,
        module: MODULE_NAME, method: 'importUser',
        action: action,
        message: 'User cannot be imported',
        detailedMessages: { user: importedUser, error: error.message, stack: error.stack }
      });
      return false;
    }
  }
}
