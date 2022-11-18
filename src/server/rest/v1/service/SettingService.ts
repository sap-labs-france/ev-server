import { IntegrationSettings, PricingSettingsType, SettingDB, TechnicalSettings } from '../../../../types/Setting';
import { NextFunction, Request, Response } from 'express';

import { Action } from '../../../../types/Authorization';
import AppError from '../../../../exception/AppError';
import AuthorizationService from './AuthorizationService';
import Constants from '../../../../utils/Constants';
import Cypher from '../../../../utils/Cypher';
import { HTTPError } from '../../../../types/HTTPError';
import Logging from '../../../../utils/Logging';
import { ServerAction } from '../../../../types/Server';
import SettingStorage from '../../../../storage/mongodb/SettingStorage';
import SettingValidatorRest from '../validator/SettingValidatorRest';
import { StatusCodes } from 'http-status-codes';
import { TenantComponents } from '../../../../types/Tenant';
import Utils from '../../../../utils/Utils';
import UtilsService from './UtilsService';
import _ from 'lodash';

const MODULE_NAME = 'SettingService';

export default class SettingService {
  public static async handleDeleteSetting(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const settingID = SettingValidatorRest.getInstance().validateSettingDeleteReq(req.query).ID;
    // Get
    const setting = await UtilsService.checkAndGetSettingAuthorization(req.tenant, req.user, settingID, Action.DELETE, action);
    // Delete
    await SettingStorage.deleteSetting(req.tenant, settingID);
    // Log
    await Logging.logInfo({
      tenantID: req.tenant.id,
      user: req.user, module: MODULE_NAME, method: 'handleDeleteSetting',
      message: `Setting '${setting.identifier}' has been deleted successfully`,
      action: action,
      detailedMessages: { setting }
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetSetting(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const settingID = SettingValidatorRest.getInstance().validateSettingGetReq(req.query).ID;
    // Get it
    const setting = await UtilsService.checkAndGetSettingAuthorization(req.tenant, req.user, settingID, Action.READ, action, {}, {}, true);
    // Process the sensitive data if any
    SettingService.hashSensitiveData(setting);
    res.json(setting);
    next();
  }

  public static async handleGetSettingByIdentifier(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const settingID = SettingValidatorRest.getInstance().validateSettingGetByIdentifierReq(req.query).Identifier;
    // Get it
    const setting = await UtilsService.checkAndGetSettingAuthorization(req.tenant, req.user, settingID, Action.READ, action, {}, { identifier: settingID }, true);
    // Process the sensitive data if any
    SettingService.hashSensitiveData(setting);
    res.json(setting);
    next();
  }

  public static async handleGetSettings(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = SettingValidatorRest.getInstance().validateSettingsGetReq(req.query);
    // Get authorization filters
    const authorizations = await AuthorizationService.checkAndGetSettingsAuthorizations(req.tenant, req.user, Action.LIST, filteredRequest, false);
    if (!authorizations.authorized) {
      UtilsService.sendEmptyDataResult(res, next);
    }
    // Get the settings
    const settings = await SettingStorage.getSettings(req.tenant,
      {
        identifier: filteredRequest.Identifier,
        ...authorizations.filters
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.SortFields
      },
      authorizations.projectFields
    );
    // Assign projected fields
    if (authorizations.projectFields) {
      settings.projectFields = authorizations.projectFields;
    }
    // Add Auth flags
    await AuthorizationService.addSettingsAuthorizations(req.tenant, req.user, settings, authorizations, filteredRequest);
    // Process the sensitive data if any
    for (const setting of settings.result) {
      // Process the sensitive data if any
      SettingService.hashSensitiveData(setting);
    }
    res.json(settings);
    next();
  }

  public static async handleCreateSetting(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = SettingService.filterSetting(action, req);
    // Check auth
    await AuthorizationService.checkAndGetSettingAuthorizations(req.tenant,req.user, {}, Action.CREATE, filteredRequest);
    // Process the sensitive data if any
    await Cypher.encryptSensitiveDataInJSON(req.tenant, filteredRequest);
    // Update timestamp
    filteredRequest.createdBy = { 'id': req.user.id };
    filteredRequest.createdOn = new Date();
    // Save Setting
    filteredRequest.id = await SettingStorage.saveSettings(req.tenant, filteredRequest);
    // Log
    await Logging.logInfo({
      tenantID: req.tenant.id,
      user: req.user, module: MODULE_NAME, method: 'handleCreateSetting',
      message: `Setting '${filteredRequest.identifier}' has been created successfully`,
      action: action,
      detailedMessages: { params: filteredRequest }
    });
    res.status(StatusCodes.OK).json(Object.assign({ id: filteredRequest.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleUpdateSetting(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = SettingService.filterSetting(action, req);
    // Get Setting
    const setting = await UtilsService.checkAndGetSettingAuthorization(req.tenant, req.user, filteredRequest.id, Action.UPDATE, action, {}, {}, true);
    // Process the sensitive data if any
    // Preprocess the data to take care of updated values
    if (filteredRequest.sensitiveData) {
      if (!Array.isArray(filteredRequest.sensitiveData)) {
        throw new AppError({
          errorCode: HTTPError.CYPHER_INVALID_SENSITIVE_DATA_ERROR,
          message: `The property 'sensitiveData' for Setting with ID '${filteredRequest.id}' is not an array`,
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
            const hashedValueInDB = Utils.hash(valueInDb);
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
          errorCode: HTTPError.CRYPTO_CHECK_FAILED,
          message: 'Crypto check failed to run: ' + error.message,
          module: MODULE_NAME, method: 'handleUpdateSetting',
          user: req.user
        });
      }
      // Check if migration is on-going
      if (setting.content.crypto.migrationToBeDone) {
        throw new AppError({
          errorCode: HTTPError.CRYPTO_MIGRATION_IN_PROGRESS,
          message: 'Crypto migration is in progress',
          module: MODULE_NAME, method: 'handleUpdateSetting',
          user: req.user
        });
      } else {
        if (Utils.hash(filteredRequest.content.crypto.key) !== Utils.hash(setting.content.crypto.key)) {
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
    await Logging.logInfo({
      tenantID: req.tenant.id,
      user: req.user, module: MODULE_NAME, method: 'handleUpdateSetting',
      message: `Setting '${filteredRequest.id}' has been updated successfully`,
      action: action,
      detailedMessages: { filteredRequest }
    });
    // Pricing Checks on Currency Modification
    if (filteredRequest.identifier === TenantComponents.PRICING
      && setting.content?.type === PricingSettingsType.SIMPLE
      && setting.content?.simple.currency !== filteredRequest.content?.simple?.currency) {
      // Force a user logout
      throw new AppError({
        errorCode: HTTPError.TENANT_COMPONENT_CHANGED,
        message: 'Pricing Settings - Currency has been updated. A log out is necessary to benefit from the changes',
        module: MODULE_NAME, method: 'handleUpdateSetting',
        user: req.user
      });
    }
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  private static filterSetting(action: ServerAction, req: Request): SettingDB {
    switch (req.body.identifier) {
      // Filter
      case IntegrationSettings.OCPI:
        return SettingValidatorRest.getInstance().validateSettingOCPISetReq(req.body);
      case IntegrationSettings.OICP:
        return SettingValidatorRest.getInstance().validateSettingOICPSetReq(req.body);
      case TechnicalSettings.CRYPTO:
        return SettingValidatorRest.getInstance().validateSettingCryptoSetReq(req.body);
      case TechnicalSettings.USER:
        return SettingValidatorRest.getInstance().validateSettingUserSetReq(req.body);
      case IntegrationSettings.SMART_CHARGING:
        return SettingValidatorRest.getInstance().validateSettingSmartChargingSetReq(req.body);
      case IntegrationSettings.REFUND:
        return SettingValidatorRest.getInstance().validateSettingRefundSetReq(req.body);
      case IntegrationSettings.PRICING:
        return SettingValidatorRest.getInstance().validateSettingPricingSetReq(req.body);
      case IntegrationSettings.ANALYTICS:
        return SettingValidatorRest.getInstance().validateSettingAnalyticsSetReq(req.body);
      case IntegrationSettings.ASSET:
        return SettingValidatorRest.getInstance().validateSettingAssetSetReq(req.body);
      case IntegrationSettings.CAR_CONNECTOR:
        return SettingValidatorRest.getInstance().validateSettingCarConnectorSetReq(req.body);
      case IntegrationSettings.BILLING:
        return SettingValidatorRest.getInstance().validateSettingBillingSetReq(req.body);
      case IntegrationSettings.BILLING_PLATFORM:
        return SettingValidatorRest.getInstance().validateSettingBillingPlatformSetReq(req.body);
      case IntegrationSettings.CAR:
        return SettingValidatorRest.getInstance().validateSettingCarSetReq(req.body);
      case IntegrationSettings.ORGANIZATION:
        return SettingValidatorRest.getInstance().validateSettingOrganizationSetReq(req.body);
      case IntegrationSettings.STATISTICS:
        return SettingValidatorRest.getInstance().validateSettingStatisticsSetReq(req.body);
      default:
        throw new AppError({
          module: MODULE_NAME,
          method: 'filterSetting',
          action,
          message: `Unknown setting ${req.body.identifier as string}`,
          detailedMessages: { setting: req.body },
          errorCode: HTTPError.GENERAL_ERROR
        });
    }
  }

  private static hashSensitiveData(setting: SettingDB): void {
    // Hash sensitive data before being sent to the front end
    Cypher.hashSensitiveDataInJSON(setting);
    // If Crypto Settings, hash key
    if (setting.identifier === 'crypto') {
      setting.content.crypto.key = Utils.hash(setting.content.crypto.key);
    }
  }
}
