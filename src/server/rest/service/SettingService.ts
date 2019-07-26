import { NextFunction, Request, Response } from 'express';
import _ from 'lodash';
import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import Authorizations from '../../../authorization/Authorizations';
import Constants from '../../../utils/Constants';
import Cypher from '../../../utils/Cypher';
import Database from '../../../utils/Database';
import Logging from '../../../utils/Logging';
import Setting from '../../../types/Setting';
import SettingSecurity from './security/SettingSecurity';
import UtilsService from './UtilsService';
import SettingStorage from '../../../storage/mongodb/SettingStorage';

export default class SettingService {
  public static async handleDeleteSetting(action: string, req: Request, res: Response, next: NextFunction) {
    // Filter
    const settingId = SettingSecurity.filterSettingDeleteRequest(req.query);
    UtilsService.assertIdIsProvided(settingId, 'SettingService', 'handleDeleteSetting', req.user);
    // Check auth
    if (!Authorizations.canDeleteSetting(req.user)) {
      // Not Authorized!
      throw new AppAuthError(
        Constants.ACTION_DELETE,
        Constants.ENTITY_SETTING,
        settingId,
        Constants.HTTP_AUTH_ERROR,
        'SettingService', 'handleDeleteSetting',
        req.user);
    }
    // Get
    const setting = await SettingStorage.getSetting(req.user.tenantID, settingId);
    UtilsService.assertObjectExists(setting, `Tenant '${settingId}' does not exist`,
    'SettingService', 'handleDeleteSetting', req.user);
    // Delete
    await SettingStorage.deleteSetting(req.user.tenantID, settingId);
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

  public static async handleGetSetting(action: string, req: Request, res: Response, next: NextFunction) {
    // Filter
    const filteredRequest = SettingSecurity.filterSettingRequest(req.query);
    UtilsService.assertIdIsProvided(filteredRequest.ID, 'SettingService', 'handleGetSetting', req.user);
    if(!Authorizations.canReadSetting(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_READ,
        Constants.ENTITY_SETTING,
        filteredRequest.ID,
        Constants.HTTP_AUTH_ERROR,
        'SettingService', 'handleGetSetting',
        req.user);
    }
    // Get it
    const setting = await SettingStorage.getSetting(req.user.tenantID, filteredRequest.ID);
    UtilsService.assertObjectExists(setting, `Setting '${filteredRequest.ID}' doesn't exist.`, 'SettingService', 'handleGetSetting', req.user);
    // Process the sensitive data if any
    // Hash sensitive data before being sent to the front end
    Cypher.hashSensitiveDataInJSON(setting);
    // Return
    res.json(
      // Filter
      SettingSecurity.filterSettingResponse(
        setting, req.user)
    );
    next();
  }

  public static async handleGetSettings(action: string, req: Request, res: Response, next: NextFunction) {
    // Check auth
    if (!Authorizations.canListSettings(req.user)) {
      // Not Authorized!
      throw new AppAuthError(
        Constants.ACTION_LIST,
        Constants.ENTITY_SETTINGS,
        null,
        Constants.HTTP_AUTH_ERROR,
        'SettingService', 'handleGetSettings',
        req.user);
    }
    // Filter
    const filteredRequest = SettingSecurity.filterSettingsRequest(req.query);
    // Get the all settings identifier
    const settings = await SettingStorage.getSettings(req.user.tenantID, { 'identifier': filteredRequest.Identifier },
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort });
    // Filter
    settings.result = SettingSecurity.filterSettingsResponse(
      settings.result, req.user);
    // Process the sensitive data if any
    settings.result.forEach((setting) => {
      // Hash sensitive data before being sent to the front end
      Cypher.hashSensitiveDataInJSON(setting);
    });
    // Return
    res.json(settings);
    next();
  }

