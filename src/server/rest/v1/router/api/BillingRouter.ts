/* eslint-disable @typescript-eslint/no-misused-promises */
import express, { NextFunction, Request, Response } from 'express';

import BillingService from '../../service/BillingService';
import RouterUtils from '../RouterUtils';
import { ServerAction } from '../../../../../types/Server';

export default class BillingRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteSetupPaymentMethod();
    this.buildRoutePaymentMethodsList();
    return this.router;
  }

  protected buildRouteSetupPaymentMethod(): void {
    this.router.put(`/${ServerAction.BILLING_SETUP_PAYMENT_METHOD}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(BillingService.handleBillingSetupPaymentMethod.bind(this), ServerAction.BILLING_SETUP_PAYMENT_METHOD, req, res, next);
    });
  }

  // why in other routers we can see ServerRoute.REST_BILLING_PAYMENT_METHODS ????
  // don't get the difference
  protected buildRoutePaymentMethodsList(): void {
    this.router.get(`/${ServerAction.BILLING_PAYMENT_METHODS_LIST}`, async (req: Request, res: Response, next: NextFunction) => {
      // req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(BillingService.handleBillingGetPaymentMethodsList.bind(this), ServerAction.BILLING_PAYMENT_METHODS_LIST, req, res, next);
    });
  }

  // delete ou post ?
  protected buildRouteDeletePaymentMethod(): void {
    this.router.delete(`/${ServerAction.BILLING_DELETE_PAYMENT_METHOD}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(BillingService.handleBillingDeletePaymentMethod.bind(this), ServerAction.BILLING_DELETE_PAYMENT_METHOD, req, res, next);
    });
  }
}
