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
    this.buildRouteBillingSetupPaymentMethod();
    this.buildRouteBillingPaymentMethods();
    this.buildRouteBillingDeletePaymentMethod();
    return this.router;
  }

  protected buildRouteBillingSetupPaymentMethod(): void {
    this.router.put(`/${ServerAction.BILLING_SETUP_PAYMENT_METHOD}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(BillingService.handleBillingSetupPaymentMethod.bind(this), ServerAction.BILLING_SETUP_PAYMENT_METHOD, req, res, next);
    });
  }

  // why in other routers we can see ServerRoute.REST_BILLING_PAYMENT_METHODS ????
  // don't get the difference
  protected buildRouteBillingPaymentMethods(): void {
    this.router.get(`/${ServerAction.BILLING_PAYMENT_METHODS}`, async (req: Request, res: Response, next: NextFunction) => {
      // req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(BillingService.handleBillingGetPaymentMethods.bind(this), ServerAction.BILLING_PAYMENT_METHODS, req, res, next);
    });
  }

  // delete ou post ?
  protected buildRouteBillingDeletePaymentMethod(): void {
    this.router.delete(`/${ServerAction.BILLING_DELETE_PAYMENT_METHOD}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(BillingService.handleBillingDeletePaymentMethod.bind(this), ServerAction.BILLING_DELETE_PAYMENT_METHOD, req, res, next);
    });
  }
}
