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
import { TechnicalSettings } from '../../../../types/Setting';
import Utils from '../../../../utils/Utils';
import UtilsService from './UtilsService';
import _ from 'lodash';

const MODULE_NAME = 'SettingService';

export default class SettingService {
  public static async handleDeleteSetting(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const settingID = SettingSecurity.filterSettingRequestByID(req.query);
    UtilsService.assertIdIsProvided(action, settingID, MODULE_NAME, 'handleDeleteSetting', req.user);
    // Check auth
    if (!await Authorizations.canDeleteSetting(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.DELETE, entity: Entity.SETTING,
        module: MODULE_NAME, method: 'handleDeleteSetting',
        value: settingID
      });
    }
    // Get
    const setting = await SettingStorage.getSetting(req.user.tenantID, settingID);
    UtilsService.assertObjectExists(action, setting, `Tenant ID '${settingID}' does not exist`,
      MODULE_NAME, 'handleDeleteSetting', req.user);
    // Delete
    await SettingStorage.deleteSetting(req.user.tenantID, settingID);
    // Log
    await Logging.logSecurityInfo({
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

  public static async handleGetSetting(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const settingID = SettingSecurity.filterSettingRequestByID(req.query);
    UtilsService.assertIdIsProvided(action, settingID, MODULE_NAME, 'handleGetSetting', req.user);
    // Check auth
    if (!await Authorizations.canReadSetting(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.READ, entity: Entity.SETTING,
        module: MODULE_NAME, method: 'handleGetSetting',
        value: settingID
      });
    }
    // Get it
    const setting = await SettingStorage.getSetting(req.user.tenantID, settingID);
    UtilsService.assertObjectExists(action, setting, `Setting ID '${settingID}' does not exist`,
      MODULE_NAME, 'handleGetSetting', req.user);
    // Process the sensitive data if any
    // Hash sensitive data before being sent to the front end
    Cypher.hashSensitiveDataInJSON(setting);
    // If Crypto Settings, hash key
    if (setting.identifier === 'crypto') {
      setting.content.crypto.key = Cypher.hash(setting.content.crypto.key);
    }
    // Return
    res.json(setting);
    next();
  }

  public static async handleGetSettingByIdentifier(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const settingID = SettingSecurity.filterSettingRequestByID(req.query);
    UtilsService.assertIdIsProvided(action, settingID, MODULE_NAME, 'handleGetSettingByIdentifier', req.user);
    // Check auth
    if (!await Authorizations.canReadSetting(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.READ, entity: Entity.SETTING,
        module: MODULE_NAME, method: 'handleGetSettingByIdentifier',
        value: settingID
      });
    }
    // Get it
    const setting = await SettingStorage.getSettingByIdentifier(req.user.tenantID, settingID);
    UtilsService.assertObjectExists(action, setting, `Setting ID '${settingID}' does not exist`,
      MODULE_NAME, 'handleGetSettingByIdentifier', req.user);
    // Process the sensitive data if any
    // Hash sensitive data before being sent to the front end
    Cypher.hashSensitiveDataInJSON(setting);
    // If Crypto Settings, hash key
    if (setting.identifier === 'crypto') {
      setting.content.crypto.key = Cypher.hash(setting.content.crypto.key);
    }
    // Return
    res.json(setting);
    next();
  }

