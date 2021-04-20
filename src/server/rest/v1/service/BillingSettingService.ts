import { Action, Entity } from '../../../../types/Authorization';
import { BillingSettings, SettingDB } from '../../../../types/Setting';
import { HTTPAuthError, HTTPError } from '../../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';

import AppAuthError from '../../../../exception/AppAuthError';
import AppError from '../../../../exception/AppError';
import Authorizations from '../../../../authorization/Authorizations';
import BillingSettingStorage from '../../../../storage/mongodb/BillingSettingStorage';
import Constants from '../../../../utils/Constants';
import Cypher from '../../../../utils/Cypher';
import { ServerAction } from '../../../../types/Server';
import SettingSecurity from './security/SettingSecurity';
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
    const billingSettings: BillingSettings = await BillingSettingStorage.getBillingSettings(req.user.tenantID, true);
    if (billingSettings) {
      res.json(billingSettings);
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
    const billingSettings: BillingSettings = await BillingSettingStorage.getBillingSetting(req.user.tenantID, settingID, true);
    if (billingSettings) {
      res.json(billingSettings);
    } else {
      res.sendStatus(StatusCodes.NOT_FOUND);
    }
    next();
  }

  public static async handleUpdateBillingSetting(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    // TODO - should only accept BillingSettings as input
    // const newSettings = SettingSecurity.filterBillingSettingUpdateRequest(req);
    // TODO - sanitize it
    const settingID = req.params.id;
    const newSettings = req.body;
    UtilsService.assertIdIsProvided(action, newSettings.id, MODULE_NAME, 'handleUpdateSetting', req.user);
    if (!await Authorizations.canUpdateSetting(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.UPDATE, entity: Entity.SETTING,
        module: MODULE_NAME, method: 'handleUpdateBillingSetting',
      });
    }
    // Update timestamp
    newSettings.lastChangedBy = { 'id': req.user.id };
    newSettings.lastChangedOn = new Date();
    // Let's save it
    const id = await BillingSettingStorage.saveBillingSetting(req.user.tenantID, settingID, newSettings as BillingSettings, true);
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

  private static async processSensitiveDataCallback(req: Request, setting: SettingDB, settingUpdate: Partial<BillingSettings>) {
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
  }

}
