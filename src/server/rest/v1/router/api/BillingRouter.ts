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
    return this.router;
  }

  protected buildRouteSetupPaymentMethod(): void {
    this.router.put(`/${ServerAction.BILLING_SETUP_PAYMENT_METHOD}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(BillingService.handleBillingSetupPaymentMethod.bind(this), ServerAction.BILLING_SETUP_PAYMENT_METHOD, req, res, next);
    });
  }
}
