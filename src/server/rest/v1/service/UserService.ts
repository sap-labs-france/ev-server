import { Action, Entity } from '../../../../types/Authorization';
import { ActionsResponse, ImportStatus } from '../../../../types/GlobalType';
import { AsyncTaskType, AsyncTasks } from '../../../../types/AsyncTask';
import Busboy, { FileInfo } from 'busboy';
import { Car, CarType } from '../../../../types/Car';
import { DataResult, UserDataResult, UserSiteDataResult } from '../../../../types/DataResult';
import { HTTPAuthError, HTTPError } from '../../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';
import Tenant, { TenantComponents } from '../../../../types/Tenant';
import User, { ImportedUser, UserRequiredImportProperties, UserRole } from '../../../../types/User';

import AppAuthError from '../../../../exception/AppAuthError';
import AppError from '../../../../exception/AppError';
import AsyncTaskBuilder from '../../../../async-task/AsyncTaskBuilder';
import AuthorizationService from './AuthorizationService';
import BillingFactory from '../../../../integration/billing/BillingFactory';
import CSVError from 'csvtojson/v2/CSVError';
import CarStorage from '../../../../storage/mongodb/CarStorage';
import Constants from '../../../../utils/Constants';
import EmspOCPIClient from '../../../../client/ocpi/EmspOCPIClient';
import { HttpUsersGetRequest } from '../../../../types/requests/HttpUserRequest';
import JSONStream from 'JSONStream';
import LockingHelper from '../../../../locking/LockingHelper';
import LockingManager from '../../../../locking/LockingManager';
import Logging from '../../../../utils/Logging';
import NotificationHandler from '../../../../notification/NotificationHandler';
import OCPIClientFactory from '../../../../client/ocpi/OCPIClientFactory';
import { OCPIRole } from '../../../../types/ocpi/OCPIRole';
import { OCPITokenWhitelist } from '../../../../types/ocpi/OCPIToken';
import OCPIUtils from '../../../ocpi/OCPIUtils';
import { Readable } from 'stream';
import { ServerAction } from '../../../../types/Server';
import SmartChargingHelper from '../../../../integration/smart-charging/SmartChargingHelper';
import { StartTransactionErrorCode } from '../../../../types/Transaction';
import { StatusCodes } from 'http-status-codes';
import Tag from '../../../../types/Tag';
import TagStorage from '../../../../storage/mongodb/TagStorage';
import { UserInErrorType } from '../../../../types/InError';
import UserNotifications from '../../../../types/UserNotifications';
import UserStorage from '../../../../storage/mongodb/UserStorage';
import UserToken from '../../../../types/UserToken';
import UserValidatorRest from '../validator/UserValidatorRest';
import Utils from '../../../../utils/Utils';
import UtilsSecurity from './security/UtilsSecurity';
import UtilsService from './UtilsService';
import _ from 'lodash';
import csvToJson from 'csvtojson/v2';
import moment from 'moment';

const MODULE_NAME = 'UserService';

