import { Action, Entity } from '../../../types/Authorization';
import { HTTPAuthError, HTTPError } from '../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';
import HttpStatusCodes from 'http-status-codes';
import _ from 'lodash';
import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import Authorizations from '../../../authorization/Authorizations';
import Constants from '../../../utils/Constants';
import Cypher from '../../../utils/Cypher';
import Logging from '../../../utils/Logging';
import SettingSecurity from './security/SettingSecurity';
import SettingStorage from '../../../storage/mongodb/SettingStorage';
import UtilsService from './UtilsService';

export default class SettingService {
  public static async handleDeleteSetting(action: Action, req: Request, res: Response, next: NextFunction) {
    // Filter
    const settingID = SettingSecurity.filterSettingRequestByID(req.query);
    UtilsService.assertIdIsProvided(settingID, 'SettingService', 'handleDeleteSetting', req.user);
    // Check auth
    if (!Authorizations.canDeleteSetting(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.DELETE,
        entity: Entity.SETTING,
        module: 'SettingService',
        method: 'handleDeleteSetting',
        value: settingID
      });
    }
    // Get
    const setting = await SettingStorage.getSetting(req.user.tenantID, settingID);
    UtilsService.assertObjectExists(setting, `Tenant with ID '${settingID}' does not exist`, 'SettingService', 'handleDeleteSetting', req.user);
    // Delete
    await SettingStorage.deleteSetting(req.user.tenantID, settingID);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: 'SettingService', method: 'handleDeleteSetting',
      message: `Setting '${setting.identifier}' has been deleted successfully`,
      action: action, detailedMessages: setting
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetSetting(action: Action, req: Request, res: Response, next: NextFunction) {
    // Filter
    const settingID = SettingSecurity.filterSettingRequestByID(req.query);
    UtilsService.assertIdIsProvided(settingID, 'SettingService', 'handleGetSetting', req.user);
    // Check auth
    if (!Authorizations.canReadSetting(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ,
        entity: Entity.SETTING,
        module: 'SettingService',
        method: 'handleGetSetting',
        value: settingID
      });
    }
    // Get it
    const setting = await SettingStorage.getSetting(req.user.tenantID, settingID);
    UtilsService.assertObjectExists(setting, `Setting with ID '${settingID}' does not exist`, 'SettingService', 'handleGetSetting', req.user);
    // Process the sensitive data if any
    // Hash sensitive data before being sent to the front end
    Cypher.hashSensitiveDataInJSON(setting);
    // Return
    res.json(
      // Filter
      SettingSecurity.filterSettingResponse(setting, req.user)
    );
    next();
  }

  public static async handleGetSettings(action: Action, req: Request, res: Response, next: NextFunction) {
    // Check auth
    if (!Authorizations.canListSettings(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.SETTINGS,
        module: 'SettingService',
        method: 'handleGetSettings'
      });
    }
    // Filter
    const filteredRequest = SettingSecurity.filterSettingsRequest(req.query);
    // Get the all settings identifier
    const settings = await SettingStorage.getSettings(req.user.tenantID,
      { identifier: filteredRequest.Identifier },
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort });
    settings.result = settings.result.map((setting) => setting);
    // Filter
    settings.result = SettingSecurity.filterSettingsResponse(settings.result, req.user);
    // Process the sensitive data if any
    settings.result.forEach((setting) => {
      // Hash sensitive data before being sent to the front end
      Cypher.hashSensitiveDataInJSON(setting);
    });
    // Return
    res.json(settings);
    next();
  }

  public static async handleCreateSetting(action: Action, req: Request, res: Response, next: NextFunction) {
    // Check auth
    if (!Authorizations.canCreateSetting(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.CREATE,
        entity: Entity.SETTING,
        module: 'SettingService',
        method: 'handleCreateSetting'
      });
    }
    // Filter
    const filteredRequest = SettingSecurity.filterSettingCreateRequest(req.body);
    // Process the sensitive data if any
    Cypher.encryptSensitiveDataInJSON(filteredRequest);
    // Update timestamp
    filteredRequest.createdBy = { 'id': req.user.id };
    filteredRequest.createdOn = new Date();
    // Save Setting
    filteredRequest.id = await SettingStorage.saveSettings(req.user.tenantID, filteredRequest);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: 'SettingService', method: 'handleCreateSetting',
      message: `Setting '${filteredRequest.identifier}' has been created successfully`,
      action: action, detailedMessages: filteredRequest
    });
    // Ok
    res.status(HttpStatusCodes.OK).json(Object.assign({ id: filteredRequest.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleUpdateSetting(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const settingUpdate = SettingSecurity.filterSettingUpdateRequest(req.body);
    UtilsService.assertIdIsProvided(settingUpdate.id, 'SettingService', 'handleUpdateSetting', req.user);
    // Check auth
    if (!Authorizations.canUpdateSetting(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE,
        entity: Entity.SETTING,
        module: 'SettingService',
        method: 'handleUpdateSetting',
        value: settingUpdate.id
      });
    }
    // Get Setting
    const setting = await SettingStorage.getSetting(req.user.tenantID, settingUpdate.id);
    UtilsService.assertObjectExists(setting, `Setting with ID '${settingUpdate.id}' does not exist anymore`,
      'SettingService', 'handleUpdateSetting', req.user);
    // Process the sensitive data if any
    // Preprocess the data to take care of updated values
    if (settingUpdate.sensitiveData) {
      if (!Array.isArray(settingUpdate.sensitiveData)) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.CYPHER_INVALID_SENSITIVE_DATA_ERROR,
          message: `The property 'sensitiveData' for Setting with ID '${settingUpdate.id}' is not an array`,
          module: 'SettingService',
          method: 'handleUpdateSetting',
          user: req.user
        });
      }
      // Process sensitive properties
      for (const property of settingUpdate.sensitiveData) {
        // Get the sensitive property from the request
        const valueInRequest = _.get(settingUpdate, property);
        if (valueInRequest && valueInRequest.length > 0) {
          // Get the sensitive property from the DB
          const valueInDb = _.get(setting, property);
          if (valueInDb && valueInDb.length > 0) {
            const hashedValueInDB = Cypher.hash(valueInDb);
            if (valueInRequest !== hashedValueInDB) {
              // Yes: Encrypt
              _.set(settingUpdate, property, Cypher.encrypt(valueInRequest));
            } else {
              // No: Put back the encrypted value
              _.set(settingUpdate, property, valueInDb);
            }
          } else {
            // Value in db is empty then encrypt
            _.set(settingUpdate, property, Cypher.encrypt(valueInRequest));
          }
        }
      }
    } else {
      settingUpdate.sensitiveData = [];
    }
    // Update timestamp
    setting.lastChangedBy = { 'id': req.user.id };
    setting.lastChangedOn = new Date();
    // Update Setting
    settingUpdate.id = await SettingStorage.saveSettings(req.user.tenantID, settingUpdate);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: 'SettingService', method: 'handleUpdateSetting',
      message: `Setting '${settingUpdate.id}' has been updated successfully`,
      action: action, detailedMessages: settingUpdate
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }
}
