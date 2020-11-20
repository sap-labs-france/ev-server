import { Action, Entity } from '../../../../types/Authorization';
import { HTTPAuthError, HTTPError } from '../../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';

import AppAuthError from '../../../../exception/AppAuthError';
import AppError from '../../../../exception/AppError';
import Authorizations from '../../../../authorization/Authorizations';
import Constants from '../../../../utils/Constants';
import Cypher from '../../../../utils/Cypher';
import Logging from '../../../../utils/Logging';
import { ServerAction } from '../../../../types/Server';
import SettingSecurity from './security/SettingSecurity';
import SettingStorage from '../../../../storage/mongodb/SettingStorage';
import { StatusCodes } from 'http-status-codes';
import UtilsService from './UtilsService';
import _ from 'lodash';

const MODULE_NAME = 'SettingService';

export default class SettingService {
  public static async handleDeleteSetting(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Filter
    const settingID = SettingSecurity.filterSettingRequestByID(req.query);
    UtilsService.assertIdIsProvided(action, settingID, MODULE_NAME, 'handleDeleteSetting', req.user);
    // Check auth
    if (!Authorizations.canDeleteSetting(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.DELETE, entity: Entity.SETTING,
        module: MODULE_NAME, method: 'handleDeleteSetting',
        value: settingID
      });
    }
    // Get
    const setting = await SettingStorage.getSetting(req.user.tenantID, settingID);
    UtilsService.assertObjectExists(action, setting, `Tenant with ID '${settingID}' does not exist`,
      MODULE_NAME, 'handleDeleteSetting', req.user);
    // Delete
    await SettingStorage.deleteSetting(req.user.tenantID, settingID);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleDeleteSetting',
      message: `Setting '${setting.identifier}' has been deleted successfully`,
      action: action,
      detailedMessages: { setting }
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetSetting(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Filter
    const settingID = SettingSecurity.filterSettingRequestByID(req.query);
    UtilsService.assertIdIsProvided(action, settingID, MODULE_NAME, 'handleGetSetting', req.user);
    // Check auth
    if (!Authorizations.canReadSetting(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ, entity: Entity.SETTING,
        module: MODULE_NAME, method: 'handleGetSetting',
        value: settingID
      });
    }
    // Get it
    const setting = await SettingStorage.getSetting(req.user.tenantID, settingID);
    UtilsService.assertObjectExists(action, setting, `Setting with ID '${settingID}' does not exist`,
      MODULE_NAME, 'handleGetSetting', req.user);
    // Process the sensitive data if any
    // Hash sensitive data before being sent to the front end
    Cypher.hashSensitiveDataInJSON(setting);
    // Return
    res.json(setting);
    next();
  }

  public static async handleGetSettings(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check auth
    if (!Authorizations.canListSettings(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST, entity: Entity.SETTINGS,
        module: MODULE_NAME, method: 'handleGetSettings'
      });
    }
    // Filter
    const filteredRequest = SettingSecurity.filterSettingsRequest(req.query);
    // Get the all settings identifier
    const settings = await SettingStorage.getSettings(req.user.tenantID,
      { identifier: filteredRequest.Identifier },
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort });
    // Process the sensitive data if any
    settings.result.forEach((setting) => {
      // Hash sensitive data before being sent to the front end
      Cypher.hashSensitiveDataInJSON(setting);
    });
    // Return
    res.json(settings);
    next();
  }

  public static async handleCreateSetting(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check auth
    if (!Authorizations.canCreateSetting(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.CREATE, entity: Entity.SETTING,
        module: MODULE_NAME, method: 'handleCreateSetting'
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
      user: req.user, module: MODULE_NAME, method: 'handleCreateSetting',
      message: `Setting '${filteredRequest.identifier}' has been created successfully`,
      action: action,
      detailedMessages: { params: filteredRequest }
    });
    // Ok
    res.status(StatusCodes.OK).json(Object.assign({ id: filteredRequest.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleUpdateSetting(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const settingUpdate = SettingSecurity.filterSettingUpdateRequest(req.body);
    UtilsService.assertIdIsProvided(action, settingUpdate.id, MODULE_NAME, 'handleUpdateSetting', req.user);
    // Check auth
    if (!Authorizations.canUpdateSetting(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE, entity: Entity.SETTING,
        module: MODULE_NAME, method: 'handleUpdateSetting',
        value: settingUpdate.id
      });
    }
    // Get Setting
    const setting = await SettingStorage.getSetting(req.user.tenantID, settingUpdate.id);
    UtilsService.assertObjectExists(action, setting, `Setting with ID '${settingUpdate.id}' does not exist`,
      MODULE_NAME, 'handleUpdateSetting', req.user);
    // Process the sensitive data if any
    // Preprocess the data to take care of updated values
    if (settingUpdate.sensitiveData) {
      if (!Array.isArray(settingUpdate.sensitiveData)) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.CYPHER_INVALID_SENSITIVE_DATA_ERROR,
          message: `The property 'sensitiveData' for Setting with ID '${settingUpdate.id}' is not an array`,
          module: MODULE_NAME,
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
      user: req.user, module: MODULE_NAME, method: 'handleUpdateSetting',
      message: `Setting '${settingUpdate.id}' has been updated successfully`,
      action: action,
      detailedMessages: { settingUpdate }
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }
}