  public static async handleCreateSetting(action: string, req: Request, res: Response, next: NextFunction) {
    // Check auth
    if (!Authorizations.canCreateSetting(req.user)) {
      // Not Authorized!
      throw new AppAuthError(
        Constants.ACTION_CREATE,
        Constants.ENTITY_SETTING,
        null,
        Constants.HTTP_AUTH_ERROR,
        'SettingService', 'handleCreateSetting',
        req.user);
    }
    // Filter
    const filteredRequest = SettingSecurity.filterSettingCreateRequest(req.body);
    UtilsService.assertIdIsProvided(filteredRequest.id, 'SettingService', 'handleCreateSetting', req.user);
    // Process the sensitive data if any
    Cypher.encryptSensitiveDataInJSON(filteredRequest);
    // Update timestamp
    filteredRequest.createdBy = { 'id': req.user.id };
    filteredRequest.createdOn = new Date();
    // Save Setting
    filteredRequest.id = await SettingStorage.saveSetting(req.user.tenantID, filteredRequest);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: 'SettingService', method: 'handleCreateSetting',
      message: `Setting '${filteredRequest.identifier}' has been created successfully`,
      action: action, detailedMessages: filteredRequest
    });
    // Ok
    res.json(Object.assign({ id: filteredRequest.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleUpdateSetting(action: string, req: Request, res: Response, next: NextFunction) {
    // Filter
    const filteredRequest = SettingSecurity.filterSettingUpdateRequest(req.body);
    // Check auth
    if (!Authorizations.canUpdateSetting(req.user)) {
      // Not Authorized!
      throw new AppAuthError(
        Constants.ACTION_UPDATE,
        Constants.ENTITY_SETTING,
        filteredRequest.id,
        Constants.HTTP_AUTH_ERROR,
        'SettingService', 'handleUpdateSetting',
        req.user);
    }
    // Get Setting
    const setting = await SettingStorage.getSetting(req.user.tenantID, filteredRequest.id);
    if (!setting) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The Setting with ID '${filteredRequest.id}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'SettingService', 'handleUpdateSetting', req.user);
    }
    // Check Mandatory fields
    Setting.checkIfSettingValid(filteredRequest, req);
    // Process the sensitive data if any
    // Preprocess the data to take care of updated values
    if (filteredRequest.sensitiveData) {
      if (!Array.isArray(filteredRequest.sensitiveData)) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The property 'sensitiveData' for Setting with ID '${filteredRequest.id}' is not an array`,
          Constants.HTTP_CYPHER_INVALID_SENSITIVE_DATA_ERROR,
          'SettingService', 'handleUpdateSetting', req.user);
      }
      // Process sensitive properties
      for (const property of filteredRequest.sensitiveData) {
        // Get the sensitive property from the request
        const valueInRequest = _.get(filteredRequest, property);
        if (valueInRequest && valueInRequest.length > 0) {
          // Get the sensitive property from the DB
          const valueInDb = _.get(setting.getModel(), property);
          if (valueInDb && valueInDb.length > 0) {
            const hashedValueInDB = Cypher.hash(valueInDb);
            if (valueInRequest !== hashedValueInDB) {
              // Yes: Encrypt
              _.set(filteredRequest, property, Cypher.encrypt(valueInRequest));
            } else {
              // No: Put back the encrypted value
              _.set(filteredRequest, property, valueInDb);
            }
          } else {
            // Value in db is empty then encrypt
            _.set(filteredRequest, property, Cypher.encrypt(valueInRequest));
          }
        }
      }
    }
    // Update
    Database.updateSetting(filteredRequest, setting.getModel());
    // Update timestamp
    setting.setLastChangedBy({ 'id': req.user.id });
    setting.setLastChangedOn(new Date());
    // Update Setting
    const updatedSetting = await setting.save();
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: 'SettingService', method: 'handleUpdateSetting',
      message: `Setting '${updatedSetting.getIdentifier()}' has been updated successfully`,
      action: action, detailedMessages: updatedSetting
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  private static _checkIfSettingValid(filteredRequest: Partial<Setting>, req: Request) {
    // Update model?
    if (req.method !== 'POST' && !filteredRequest.id) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'Setting ID is mandatory', Constants.HTTP_GENERAL_ERROR,
        'Setting', 'checkIfSettingValid',
        req.user.id);
    }
  }
}
