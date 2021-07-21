/* eslint-disable @typescript-eslint/no-misused-promises */
import { ServerAction, ServerRoute } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import RouterUtils from '../RouterUtils';
import TransactionService from '../../service/TransactionService';

export default class TransactionRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteTransactions();
    this.buildRouteTransaction();
    this.buildRouteTransactionConsumption();
    this.buildRouteDeleteTransaction();
    this.buildRouteDeleteTransactions();
    this.buildRoutePushTransactionCDR();
    this.buildRouteTransactionsRefund();
    this.buildRouteTransactionsAssignUser();
    this.buildRouteTransactionsExport();
    return this.router;
  }

  protected buildRouteTransactions(): void {
    this.router.get(`/${ServerRoute.REST_TRANSACTIONS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(TransactionService.handleGetTransactions.bind(this), ServerAction.TRANSACTIONS, req, res, next);
    });
  }

  protected buildRouteTransaction(): void {
    this.router.get(`/${ServerRoute.REST_TRANSACTION}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(TransactionService.handleGetTransaction.bind(this), ServerAction.TRANSACTION, req, res, next);
    });
  }

  protected buildRouteDeleteTransactions(): void {
    this.router.delete(`/${ServerRoute.REST_TRANSACTIONS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(TransactionService.handleDeleteTransactions.bind(this), ServerAction.TRANSACTIONS_DELETE, req, res, next);
    });
  }

  protected buildRouteDeleteTransaction(): void {
    this.router.delete(`/${ServerRoute.REST_TRANSACTION}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(TransactionService.handleDeleteTransaction.bind(this), ServerAction.TRANSACTION_DELETE, req, res, next);
    });
  }

  protected buildRoutePushTransactionCDR(): void {
    this.router.post(`/${ServerRoute.REST_TRANSACTION_CDR}`, async (req: Request, res: Response, next: NextFunction) => {
      req.body.transactionId = req.params.id;
      await RouterUtils.handleServerAction(TransactionService.handlePushTransactionCdr.bind(this), ServerAction.OCPI_PUSH_CDRS, req, res, next);
    });
  }

  protected buildRouteExportTransactionCDR(): void {
    this.router.get(`/${ServerRoute.REST_TRANSACTION_CDR_EXPORT}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(TransactionService.handleExportTransactionOcpiCdr.bind(this), ServerAction.TRANSACTION_OCPI_CDR_EXPORT, req, res, next);
    });
  }

  protected buildRouteTransactionConsumption(): void {
    this.router.get(`/${ServerRoute.REST_TRANSACTIONS_CONSUMPTION}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.TransactionId = req.params.id;
      await RouterUtils.handleServerAction(TransactionService.handleGetTransactionConsumption.bind(this), ServerAction.TRANSACTION_CONSUMPTION, req, res, next);
    });
  }

  protected buildRouteRebuildTransactionConsumption(): void {
    this.router.post(`/${ServerRoute.REST_TRANSACTION_CONSUMPTIONS_REBUILD}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(TransactionService.handleRebuildTransactionConsumptions.bind(this), ServerAction.REBUILD_TRANSACTION_CONSUMPTIONS, req, res, next);
    });
  }

  protected buildRouteTransactionSoftStop(): void {
    this.router.put(`/${ServerRoute.REST_TRANSACTION_SOFT_STOP}`, async (req: Request, res: Response, next: NextFunction) => {
      req.body.ID = req.params.id;
      await RouterUtils.handleServerAction(TransactionService.handleTransactionSoftStop.bind(this), ServerAction.TRANSACTION_SOFT_STOP, req, res, next);
    });
  }

  protected buildRouteTransactionsRefund(): void {
    this.router.post(`/${ServerRoute.REST_TRANSACTIONS_REFUND}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(TransactionService.handleRefundTransactions.bind(this), ServerAction.TRANSACTIONS_REFUND, req, res, next);
    });
  }

  protected buildRouteTransactionsAssignUser(): void {
    this.router.put(`/${ServerRoute.REST_TRANSACTIONS_ASSIGN_USER}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(TransactionService.handleAssignTransactionsToUser.bind(this), ServerAction.ASSIGN_TRANSACTIONS_TO_USER, req, res, next);
    });
  }

  protected buildRouteTransactionsExport(): void {
    this.router.get(`/${ServerRoute.REST_TRANSACTIONS_EXPORT}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(TransactionService.handleExportTransactions.bind(this), ServerAction.TRANSACTIONS_EXPORT, req, res, next);
    });
  }
}
