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
    this.buildRouteAttachPaymentMethod();
    return this.router;
  }

  protected buildRouteAttachPaymentMethod(): void {
    this.router.put(`/${ServerAction.BILLING_ATTACH_PAYMENT_METHOD}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(BillingService.handleBillingAttachPaymentMethod.bind(this), ServerAction.REST_TENANTS, req, res, next);
    });
  }
}
