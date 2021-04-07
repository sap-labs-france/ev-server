import { ServerAction, ServerRoute } from '../../../../../types/Server';
/* eslint-disable @typescript-eslint/no-misused-promises */
import express, { NextFunction, Request, Response } from 'express';

import BillingService from '../../service/BillingService';
import RouterUtils from '../RouterUtils';

export default class BillingRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteBillingPaymentMethods();
    // this.buildRouteBillingPaymentMethod(); - // No use case so far
    // this.buildRouteBillingCreatePaymentMethod(); - // No use case so far
    // this.buildRouteBillingUpdatePaymentMethod(); - // No use case so far
    this.buildRouteBillingDeletePaymentMethod();
    this.buildRouteBillingPaymentMethodSetup();
    this.buildRouteBillingPaymentMethodAttach();
    this.buildRouteBillingPaymentMethodDetach();
    return this.router;
  }

  protected buildRouteBillingPaymentMethods(): void {
    this.router.get(`/${ServerRoute.REST_BILLING_PAYMENT_METHODS}`, async (req: Request, res: Response, next: NextFunction) => {
      req.body.userID = req.params.userID;
      await RouterUtils.handleServerAction(BillingService.handleBillingGetPaymentMethods.bind(this), ServerAction.BILLING_PAYMENT_METHODS, req, res, next);
    });
  }

  protected buildRouteBillingDeletePaymentMethod(): void {
    this.router.delete(`/${ServerRoute.REST_BILLING_PAYMENT_METHOD}`, async (req: Request, res: Response, next: NextFunction) => {
      req.body.userID = req.params.userID;
      req.body.paymentMethodId = req.params.paymentMethodID;
      await RouterUtils.handleServerAction(BillingService.handleBillingDeletePaymentMethod.bind(this), ServerAction.BILLING_DELETE_PAYMENT_METHOD, req, res, next);
    });
  }

  protected buildRouteBillingPaymentMethodSetup(): void {
    this.router.post(`/${ServerRoute.REST_BILLING_PAYMENT_METHOD_SETUP}`, async (req: Request, res: Response, next: NextFunction) => {
      // STRIPE prerequisite - ask for a setup intent first!
      req.body.userID = req.params.userID;
      await RouterUtils.handleServerAction(BillingService.handleBillingSetupPaymentMethod.bind(this), ServerAction.BILLING_SETUP_PAYMENT_METHOD, req, res, next);
    });
  }

  protected buildRouteBillingPaymentMethodAttach(): void {
    this.router.post(`/${ServerRoute.REST_BILLING_PAYMENT_METHOD_ATTACH}`, async (req: Request, res: Response, next: NextFunction) => {
      // Creates a new payment method and attach it to the user as its default
      req.body.userID = req.params.userID;
      await RouterUtils.handleServerAction(BillingService.handleBillingSetupPaymentMethod.bind(this), ServerAction.BILLING_SETUP_PAYMENT_METHOD, req, res, next);
    });
  }

  protected buildRouteBillingPaymentMethodDetach(): void {
    this.router.post(`/${ServerRoute.REST_BILLING_PAYMENT_METHOD_DETACH}`, async (req: Request, res: Response, next: NextFunction) => {
      // Detach a payment method from the user
      req.body.userID = req.params.userID;
      await RouterUtils.handleServerAction(BillingService.handleBillingSetupPaymentMethod.bind(this), ServerAction.BILLING_SETUP_PAYMENT_METHOD, req, res, next);
    });
  }

}