  public static async handleGetSettings(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!await Authorizations.canListSettings(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
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
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.SortFields });
    // Process the sensitive data if any
    for (const setting of settings.result) {
      // Hash sensitive data before being sent to the front end
      Cypher.hashSensitiveDataInJSON(setting);
      // If Crypto Settings, hash key
      if (setting.identifier === 'crypto') {
        setting.content.crypto.key = Cypher.hash(setting.content.crypto.key);
      }
    }
    // Return
    res.json(settings);
    next();
  }

  public static async handleCreateSetting(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!await Authorizations.canCreateSetting(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.CREATE, entity: Entity.SETTING,
        module: MODULE_NAME, method: 'handleCreateSetting'
      });
    }
    // Filter
    const filteredRequest = SettingSecurity.filterSettingCreateRequest(req.body);
    // Process the sensitive data if any
    await Cypher.encryptSensitiveDataInJSON(req.user.tenantID, filteredRequest);
    // Update timestamp
    filteredRequest.createdBy = { 'id': req.user.id };
    filteredRequest.createdOn = new Date();
    // Save Setting
    filteredRequest.id = await SettingStorage.saveSettings(req.user.tenantID, filteredRequest);
    // Log
    await Logging.logSecurityInfo({
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
    if (!await Authorizations.canUpdateSetting(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.UPDATE, entity: Entity.SETTING,
        module: MODULE_NAME, method: 'handleUpdateSetting',
        value: settingUpdate.id
      });
    }
    // Get Setting
    const setting = await SettingStorage.getSetting(req.user.tenantID, settingUpdate.id);
    UtilsService.assertObjectExists(action, setting, `Setting ID '${settingUpdate.id}' does not exist`,
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
              _.set(settingUpdate, property, await Cypher.encrypt(req.user.tenantID, valueInRequest));
            } else {
              // No: Put back the encrypted value
              _.set(settingUpdate, property, valueInDb);
            }
          } else {
            // Value in db is empty then encrypt
            _.set(settingUpdate, property, await Cypher.encrypt(req.user.tenantID, valueInRequest));
          }
        }
      }
    } else {
      settingUpdate.sensitiveData = [];
    }
    // Update timestamp
    setting.lastChangedBy = { 'id': req.user.id };
    setting.lastChangedOn = new Date();
    if (settingUpdate.identifier === TechnicalSettings.CRYPTO) {
      // Check supported algorithm
      if (!Constants.CRYPTO_SUPPORTED_ALGORITHM.includes(
        Utils.buildCryptoAlgorithm(settingUpdate.content.crypto.keyProperties))) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.CRYPTO_ALGORITHM_NOT_SUPPORTED,
          message: 'Crypto algorithm not supported',
          module: MODULE_NAME, method: 'handleUpdateSetting',
          user: req.user
        });
      }
      // Check crypto key
      const keyLength = settingUpdate.content.crypto.keyProperties.blockSize / 8;
      if (settingUpdate.content.crypto.key.length !== keyLength) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.CRYPTO_KEY_LENGTH_INVALID,
          message: 'Crypto key length is invalid',
          module: MODULE_NAME, method: 'handleUpdateSetting',
          user: req.user
        });
      }
      // Check if config is valid
      try {
        await Cypher.checkCryptoSettings(settingUpdate.content.crypto);
      } catch (error) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.CRYPTO_CHECK_FAILED,
          message: 'Crypto check failed to run: ' + error.message,
          module: MODULE_NAME, method: 'handleUpdateSetting',
          user: req.user
        });
      }
      // Check if migration is on-going
      if (setting.content.crypto.migrationToBeDone) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.CRYPTO_MIGRATION_IN_PROGRESS,
          message: 'Crypto migration is in progress',
          module: MODULE_NAME, method: 'handleUpdateSetting',
          user: req.user
        });
      } else {
        if (Cypher.hash(settingUpdate.content.crypto.key) !== Cypher.hash(setting.content.crypto.key)) {
          settingUpdate.content.crypto.migrationToBeDone = true;
        }
        settingUpdate.content.crypto.formerKey = setting.content.crypto.key;
        settingUpdate.content.crypto.formerKeyProperties = setting.content.crypto.keyProperties;
      }
    }
    // Update Setting
    settingUpdate.id = await SettingStorage.saveSettings(req.user.tenantID, settingUpdate);
    // Crypto Setting handling
    if (settingUpdate.identifier === TechnicalSettings.CRYPTO) {
      if (settingUpdate.content.crypto.migrationToBeDone) {
        await Cypher.handleCryptoSettingsChange(req.user.tenantID);
      }
    }
    // Log
    await Logging.logSecurityInfo({
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