export default class UserService {
  public static async handleGetUserSessionContext(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = UserValidatorRest.getInstance().validateUserSessionContextReq(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.UserID, MODULE_NAME, 'handleGetUserSessionContext', req.user);
    // Check and Get User
    const user = await UtilsService.checkAndGetUserAuthorization(
      req.tenant, req.user, filteredRequest.UserID, Action.READ, action);
    // Handle Tag
    // We retrieve Tag auth to get the projected fields here to fit with what's in auth definition
    const tagAuthorization = await AuthorizationService.checkAndGetTagAuthorizations(req.tenant, req.user, {}, Action.READ);
    let tag: Tag;
    if (tagAuthorization.authorized) {
      // Get the tag from the request TagID
      if (filteredRequest.TagID) {
        const tagFromID = await TagStorage.getTag(req.tenant, filteredRequest.TagID, { issuer: true }, tagAuthorization.projectFields);
        if (!tagFromID || tagFromID.userID !== filteredRequest.UserID) {
          throw new AppError({
            errorCode: StatusCodes.BAD_REQUEST,
            message: 'This user has no tag with such TagID',
            module: MODULE_NAME,
            method: 'handleGetUserSessionContext',
            action: action
          });
        } else {
          tag = tagFromID;
        }
      }
      if (!tag) {
        // Get the default Tag
        tag = await TagStorage.getDefaultUserTag(req.tenant, user.id, { issuer: true }, tagAuthorization.projectFields);
        if (!tag) {
          // Get the first active Tag
          tag = await TagStorage.getFirstActiveUserTag(req.tenant, user.id, { issuer: true }, tagAuthorization.projectFields);
        }
      }
    }
    // Handle Car
    // We retrieve Car auth to get the projected fields here to fit with what's in auth definition
    const carAuthorization = await AuthorizationService.checkAndGetCarAuthorizations(req.tenant, req.user, {}, Action.READ);
    let car: Car;
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.CAR) && carAuthorization.authorized) {
      // Get the car from the request CarID
      if (filteredRequest.CarID) {
        const carFromID = await CarStorage.getCar(req.tenant, filteredRequest.CarID, {}, carAuthorization.projectFields);
        if (!carFromID || carFromID.userID !== filteredRequest.UserID) {
          throw new AppError({
            errorCode: StatusCodes.BAD_REQUEST,
            message: 'This user has no car with such CarID',
            module: MODULE_NAME,
            method: 'handleGetUserSessionContext',
            action: action
          });
        } else {
          car = carFromID;
        }
      }
      if (!car) {
        // Get the default Car
        car = await CarStorage.getDefaultUserCar(req.tenant, filteredRequest.UserID, {}, carAuthorization.projectFields);
        if (!car) {
          // Get the first available car
          car = await CarStorage.getFirstAvailableUserCar(req.tenant, filteredRequest.UserID, carAuthorization.projectFields);
        }
      }
    }
    let withBillingChecks = true ;
    const chargingStation = await UtilsService.checkAndGetChargingStationAuthorization(req.tenant, req.user, filteredRequest.ChargingStationID, Action.READ,
      action, null, { withSiteArea: true });
    if (!chargingStation.siteArea.accessControl) {
      // The access control is switched off - so billing checks are useless
      withBillingChecks = false;
    }
    // Check for billing errors
    const errorCodes: Array<StartTransactionErrorCode> = [];
    if (withBillingChecks) {
      // Check for the billing prerequisites (such as the user's payment method)
      await UserService.checkBillingErrorCodes(action, req.tenant, req.user, user, errorCodes);
    }
    // Get additional Smart Charging parameters such as the Departure Time
    const parameters = await SmartChargingHelper.getSessionParameters(req.tenant, req.user, chargingStation, filteredRequest.ConnectorID, car);
    res.json({
      tag, car, errorCodes, smartChargingSessionParameters: parameters
    });
    next();
  }

  public static async handleGetUserDefaultTagCar(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = UserValidatorRest.getInstance().validateUserDefaultTagCarGetReq(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.UserID, MODULE_NAME, 'handleGetUserDefaultTagCar', req.user);
    // Check and Get User
    const user = await UtilsService.checkAndGetUserAuthorization(
      req.tenant, req.user, filteredRequest.UserID, Action.READ, action);
    // Handle Tag
    // We retrieve Tag auth to get the projected fields here to fit with what's in auth definition
    const tagAuthorization = await AuthorizationService.checkAndGetTagAuthorizations(req.tenant, req.user, {}, Action.READ);
    let tag: Tag;
    // Get the default Tag
    if (tagAuthorization.authorized) {
      tag = await TagStorage.getDefaultUserTag(req.tenant, user.id, {
        issuer: true
      }, tagAuthorization.projectFields);
      if (!tag) {
        // Get the first active Tag
        tag = await TagStorage.getFirstActiveUserTag(req.tenant, user.id, {
          issuer: true
        }, tagAuthorization.projectFields);
      }
    }
    // Handle Car
    // We retrieve Car auth to get the projected fields here to fit with what's in auth definition
    const carAuthorization = await AuthorizationService.checkAndGetCarAuthorizations(req.tenant, req.user, {}, Action.READ);
    let car: Car;
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.CAR) && carAuthorization.authorized) {
    // Get the default Car
      car = await CarStorage.getDefaultUserCar(req.tenant, filteredRequest.UserID, {}, carAuthorization.projectFields);
      if (!car) {
        // Get the first available car
        car = await CarStorage.getFirstAvailableUserCar(req.tenant, filteredRequest.UserID, carAuthorization.projectFields);
      }
    }
    let withBillingChecks = true ;
    if (filteredRequest.ChargingStationID) {
      // TODO - The ChargingStationID is optional but only for backward compatibility reasons - make it mandatory as soon as possible
      const chargingStation = await UtilsService.checkAndGetChargingStationAuthorization(req.tenant, req.user, filteredRequest.ChargingStationID, Action.READ,
        action, null, { withSiteArea: true });
      if (!chargingStation.siteArea.accessControl) {
        // The access control is switched off - so billing checks are useless
        withBillingChecks = false;
      }
    }
    // Check for billing errors
    const errorCodes: Array<StartTransactionErrorCode> = [];
    if (withBillingChecks) {
      // Check for the billing prerequisites (such as the user's payment method)
      await UserService.checkBillingErrorCodes(action, req.tenant, req.user, user, errorCodes);
    }
    res.json({
      tag, car, errorCodes
    });
    next();
  }

  public static async handleAssignSitesToUser(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.UPDATE, Entity.SITE, 'SiteService', 'handleAssignSitesToUser');
    // Filter request
    const filteredRequest = UserValidatorRest.getInstance().validateUserSitesAssignReq(req.body);
    // Check and Get User
    const user = await UtilsService.checkAndGetUserAuthorization(req.tenant, req.user, filteredRequest.userID, Action.ASSIGN_UNASSIGN_SITES, action);
    // Check and Get Sites
    const serverAction = action === ServerAction.ADD_SITES_TO_USER ? Action.ASSIGN_SITES_TO_USER : Action.UNASSIGN_SITES_FROM_USER;
    const sites = await UtilsService.checkAndGetUserSitesAuthorization(req.tenant, req.user, user, filteredRequest.siteIDs, action);
    // Save
    for (const site of sites) {
      const authorized = AuthorizationService.canPerformAction(site, serverAction);
      if (!authorized) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.FORBIDDEN,
          user: req.user,
          action: serverAction, entity: Entity.USER_SITE,
          module: MODULE_NAME, method: 'handleAssignSitesToUser',
          value: site.id
        });
      }
    }
    if (action === ServerAction.ADD_SITES_TO_USER) {
      await UserStorage.addSitesToUser(req.tenant, filteredRequest.userID, sites.map((site) => site.id));
    } else {
      await UserStorage.removeSitesFromUser(req.tenant, filteredRequest.userID, sites.map((site) => site.id));
    }
    await Logging.logInfo({
      tenantID: req.tenant.id,
      user: req.user,
      module: MODULE_NAME,
      method: 'handleAssignSitesToUser',
      message: 'User\'s Sites have been assigned successfully', action: action
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleDeleteUser(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const userID = UserValidatorRest.getInstance().validateUserDeleteReq(req.query).ID.toString();
    // Check and Get User
    const user = await UtilsService.checkAndGetUserAuthorization(req.tenant, req.user, userID, Action.DELETE, action, null, {}, false);
    // Delete OCPI User
    if (!user.issuer) {
      // Delete User
      await UserStorage.deleteUser(req.tenant, user.id);
      await Logging.logInfo({
        tenantID: req.tenant.id,
        user: req.user, actionOnUser: user,
        module: MODULE_NAME, method: 'handleDeleteUser',
        message: `User with ID '${user.id}' has been deleted successfully`,
        action: action
      });
      res.json(Constants.REST_RESPONSE_SUCCESS);
      next();
      return;
    }
    // Delete Billing
    await UserService.checkAndDeleteUserBilling(req.tenant, req.user, user);
    // Delete OCPI
    void UserService.checkAndDeleteUserRoaming(req.tenant, req.user, user);
    // Delete Car
    await UserService.checkAndDeleteCar(req.tenant, req.user, user);
    // Delete User
    await UserStorage.deleteUser(req.tenant, user.id);
    // Log
    await Logging.logInfo({
      tenantID: req.tenant.id,
      user: req.user, actionOnUser: user,
      module: MODULE_NAME, method: 'handleDeleteUser',
      message: `User with ID '${user.id}' has been deleted successfully`,
      action: action
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleUpdateUser(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    let statusHasChanged = false;
    // Filter
    const filteredRequest = UserValidatorRest.getInstance().validateUserUpdateReq(req.body);
    // Check and Get User
    let user = await UtilsService.checkAndGetUserAuthorization(req.tenant, req.user, filteredRequest.id, Action.UPDATE, action, filteredRequest);
    // Check email already exists
    if (filteredRequest.email) {
      const userWithEmail = await UserStorage.getUserByEmail(req.tenant, filteredRequest.email);
      if (userWithEmail && user.id !== userWithEmail.id) {
        throw new AppError({
          errorCode: HTTPError.USER_EMAIL_ALREADY_EXIST_ERROR,
          message: `Email '${filteredRequest.email}' already exists`,
          module: MODULE_NAME, method: 'handleUpdateUser',
          user: req.user,
          action: action
        });
      }
    }
    // Check if Status has been changed
    if (filteredRequest.status && filteredRequest.status !== user.status) {
      statusHasChanged = true;
    }
    // Update timestamp
    const lastChangedBy = { id: req.user.id };
    const lastChangedOn = new Date();
    // Check User validity
    UtilsService.checkIfUserValid(filteredRequest, user, req);
    // Update user
    user = {
      ...user,
      ...filteredRequest,
      lastChangedBy: lastChangedBy,
      lastChangedOn: lastChangedOn,
    };
    // Update User (override TagIDs because it's not of the same type as in filteredRequest)
    await UserStorage.saveUser(req.tenant, user, true);
    // Save User's password
    if (filteredRequest.password) {
      // Update the password
      const newPasswordHashed = await Utils.hashPasswordBcrypt(filteredRequest.password);
      await UserStorage.saveUserPassword(req.tenant, filteredRequest.id,
        {
          password: newPasswordHashed,
          passwordWrongNbrTrials: 0,
          passwordResetHash: null,
          passwordBlockedUntil: null
        });
    }
    // Update User Admin Data
    await UserService.updateUserAdminData(req.tenant, user, user.projectFields);
    // Update Billing
    await UserService.syncUserAndUpdateBillingData(ServerAction.USER_UPDATE, req.tenant, req.user, user);
    // Log
    await Logging.logInfo({
      tenantID: req.tenant.id,
      user: req.user, actionOnUser: user,
      module: MODULE_NAME, method: 'handleUpdateUser',
      message: 'User has been updated successfully',
      action: action
    });
    if (statusHasChanged && req.tenant.id !== Constants.DEFAULT_TENANT_ID) {
      // Notify
      NotificationHandler.sendUserAccountStatusChanged(
        req.tenant,
        Utils.generateUUID(),
        user,
        {
          user,
          evseDashboardURL: Utils.buildEvseURL(req.tenant.subdomain)
        }
      ).catch((error) => {
        Logging.logPromiseError(error, req?.tenant?.id);
      });
    }
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleUpdateUserMobileData(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = UserValidatorRest.getInstance().validateUserMobileDataUpdateReq({ ...req.params, ...req.body });
    // Check and Get User
    const user = await UtilsService.checkAndGetUserAuthorization(
      req.tenant, req.user, filteredRequest.id, Action.UPDATE, action);
    // Update User
    await UserStorage.saveUserMobileData(req.tenant, user.id, {
      mobileToken: filteredRequest.mobileToken,
      mobileOS: filteredRequest.mobileOS,
      mobileBundleID: filteredRequest.mobileBundleID,
      mobileAppName: filteredRequest.mobileAppName,
      mobileVersion: filteredRequest.mobileVersion,
      mobileLastChangedOn: new Date()
    });
    await Logging.logInfo({
      tenantID: req.tenant.id,
      user: user,
      module: MODULE_NAME, method: 'handleUpdateUserMobileData',
      message: 'User\'s mobile data has been updated successfully',
      action: action,
      detailedMessages: {
        mobileData: filteredRequest,
      }
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetUser(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = UserValidatorRest.getInstance().validateUserGetReq(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleGetUser', req.user);
    // Check and Get User
    const user = await UtilsService.checkAndGetUserAuthorization(
      req.tenant, req.user, filteredRequest.ID.toString(), Action.READ, action, null, {
        withImage: true
      }, true);
    res.json(user);
    next();
  }

  public static async handleGetUserImage(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const userID = UserValidatorRest.getInstance().validateUserGetReq(req.query).ID.toString();
    // Check and Get User
    const user = await UtilsService.checkAndGetUserAuthorization(req.tenant, req.user, userID, Action.READ, action);
    // Get the user image
    const userImage = await UserStorage.getUserImage(req.tenant, user.id);
    let image = userImage?.image;
    if (image) {
      // Header
      let header = 'image';
      let encoding: BufferEncoding = 'base64';
      if (image.startsWith('data:image/')) {
        header = image.substring(5, image.indexOf(';'));
        encoding = image.substring(image.indexOf(';') + 1, image.indexOf(',')) as BufferEncoding;
        image = image.substring(image.indexOf(',') + 1);
      }
      res.setHeader('Content-Type', header);
      res.send(Buffer.from(image, encoding));
    } else {
      res.status(StatusCodes.NOT_FOUND);
    }
    next();
  }

  public static async handleExportUsers(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    await AuthorizationService.checkAndGetUsersAuthorizations(req.tenant, req.user, Action.EXPORT);
    // Force params
    req.query.Limit = Constants.EXPORT_PAGE_SIZE.toString();
    // Filter
    const filteredRequest = UserValidatorRest.getInstance().validateUsersGetReq(req.query);
    // Get Users
    await UtilsService.exportToCSV(req, res, 'exported-users.csv', filteredRequest,
      UserService.getUsers.bind(this),
      UserService.convertToCSV.bind(this));
  }

  public static async handleGetSites(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.UPDATE, Entity.USER, MODULE_NAME, 'handleGetSites');
    // Filter
    const filteredRequest = UserValidatorRest.getInstance().validateUserSitesGetReq(req.query);
    // Check dynamic auth for listing user sites
    const authorizations = await AuthorizationService.checkAndGetUserSitesAuthorizations(req.tenant,
      req.user, filteredRequest, false);
    if (!authorizations.authorized) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
    }
    // Get Sites
    const userSites = await UserStorage.getUserSites(req.tenant,
      {
        search: filteredRequest.Search,
        userIDs: [filteredRequest.UserID],
        ...authorizations.filters
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields),
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      authorizations.projectFields
    );
    // Add Auth flags
    await AuthorizationService.addUserSitesAuthorizations(req.tenant, req.user, userSites as UserSiteDataResult , authorizations);
    res.json(userSites);
    next();
  }

  public static async handleGetUsers(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = UserValidatorRest.getInstance().validateUsersGetReq(req.query);
    // Get Users
    res.json(await UserService.getUsers(req, filteredRequest));
    next();
  }

  public static async handleGetUsersInError(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = UserValidatorRest.getInstance().validateUsersInErrorGetReq(req.query);
    // Get authorization filters
    const authorizationUserInErrorFilters = await AuthorizationService.checkAndGetUsersInErrorAuthorizations(req.tenant, req.user, filteredRequest);
    // Get users
    const users = await UserStorage.getUsersInError(req.tenant,
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
        sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields)
      },
      authorizationUserInErrorFilters.projectFields
    );
    // Add Auth flags
    if (filteredRequest.WithAuth) {
      await AuthorizationService.addUsersAuthorizations(req.tenant, req.user, users as UserDataResult, authorizationUserInErrorFilters);
    }
    res.json(users);
    next();
  }

  public static async handleImportUsers(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    await AuthorizationService.checkAndGetUsersAuthorizations(req.tenant, req.user, Action.IMPORT);
    // Acquire the lock
    const importUsersLock = await LockingHelper.acquireImportUsersLock(req.tenant.id);
    if (!importUsersLock) {
      throw new AppError({
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
      await UserStorage.deleteImportedUsers(req.tenant);
      // Get the stream
      const busboy = Busboy({ headers: req.headers });
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
      await new Promise((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        busboy.on('file', async (fileName: string, fileStream: Readable, fileInfo: FileInfo) => {
          if (fileInfo.filename.slice(-4) === '.csv') {
            const converter = csvToJson({
              trim: true,
              delimiter: Constants.CSV_SEPARATOR,
              output: 'json',
            });
            void converter.subscribe(async (user: ImportedUser) => {
              // Check connection
              if (connectionClosed) {
                reject(new Error('HTTP connection has been closed'));
              }
              // Check the format of the first entry
              if (!result.inSuccess && !result.inError) {
                // Check header
                const userKeys = Object.keys(user);
                if (!UserRequiredImportProperties.every((property) => userKeys.includes(property))) {
                  if (!res.headersSent) {
                    res.writeHead(HTTPError.INVALID_FILE_CSV_HEADER_FORMAT);
                    res.end();
                    resolve();
                  }
                  reject(new Error(`Missing one of required properties: '${UserRequiredImportProperties.join(', ')}'`));
                }
              }
              // Set default value
              user.importedBy = importedBy;
              user.importedOn = importedOn;
              user.importedData = {
                'autoActivateUserAtImport': UtilsSecurity.filterBoolean(req.headers.autoactivateuseratimport)
              };
              // Import
              const importSuccess = await UserService.processUser(action, req, user, usersToBeImported);
              if (!importSuccess) {
                result.inError++;
              }
              // Insert batched
              if (!Utils.isEmptyArray(usersToBeImported) && (usersToBeImported.length % Constants.IMPORT_BATCH_INSERT_SIZE) === 0) {
                await UserService.insertUsers(req.tenant, req.user, action, usersToBeImported, result);
              }
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            }, async (error: CSVError) => {
              // Release the lock
              await LockingManager.release(importUsersLock);
              // Log
              await Logging.logError({
                tenantID: req.tenant.id,
                module: MODULE_NAME, method: 'handleImportUsers',
                action: action,
                user: req.user.id,
                message: `Exception while parsing the CSV '${fileInfo.filename}': ${error.message}`,
                detailedMessages: { error: error.stack }
              });
              if (!res.headersSent) {
                res.writeHead(HTTPError.INVALID_FILE_FORMAT);
                res.end();
                resolve();
              }
            // Completed
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            }, async () => {
              // Consider the connection closed
              connectionClosed = true;
              // Insert batched
              if (usersToBeImported.length > 0) {
                await UserService.insertUsers(req.tenant, req.user, action, usersToBeImported, result);
              }
              // Release the lock
              await LockingManager.release(importUsersLock);
              // Log
              const executionDurationSecs = Utils.truncTo((new Date().getTime() - startTime) / 1000, 2);
              await Logging.logActionsResponse(
                req.tenant.id, action,
                MODULE_NAME, 'handleImportUsers', result,
                `{{inSuccess}} User(s) were successfully uploaded in ${executionDurationSecs}s and ready for asynchronous import`,
                `{{inError}} User(s) failed to be uploaded in ${executionDurationSecs}s`,
                `{{inSuccess}}  User(s) were successfully uploaded in ${executionDurationSecs}s and ready for asynchronous import and {{inError}} failed to be uploaded`,
                `No User have been uploaded in ${executionDurationSecs}s`, req.user
              );
              // Create and Save async task
              await AsyncTaskBuilder.createAndSaveAsyncTasks({
                name: AsyncTasks.USERS_IMPORT,
                action: ServerAction.USERS_IMPORT,
                type: AsyncTaskType.TASK,
                tenantID: req.tenant.id,
                module: MODULE_NAME,
                method: 'handleImportUsers',
              });
              // Respond
              if (!res.headersSent) {
                res.json({ ...result, ...Constants.REST_RESPONSE_SUCCESS });
              }
              next();
              resolve();
            });
            // Start processing the file
            void fileStream.pipe(converter);
          } else if (fileInfo.mimeType === 'application/json') {
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
                await UserService.insertUsers(req.tenant, req.user, action, usersToBeImported, result);
              }
            });
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            parser.on('error', async (error) => {
              // Release the lock
              await LockingManager.release(importUsersLock);
              // Log
              await Logging.logError({
                tenantID: req.tenant.id,
                module: MODULE_NAME, method: 'handleImportUsers',
                action: action,
                user: req.user.id,
                message: `Invalid Json file '${fileInfo.filename}'`,
                detailedMessages: { error: error.stack }
              });
              if (!res.headersSent) {
                res.writeHead(HTTPError.INVALID_FILE_FORMAT);
                res.end();
                resolve();
              }
            });
            fileStream.pipe(parser);
          } else {
            // Release the lock
            await LockingManager.release(importUsersLock);
            // Log
            await Logging.logError({
              tenantID: req.tenant.id,
              module: MODULE_NAME, method: 'handleImportUsers',
              action: action,
              user: req.user.id,
              message: `Invalid file format '${fileInfo.mimeType}'`
            });
            if (!res.headersSent) {
              res.writeHead(HTTPError.INVALID_FILE_FORMAT);
              res.end();
            }
          }
        });
      });
    } finally {
      // Release the lock
      await LockingManager.release(importUsersLock);
    }
  }

  public static async handleCreateUser(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = UserValidatorRest.getInstance().validateUserCreateReq(req.body);
    // Check Mandatory fields
    UtilsService.checkIfUserValid(filteredRequest, null, req);
    // Get dynamic auth
    const authorizations = await AuthorizationService.checkAndGetUserAuthorizations(
      req.tenant, req.user, {}, Action.CREATE, filteredRequest);
    // Get the email
    const foundUser = await UserStorage.getUserByEmail(req.tenant, filteredRequest.email);
    if (foundUser) {
      throw new AppError({
        errorCode: HTTPError.USER_EMAIL_ALREADY_EXIST_ERROR,
        message: `Email '${filteredRequest.email}' already exists`,
        module: MODULE_NAME, method: 'handleCreateUser',
        user: req.user,
        action: action
      });
    }
    // Create
    const newUser: User = {
      ...filteredRequest,
      name: filteredRequest.name,
      email: filteredRequest.email,
      createdBy: { id: req.user.id },
      createdOn: new Date(),
      issuer: true,
    } as User;
    // Create the User
    newUser.id = await UserStorage.saveUser(req.tenant, newUser, true);
    // Save password
    if (newUser.password) {
      const newPasswordHashed = await Utils.hashPasswordBcrypt(newUser.password);
      await UserStorage.saveUserPassword(req.tenant, newUser.id,
        {
          password: newPasswordHashed,
          passwordWrongNbrTrials: 0,
          passwordResetHash: null,
          passwordBlockedUntil: null
        });
    }
    // Update User Admin Data
    await UserService.updateUserAdminData(req.tenant, newUser, authorizations.projectFields);
    // Assign Site to new User
    await UtilsService.assignCreatedUserToSites(req.tenant, newUser, authorizations);
    // Update Billing
    await UserService.syncUserAndUpdateBillingData(ServerAction.USER_CREATE, req.tenant, req.user, newUser);
    // Log
    await Logging.logInfo({
      tenantID: req.tenant.id,
      user: req.user, actionOnUser: req.user,
      module: MODULE_NAME, method: 'handleCreateUser',
      message: `User with ID '${newUser.id}' has been created successfully`,
      action: action
    });
    res.json(Object.assign({ id: newUser.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  private static async insertUsers(tenant: Tenant, user: UserToken, action: ServerAction, usersToBeImported: ImportedUser[], result: ActionsResponse): Promise<void> {
    try {
      const nbrInsertedUsers = await UserStorage.saveImportedUsers(tenant, usersToBeImported);
      result.inSuccess += nbrInsertedUsers;
    } catch (error) {
      // Handle dup keys
      result.inSuccess += error.result.nInserted;
      result.inError += error.writeErrors.length;
      await Logging.logError({
        tenantID: tenant.id,
        module: MODULE_NAME, method: 'insertUsers',
        action: action,
        user: user.id,
        message: `Cannot import ${error.writeErrors.length as number} users!`,
        detailedMessages: { error: error.stack, tagsError: error.writeErrors }
      });
    }
    usersToBeImported.length = 0;
  }

  private static convertToCSV(req: Request, users: User[], writeHeader = true): string {
    let headers = null;
    // Header
    if (writeHeader) {
      headers = [
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
        'changedBy',
      ].join(Constants.CSV_SEPARATOR);
    }
    // Content
    const rows = users.map((user) => {
      const row = [
        user.id,
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
      ].map((value) => Utils.escapeCsvValue(value));
      return row;
    }).join(Constants.CR_LF);
    return Utils.isNullOrUndefined(headers) ? Constants.CR_LF + rows : [headers, rows].join(Constants.CR_LF);
  }

  private static async getUsers(req: Request, filteredRequest: HttpUsersGetRequest): Promise<DataResult<User>> {
    // Get authorization filters
    const authorizationUsersFilters = await AuthorizationService.checkAndGetUsersAuthorizations(req.tenant, req.user, Action.LIST, filteredRequest);
    // Optimization: Get Tag IDs from Visual IDs
    if (filteredRequest.VisualTagID) {
      await AuthorizationService.checkAndGetTagsAuthorizations(req.tenant, req.user, filteredRequest);
      const tagIDs = await TagStorage.getTags(req.tenant, {
        visualIDs: filteredRequest.VisualTagID.split('|'),
        ...authorizationUsersFilters.filters
      }, Constants.DB_PARAMS_MAX_LIMIT, ['userID']);
      if (!Utils.isEmptyArray(tagIDs.result)) {
        const userIDs = _.uniq(tagIDs.result.map((tag) => tag.userID));
        filteredRequest.UserID = userIDs.join('|');
      }
    }
    // Get users
    const users = await UserStorage.getUsers(req.tenant,
      {
        search: filteredRequest.Search,
        issuer: Utils.isBoolean(filteredRequest.Issuer) ? filteredRequest.Issuer : null,
        siteIDs: (filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : null),
        userIDs: (filteredRequest.UserID ? filteredRequest.UserID.split('|') : null),
        roles: (filteredRequest.Role ? filteredRequest.Role.split('|') : null),
        statuses: (filteredRequest.Status ? filteredRequest.Status.split('|') : null),
        technical: Utils.isBoolean(filteredRequest.Technical) ? filteredRequest.Technical : null,
        freeAccess: Utils.isBoolean(filteredRequest.FreeAccess) ? filteredRequest.FreeAccess : null,
        excludeSiteID: filteredRequest.ExcludeSiteID,
        ...authorizationUsersFilters.filters
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields),
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      authorizationUsersFilters.projectFields
    );
    // Assign projected fields
    if (authorizationUsersFilters.projectFields) {
      users.projectFields = authorizationUsersFilters.projectFields;
    }
    // Add Auth flags
    if (filteredRequest.WithAuth) {
      await AuthorizationService.addUsersAuthorizations(req.tenant, req.user, users as UserDataResult, authorizationUsersFilters);
    }
    return users;
  }

  private static async processUser(action: ServerAction, req: Request, importedUser: ImportedUser, usersToBeImported: ImportedUser[]): Promise<boolean> {
    try {
      const newImportedUser: ImportedUser = {
        name: importedUser.name.toUpperCase(),
        firstName: importedUser.firstName,
        email: importedUser.email,
        importedData: importedUser.importedData,
        siteIDs: importedUser.siteIDs
      };
      // Validate User data
      UserValidatorRest.getInstance().validateUserImportCreateReq(newImportedUser);
      // Set properties
      newImportedUser.importedBy = importedUser.importedBy;
      newImportedUser.importedOn = importedUser.importedOn;
      newImportedUser.status = ImportStatus.READY;
      // Save it later on
      usersToBeImported.push(newImportedUser);
      return true;
    } catch (error) {
      await Logging.logError({
        tenantID: req.tenant.id,
        module: MODULE_NAME, method: 'importUser',
        action: action,
        message: 'User cannot be imported',
        detailedMessages: { user: importedUser, error: error.stack }
      });
      return false;
    }
  }

  private static async checkBillingErrorCodes(action: ServerAction, tenant: Tenant,
      loggedUser: UserToken, user: User, errorCodes: StartTransactionErrorCode[]) {
    if (Utils.isComponentActiveFromToken(loggedUser, TenantComponents.BILLING)) {
      try {
        const billingImpl = await BillingFactory.getBillingImpl(tenant);
        if (billingImpl) {
          errorCodes.push(
            ...await billingImpl.precheckStartTransactionPrerequisites(user));
        }
      } catch (error) {
        await Logging.logError({
          tenantID: tenant.id,
          module: MODULE_NAME,
          method: 'checkBillingErrorCodes',
          action: action,
          message: `Start Transaction checks failed for ${user.id}`,
          detailedMessages: { error: error.stack }
        });
        // Billing module is ON but the settings are not set or inconsistent
        errorCodes.push(StartTransactionErrorCode.BILLING_INCONSISTENT_SETTINGS);
      }
    }
  }

  private static async checkAndDeleteUserBilling(tenant: Tenant, loggedUser: UserToken, user: User): Promise<void> {
    if (Utils.isComponentActiveFromToken(loggedUser, TenantComponents.BILLING)) {
      try {
        const billingImpl = await BillingFactory.getBillingImpl(tenant);
        if (billingImpl && user.billingData) {
          const userCanBeDeleted = await billingImpl.checkIfUserCanBeDeleted(user);
          if (!userCanBeDeleted) {
            throw new AppError({
              action: ServerAction.USER_DELETE,
              errorCode: HTTPError.BILLING_DELETE_ERROR,
              message: 'User cannot be deleted due to billing constraints',
              module: MODULE_NAME, method: 'checkAndDeleteUserBilling',
              user: loggedUser, actionOnUser: user
            });
          }
          await billingImpl.deleteUser(user);
        }
      } catch (error) {
        throw new AppError({
          action: ServerAction.USER_DELETE,
          errorCode: HTTPError.BILLING_DELETE_ERROR,
          message: 'Error occurred in billing system',
          module: MODULE_NAME, method: 'checkAndDeleteUserBilling',
          user: loggedUser, actionOnUser: user,
          detailedMessages: { error: error.stack }
        });
      }
    }
  }

  private static async checkAndDeleteUserRoaming(tenant: Tenant, loggedUser: UserToken, user: User): Promise<void> {
    // Synchronize badges with IOP (eMSP)
    if (Utils.isComponentActiveFromToken(loggedUser, TenantComponents.OCPI)) {
      try {
        const ocpiClient: EmspOCPIClient = await OCPIClientFactory.getAvailableOcpiClient(tenant, OCPIRole.EMSP) as EmspOCPIClient;
        if (ocpiClient) {
          // Get tags
          const tags = (await TagStorage.getTags(tenant,
            { userIDs: [user.id], withNbrTransactions: true }, Constants.DB_PARAMS_MAX_LIMIT)).result;
          for (const tag of tags) {
            await ocpiClient.pushToken({
              uid: tag.id,
              type: OCPIUtils.getOcpiTokenTypeFromID(tag.id),
              auth_id: tag.userID,
              visual_number: tag.visualID,
              issuer: tenant.name,
              valid: false,
              whitelist: OCPITokenWhitelist.ALLOWED_OFFLINE,
              last_updated: new Date()
            });
          }
        }
      } catch (error) {
        await Logging.logError({
          tenantID: tenant.id,
          module: MODULE_NAME,
          method: 'checkAndDeleteUserOCPI',
          action: ServerAction.USER_DELETE,
          message: `Unable to disable tokens of user ${user.id} with IOP`,
          detailedMessages: { error: error.stack }
        });
      }
    }
  }

  private static async checkAndDeleteCar(tenant: Tenant, loggedUser: UserToken, user: User) {
    // Delete cars
    if (Utils.isComponentActiveFromToken(loggedUser, TenantComponents.CAR)) {
      const cars = await CarStorage.getCars(tenant, { userIDs: [user.id] }, Constants.DB_PARAMS_MAX_LIMIT);
      if (!Utils.isEmptyArray(cars.result)) {
        for (const car of cars.result) {
          // Delete private Car
          if (car.type === CarType.PRIVATE) {
            // Delete Car
            await CarStorage.deleteCar(tenant, car.id);
          } else {
            // Clear User
            car.userID = null;
            car.default = false;
            await CarStorage.saveCar(tenant, car);
          }
        }
      }
    }
  }

  private static async syncUserAndUpdateBillingData(action: ServerAction, tenant: Tenant, loggedUser: UserToken, user: User): Promise<void> {
    if (Utils.isComponentActiveFromToken(loggedUser, TenantComponents.BILLING)) {
      const billingImpl = await BillingFactory.getBillingImpl(tenant);
      if (billingImpl) {
        try {
          // For performance reasons, the creation of a customer in the billing system should be done in a LAZY mode
          await billingImpl.synchronizeUser(user);
        } catch (error) {
          await Logging.logError({
            tenantID: tenant.id, action,
            module: MODULE_NAME, method: 'syncUserAndUpdateBillingData',
            user: loggedUser, actionOnUser: user,
            message: 'User cannot be updated in billing system',
            detailedMessages: { error: error.stack }
          });
        }
      }
    }
  }

  private static async updateUserAdminData(tenant: Tenant, user: User, projectFields: string[]) {
    // Save User Status
    if (Utils.objectHasProperty(user, 'status') &&
        projectFields.includes('status')) {
      await UserStorage.saveUserStatus(tenant, user.id, user.status);
    }
    // Save User Role
    if (Utils.objectHasProperty(user, 'role') &&
        projectFields.includes('role')) {
      await UserStorage.saveUserRole(tenant, user.id, user.role);
      // Check Admin
      if (user.role === UserRole.ADMIN) {
        await UserStorage.clearUserSiteAdmin(tenant, user.id);
      }
    }
    // Save Admin Data
    if (projectFields.includes('plateID') ||
        projectFields.includes('technical') ||
        projectFields.includes('notificationsActive') ||
        projectFields.includes('freeAccess')) {
      const adminData: { plateID?: string; notificationsActive?: boolean; notifications?: UserNotifications, technical?: boolean, freeAccess?: boolean } = {};
      if (Utils.objectHasProperty(user, 'plateID') &&
          projectFields.includes('plateID')) {
        adminData.plateID = user.plateID || null;
      }
      if (Utils.objectHasProperty(user, 'technical') &&
          projectFields.includes('technical')) {
        adminData.technical = user.technical;
      }
      if (Utils.objectHasProperty(user, 'freeAccess') &&
          projectFields.includes('freeAccess')) {
        adminData.freeAccess = user.freeAccess;
      }
      if (Utils.objectHasProperty(user, 'notificationsActive') &&
          projectFields.includes('notificationsActive')) {
        adminData.notificationsActive = user.notificationsActive;
        if (user.notifications) {
          adminData.notifications = user.notifications;
        }
      }
      // Save
      if (!Utils.isEmptyArray(Object.keys(adminData))) {
        await UserStorage.saveUserAdminData(tenant, user.id, adminData);
      }
    }
  }
}
