import { Action, Entity } from '../../../../types/Authorization';
import { NextFunction, Request, Response } from 'express';

import AppAuthError from '../../../../exception/AppAuthError';
import Authorizations from '../../../../authorization/Authorizations';
import BillingSettingStorage from '../../../../storage/mongodb/BillingSettingStorage';
import { BillingSettings } from '../../../../types/Setting';
import Constants from '../../../../utils/Constants';
import { HTTPAuthError } from '../../../../types/HTTPError';
import { ServerAction } from '../../../../types/Server';
import { StatusCodes } from 'http-status-codes';

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
    if (!await Authorizations.canUpdateSetting(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.UPDATE, entity: Entity.SETTING,
        module: MODULE_NAME, method: 'handleUpdateBillingSetting',
      });
    }
    res.sendStatus(StatusCodes.NOT_IMPLEMENTED);
    // const billingSettings: BillingSettings = null;
    // await BillingSettingStorage.saveBillingSettings(req.user.tenantID, billingSettings);
    // Ok
    // res.json(Constants.REST_RESPONSE_SUCCESS);
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
