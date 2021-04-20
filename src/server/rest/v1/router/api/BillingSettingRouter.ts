import { ServerAction, ServerRoute } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import BillingSettingService from '../../service/BillingSettingService';
import RouterUtils from '../RouterUtils';

export default class SettingRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteBillingSettings();
    this.buildRouteBillingSetting();
    // this.buildRouteCreateBillingSetting();
    this.buildRouteUpdateBillingSetting();
    // this.buildRouteDeleteBillingSetting();
    this.buildRouteCheckBillingSetting();
    this.buildRouteActivateBillingSetting();
    return this.router;
  }

  protected buildRouteBillingSettings(): void {
    this.router.get(`/${ServerRoute.REST_BILLING_SETTINGS}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleServerAction(BillingSettingService.handleGetBillingSettings.bind(this), ServerAction.SETTINGS, req, res, next);
    });
  }

  protected buildRouteBillingSetting(): void {
    this.router.get(`/${ServerRoute.REST_BILLING_SETTING}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleServerAction(BillingSettingService.handleGetBillingSetting.bind(this), ServerAction.SETTINGS, req, res, next);
    });
  }

  protected buildRouteUpdateBillingSetting(): void {
    this.router.put(`/${ServerRoute.REST_BILLING_SETTING}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleServerAction(BillingSettingService.handleUpdateBillingSetting.bind(this), ServerAction.SETTINGS, req, res, next);
    });
  }

  protected buildRouteCheckBillingSetting(): void {
    this.router.post(`/${ServerRoute.REST_BILLING_SETTING_CHECK}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleServerAction(BillingSettingService.handleCheckBillingSetting.bind(this), ServerAction.SETTINGS, req, res, next);
    });
  }

  protected buildRouteActivateBillingSetting(): void {
    this.router.post(`/${ServerRoute.REST_BILLING_SETTING_ACTIVATE}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleServerAction(BillingSettingService.handleActivateBillingSetting.bind(this), ServerAction.SETTINGS, req, res, next);
    });
  }
}

