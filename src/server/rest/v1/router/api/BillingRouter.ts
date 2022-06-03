import { RESTServerRoute, ServerAction } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import BillingService from '../../service/BillingService';
import RouterUtils from '../../../../../utils/RouterUtils';

export default class BillingRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    // -----------------------------------
    // ROUTES for BILLING SETTINGS
    // -----------------------------------
    this.buildRouteBillingSetting();
    this.buildRouteUpdateBillingSetting();
    this.buildRouteCheckBillingConnection();
    this.buildRouteClearTestData();
    // -----------------------------------
    // ROUTES for PAYMENT METHODS
    // -----------------------------------
    this.buildRouteBillingPaymentMethods();
    // this.buildRouteBillingPaymentMethod(); - // No use case so far
    // this.buildRouteBillingCreatePaymentMethod(); - // No use case so far
    // this.buildRouteBillingUpdatePaymentMethod(); - // No use case so far
    this.buildRouteBillingDeletePaymentMethod();
    this.buildRouteBillingPaymentMethodSetup();
    this.buildRouteBillingPaymentMethodAttach();
    this.buildRouteBillingPaymentMethodDetach();
    // -----------------------------------
    // ROUTES for INVOICES
    // -----------------------------------
    this.buildRouteBillingInvoices();
    this.buildRouteBillingInvoice();
    this.buildRouteBillingInvoiceDownload();
    // -----------------------------------
    // ROUTES for TAXES
    // -----------------------------------
    this.buildRouteBillingGetTaxes();
    // -----------------------------------
    // ROUTES for SUB-ACCOUNTS
    // -----------------------------------
    this.buildRouteBillingCreateSubAccount();
    this.buildRouteBillingGetSubAccounts();
    return this.router;
  }

  private buildRouteBillingSetting(): void {
    this.router.get(`/${RESTServerRoute.REST_BILLING_SETTING}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(BillingService.handleGetBillingSetting.bind(this), ServerAction.SETTINGS, req, res, next);
    });
  }

  private buildRouteUpdateBillingSetting(): void {
    this.router.put(`/${RESTServerRoute.REST_BILLING_SETTING}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(BillingService.handleUpdateBillingSetting.bind(this), ServerAction.SETTINGS, req, res, next);
    });
  }

  private buildRouteCheckBillingConnection(): void {
    this.router.post(`/${RESTServerRoute.REST_BILLING_CHECK}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(BillingService.handleCheckBillingConnection.bind(this), ServerAction.SETTINGS, req, res, next);
    });
  }

  private buildRouteClearTestData(): void {
    this.router.post(`/${RESTServerRoute.REST_BILLING_CLEAR_TEST_DATA}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(BillingService.handleClearBillingTestData.bind(this), ServerAction.SETTINGS, req, res, next);
    });
  }

  private buildRouteBillingPaymentMethods(): void {
    this.router.get(`/${RESTServerRoute.REST_BILLING_PAYMENT_METHODS}`, (req: Request, res: Response, next: NextFunction) => {
      // GET {{base_url}}/v1/api/billing/users/5be451dad0685c19bff48856/payment-methods?Limit=100&SortFields=id
      req.query.userID = req.params.userID;
      void RouterUtils.handleRestServerAction(BillingService.handleBillingGetPaymentMethods.bind(this), ServerAction.BILLING_PAYMENT_METHODS, req, res, next);
    });
  }

  private buildRouteBillingDeletePaymentMethod(): void {
    // DELETE {{base_url}}/v1/api/billing/users/5be451dad0685c19bff48856/payment-methods?Limit=100&SortFields=id
    this.router.delete(`/${RESTServerRoute.REST_BILLING_PAYMENT_METHOD}`, (req: Request, res: Response, next: NextFunction) => {
      req.body.userID = req.params.userID;
      req.body.paymentMethodId = req.params.paymentMethodID;
      void RouterUtils.handleRestServerAction(BillingService.handleBillingDeletePaymentMethod.bind(this), ServerAction.BILLING_DELETE_PAYMENT_METHOD, req, res, next);
    });
  }

  private buildRouteBillingPaymentMethodSetup(): void {
    this.router.post(`/${RESTServerRoute.REST_BILLING_PAYMENT_METHOD_SETUP}`, (req: Request, res: Response, next: NextFunction) => {
      // STRIPE prerequisite - ask for a setup intent first!
      req.body.userID = req.params.userID;
      void RouterUtils.handleRestServerAction(BillingService.handleBillingSetupPaymentMethod.bind(this), ServerAction.BILLING_SETUP_PAYMENT_METHOD, req, res, next);
    });
  }

  private buildRouteBillingPaymentMethodAttach(): void {
    this.router.post(`/${RESTServerRoute.REST_BILLING_PAYMENT_METHOD_ATTACH}`, (req: Request, res: Response, next: NextFunction) => {
      // Creates a new payment method and attach it to the user as its default
      req.body.userID = req.params.userID;
      req.body.paymentMethodId = req.params.paymentMethodID;
      void RouterUtils.handleRestServerAction(BillingService.handleBillingSetupPaymentMethod.bind(this), ServerAction.BILLING_SETUP_PAYMENT_METHOD, req, res, next);
    });
  }

  private buildRouteBillingPaymentMethodDetach(): void {
    this.router.post(`/${RESTServerRoute.REST_BILLING_PAYMENT_METHOD_DETACH}`, (req: Request, res: Response, next: NextFunction) => {
      // POST {{base_url}}/v1/api/users/5be451dad0685c19bff48856/payment-methods/pm_1Ib3MxF5e1VSb1v6eH3Zhn4K/detach
      // Detach a payment method from the user:
      req.body.userID = req.params.userID;
      req.body.paymentMethodId = req.params.paymentMethodID;
      void RouterUtils.handleRestServerAction(BillingService.handleBillingDeletePaymentMethod.bind(this), ServerAction.BILLING_DELETE_PAYMENT_METHOD, req, res, next);
    });
  }

  private buildRouteBillingInvoices(): void {
    this.router.get(`/${RESTServerRoute.REST_BILLING_INVOICES}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(BillingService.handleGetInvoices.bind(this), ServerAction.BILLING_INVOICES, req, res, next);
    });
  }

  private buildRouteBillingInvoice(): void {
    this.router.get(`/${RESTServerRoute.REST_BILLING_INVOICE}`, (req: Request, res: Response, next: NextFunction) => {
      // GET {{base_url}}/v1/api/invoices/606193168f22ac7f02223c8c
      req.query.ID = req.params.invoiceID;
      void RouterUtils.handleRestServerAction(BillingService.handleGetInvoice.bind(this), ServerAction.BILLING_INVOICE, req, res, next);
    });
  }

  private buildRouteBillingInvoiceDownload(): void {
    this.router.get(`/${RESTServerRoute.REST_BILLING_DOWNLOAD_INVOICE}`, (req: Request, res: Response, next: NextFunction) => {
      // GET {{base_url}}/v1/api/invoices/606193168f22ac7f02223c8c/download
      req.query.ID = req.params.invoiceID;
      void RouterUtils.handleRestServerAction(BillingService.handleDownloadInvoice.bind(this), ServerAction.BILLING_DOWNLOAD_INVOICE, req, res, next);
    });
  }

  private buildRouteBillingGetTaxes(): void {
    this.router.get(`/${RESTServerRoute.REST_BILLING_TAXES}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(BillingService.handleGetBillingTaxes.bind(this), ServerAction.BILLING_TAXES, req, res, next);
    });
  }

  private buildRouteBillingCreateSubAccount(): void {
    this.router.post(`/${RESTServerRoute.REST_BILLING_SUB_ACCOUNTS}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(BillingService.handleCreateSubAccount.bind(this), ServerAction.BILLING_SUB_ACCOUNT_CREATE, req, res, next);
    });
  }

  private buildRouteBillingGetSubAccounts(): void {
    this.router.get(`/${RESTServerRoute.REST_BILLING_SUB_ACCOUNTS}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(BillingService.handleBillingGetSubAccounts.bind(this), ServerAction.BILLING_SUB_ACCOUNTS, req, res, next);
    });
  }
}
