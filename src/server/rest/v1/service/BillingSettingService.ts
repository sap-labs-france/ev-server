import { Action, Entity } from '../../../../types/Authorization';
import { HTTPAuthError, HTTPError } from '../../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';

import AppAuthError from '../../../../exception/AppAuthError';
import AppError from '../../../../exception/AppError';
import Authorizations from '../../../../authorization/Authorizations';
import BackendError from '../../../../exception/BackendError';
import BillingSettingStorage from '../../../../storage/mongodb/BillingSettingStorage';
import { BillingSettings } from '../../../../types/Setting';
import Constants from '../../../../utils/Constants';
import Cypher from '../../../../utils/Cypher';
import { ServerAction } from '../../../../types/Server';
import { StatusCodes } from 'http-status-codes';
import UtilsService from './UtilsService';
import _ from 'lodash';

const MODULE_NAME = 'BillingSettingService';

export default class BillingSettingService {

  public static async handleGetBillingSettings(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!await Authorizations.canListSettings(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.READ, entity: Entity.SETTING,
        module: MODULE_NAME, method: 'handleGetBillingSetting',
      });
    }
    const allBillingSettings: BillingSettings[] = await BillingSettingStorage.getBillingSettings(req.user.tenantID);
    if (allBillingSettings) {
      allBillingSettings.map((billingSettings) => BillingSettingService.hashSensitiveData(req.user.tenantID, billingSettings));
      res.json(allBillingSettings);
    } else {
      res.sendStatus(StatusCodes.NOT_FOUND);
    }
    next();
  }

  public static async handleGetBillingSetting(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!await Authorizations.canReadSetting(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.READ, entity: Entity.SETTING,
        module: MODULE_NAME, method: 'handleGetBillingSetting',
      });
    }
    const settingID = req.params.id;
    const billingSettings: BillingSettings = await BillingSettingStorage.getBillingSetting(req.user.tenantID, settingID);
    if (billingSettings) {
      _.set(billingSettings, 'sk-enc', billingSettings.stripe.secretKey);
      _.set(billingSettings, 'sk-ori', await Cypher.decrypt(req.user.tenantID, billingSettings.stripe.secretKey));
      BillingSettingService.hashSensitiveData(req.user.tenantID, billingSettings);
      res.json(billingSettings);
    } else {
      res.sendStatus(StatusCodes.NOT_FOUND);
    }
    next();
  }

  public static async handleUpdateBillingSetting(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    // TODO - sanitize it
    const newBillingSettings = req.body as BillingSettings;
    newBillingSettings.id = req.params.id;
    UtilsService.assertIdIsProvided(action, newBillingSettings.id, MODULE_NAME, 'handleUpdateSetting', req.user);
    if (!await Authorizations.canUpdateSetting(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.UPDATE, entity: Entity.SETTING,
        module: MODULE_NAME, method: 'handleUpdateBillingSetting',
      });
    }
    // Load previous settings
    const billingSettings = await BillingSettingStorage.getBillingSetting(req.user.tenantID, newBillingSettings.id);
    await BillingSettingService.alterSensitiveData(req.user.tenantID, billingSettings, newBillingSettings);
    // Now populates the settings with the new values
    billingSettings.id = newBillingSettings.id;
    billingSettings.type = newBillingSettings.type;
    billingSettings.billing = newBillingSettings.billing;
    billingSettings.stripe = newBillingSettings.stripe;
    // Update timestamp
    billingSettings.lastChangedBy = { 'id': req.user.id };
    billingSettings.lastChangedOn = new Date();
    // Let's save it
    const id = await BillingSettingStorage.saveBillingSetting(req.user.tenantID, billingSettings);
    if (!id) {
      res.sendStatus(StatusCodes.NOT_FOUND);
    } else {
      res.json(Constants.REST_RESPONSE_SUCCESS);
    }
    next();
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public static async handleCheckBillingSetting(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    res.sendStatus(StatusCodes.NOT_IMPLEMENTED);
    next();
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public static async handleActivateBillingSetting(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    res.sendStatus(StatusCodes.NOT_IMPLEMENTED);
    next();
  }

  private static async alterSensitiveData(tenantID: string, billingSettings: BillingSettings, newBillingSettings: BillingSettings) {
    // Process the sensitive data if any
    // Preprocess the data to take care of updated values
    if (billingSettings.sensitiveData) {
      if (!Array.isArray(billingSettings.sensitiveData)) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.CYPHER_INVALID_SENSITIVE_DATA_ERROR,
          message: `The property 'sensitiveData' for Setting with ID '${newBillingSettings.id}' is not an array`,
          module: MODULE_NAME,
          method: 'processSensitiveData',
        });
      }
      // Process sensitive properties
      for (const propertyName of billingSettings.sensitiveData) {
        // TODO - find a better way - HACK to be backward compatible with SettingDB
        const normalizedPropertyName = propertyName.replace('content.', '');
        // Get the sensitive property from the request
        const valueInRequest = _.get(newBillingSettings, normalizedPropertyName);
        if (valueInRequest && valueInRequest.length > 0) {
        // Get the sensitive property from the DB
          const valueInDb = _.get(billingSettings, normalizedPropertyName);
          if (valueInDb && valueInDb.length > 0) {
            const hashedValueInDB = Cypher.hash(valueInDb);
            if (valueInRequest !== hashedValueInDB) {
            // Yes: Encrypt
              _.set(newBillingSettings, normalizedPropertyName, await Cypher.encrypt(tenantID, valueInRequest));
            } else {
            // No: Put back the encrypted value
              _.set(newBillingSettings, normalizedPropertyName, valueInDb);
            }
          } else {
          // Value in db is empty then encrypt
            _.set(newBillingSettings, normalizedPropertyName, await Cypher.encrypt(tenantID, valueInRequest));
          }
        } else {
          throw new AppError({
            source: Constants.CENTRAL_SERVER,
            errorCode: HTTPError.CYPHER_INVALID_SENSITIVE_DATA_ERROR,
            message: `The property '${propertyName}' for Setting with ID '${newBillingSettings.id}' is not set`,
            module: MODULE_NAME,
            method: 'processSensitiveData',
          });
        }
      }
    }
  }

  private static hashSensitiveData(tenantID: string, billingSettings: BillingSettings): BillingSettings {
    if (billingSettings.sensitiveData) {
      // Check that sensitive data is an array
      if (!Array.isArray(billingSettings.sensitiveData)) {
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME,
          method: 'hashSensitiveDataInJSON',
          message: 'The property \'sensitiveData\' is not an array'
        });
      }
      for (const propertyName of billingSettings.sensitiveData) {
        // TODO - find a better way - HACK to be backward compatible with SettingDB
        const normalizedPropertyName = propertyName.replace('content.', '');
        // Check that the property does exist otherwise skip to the next property
        if (_.has(billingSettings, normalizedPropertyName)) {
          const value = _.get(billingSettings, normalizedPropertyName);
          // If the value is undefined, null or empty then do nothing and skip to the next property
          if (value && value.length > 0) {
            _.set(billingSettings, normalizedPropertyName, Cypher.hash(value));
          }
        }
      }
    }
    return billingSettings;
  }
}
