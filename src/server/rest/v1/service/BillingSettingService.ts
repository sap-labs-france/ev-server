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
    const newBillingSettings = req.body;
    UtilsService.assertIdIsProvided(action, newBillingSettings.id, MODULE_NAME, 'handleUpdateSetting', req.user);
    if (!await Authorizations.canUpdateSetting(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.UPDATE, entity: Entity.SETTING,
        module: MODULE_NAME, method: 'handleUpdateBillingSetting',
      });
    }
    // Update timestamp
    newBillingSettings.lastChangedBy = { 'id': req.user.id };
    newBillingSettings.lastChangedOn = new Date();
    // Let's save it
    const id = await BillingSettingStorage.saveBillingSetting(req.user.tenantID, settingID, newBillingSettings as BillingSettings, true);
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
}
