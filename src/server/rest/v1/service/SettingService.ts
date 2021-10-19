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
import SettingValidator from '../validator/SettingValidator';
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
    const setting = await SettingStorage.getSetting(req.tenant, settingID);
    UtilsService.assertObjectExists(action, setting, `Tenant ID '${settingID}' does not exist`,
      MODULE_NAME, 'handleDeleteSetting', req.user);
    // Delete
    await SettingStorage.deleteSetting(req.tenant, settingID);
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
    const setting = await SettingStorage.getSetting(req.tenant, settingID);
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
    const setting = await SettingStorage.getSettingByIdentifier(req.tenant, settingID);
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
    const settings = await SettingStorage.getSettings(req.tenant,
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
    await Cypher.encryptSensitiveDataInJSON(req.tenant, filteredRequest);
    // Update timestamp
    filteredRequest.createdBy = { 'id': req.user.id };
    filteredRequest.createdOn = new Date();
    // Save Setting
    filteredRequest.id = await SettingStorage.saveSettings(req.tenant, filteredRequest);
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
    let filteredRequest: any;
    UtilsService.assertIdIsProvided(action, req.body.id, MODULE_NAME, 'handleUpdateSetting', req.user);
    switch (req.body.identifier) {
      // Filter
      case TechnicalSettings.OCPI:
        filteredRequest = SettingValidator.getInstance().validateSettingOCPISetReq(req.body);
        break;
      case TechnicalSettings.CRYPTO:
        filteredRequest = SettingValidator.getInstance().validateSettingCryptoSetReq(req.body);
        break;
      case TechnicalSettings.USER:
        filteredRequest = SettingValidator.getInstance().validateSettingUserSetReq(req.body);
        break;
      case TechnicalSettings.SMART_CHARGING:
        filteredRequest = SettingValidator.getInstance().validateSettingSmartChargingSetReq(req.body);
        break;
      case TechnicalSettings.REFUND:
        filteredRequest = SettingValidator.getInstance().validateSettingRefundSetReq(req.body);
        break;
      case TechnicalSettings.PRICING:
        filteredRequest = SettingValidator.getInstance().validateSettingPricingSetReq(req.body);
        break;
      default:
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.NOT_IMPLEMENTED_ERROR,
          message: `The property 'identifier' with value '${req.body.identifier as string}' for Setting with ID '${req.body.id as string}' is not implemented`,
          module: MODULE_NAME,
          method: 'handleUpdateSetting',
          user: req.user
        });
    }
    // TODO : Check for each Setting Type that we do have equivalent results
    const settingUpdate = SettingSecurity.filterSettingUpdateRequest(req.body);
    // Check auth
    if (!await Authorizations.canUpdateSetting(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.UPDATE, entity: Entity.SETTING,
        module: MODULE_NAME, method: 'handleUpdateSetting',
        value: filteredRequest.id
      });
    }
    // Get Setting
    const setting = await SettingStorage.getSetting(req.tenant, filteredRequest.id);
    UtilsService.assertObjectExists(action, setting, `Setting ID '${filteredRequest.id as string}' does not exist`,
      MODULE_NAME, 'handleUpdateSetting', req.user);
    // Process the sensitive data if any
    // Preprocess the data to take care of updated values
    if (filteredRequest.sensitiveData) {
      if (!Array.isArray(filteredRequest.sensitiveData)) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.CYPHER_INVALID_SENSITIVE_DATA_ERROR,
          message: `The property 'sensitiveData' for Setting with ID '${filteredRequest.id as string}' is not an array`,
          module: MODULE_NAME,
          method: 'handleUpdateSetting',
          user: req.user
        });
      }
      // Process sensitive properties
      for (const property of filteredRequest.sensitiveData) {
        // Get the sensitive property from the request
        const valueInRequest = _.get(filteredRequest, property);
        if (valueInRequest && valueInRequest.length > 0) {
          // Get the sensitive property from the DB
          const valueInDb = _.get(setting, property);
          if (valueInDb && valueInDb.length > 0) {
            const hashedValueInDB = Cypher.hash(valueInDb);
            if (valueInRequest !== hashedValueInDB) {
              // Yes: Encrypt
              _.set(filteredRequest, property, await Cypher.encrypt(req.tenant, valueInRequest));
            } else {
              // No: Put back the encrypted value
              _.set(filteredRequest, property, valueInDb);
            }
          } else {
            // Value in db is empty then encrypt
            _.set(filteredRequest, property, await Cypher.encrypt(req.tenant, valueInRequest));
          }
        }
      }
    } else {
      filteredRequest.sensitiveData = [];
    }
    // Update timestamp
    setting.lastChangedBy = { 'id': req.user.id };
    setting.lastChangedOn = new Date();
    if (filteredRequest.identifier === TechnicalSettings.CRYPTO) {
      // Check supported algorithm
      if (!Constants.CRYPTO_SUPPORTED_ALGORITHM.includes(
        Utils.buildCryptoAlgorithm(filteredRequest.content.crypto.keyProperties))) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.CRYPTO_ALGORITHM_NOT_SUPPORTED,
          message: 'Crypto algorithm not supported',
          module: MODULE_NAME, method: 'handleUpdateSetting',
          user: req.user
        });
      }
      // Check crypto key
      const keyLength = filteredRequest.content.crypto.keyProperties.blockSize / 8;
      if (filteredRequest.content.crypto.key.length !== keyLength) {
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
        await Cypher.checkCryptoSettings(filteredRequest.content.crypto);
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
        if (Cypher.hash(filteredRequest.content.crypto.key) !== Cypher.hash(setting.content.crypto.key)) {
          filteredRequest.content.crypto.migrationToBeDone = true;
        }
        filteredRequest.content.crypto.formerKey = setting.content.crypto.key;
        filteredRequest.content.crypto.formerKeyProperties = setting.content.crypto.keyProperties;
      }
    }
    // Update Setting
    filteredRequest.id = await SettingStorage.saveSettings(req.tenant, filteredRequest);
    // Crypto Setting handling
    if (filteredRequest.identifier === TechnicalSettings.CRYPTO) {
      if (filteredRequest.content.crypto.migrationToBeDone) {
        await Cypher.handleCryptoSettingsChange(req.tenant);
      }
    }
    // Log
    await Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleUpdateSetting',
      message: `Setting '${filteredRequest.id as string}' has been updated successfully`,
      action: action,
      detailedMessages: { filteredRequest }
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }
}
