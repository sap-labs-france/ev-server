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
    this.buildRouteCompletedTransactions();
    this.buildRouteTransaction();
    this.buildRouteTransactionConsumption();
    this.buildRouteTransactionsInProgress();
    return this.router;
  }

  protected buildRouteCompletedTransactions(): void {
    this.router.get(`/${ServerRoute.REST_TRANSACTIONS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(TransactionService.handleGetTransactionsCompleted.bind(this), ServerAction.CHARGING_STATIONS, req, res, next);
    });
  }

  protected buildRouteTransaction(): void {
    this.router.get(`/${ServerRoute.REST_TRANSACTION}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(TransactionService.handleGetTransaction.bind(this), ServerAction.CHARGING_STATIONS, req, res, next);
    });
  }

  protected buildRouteTransactionsInProgress(): void {
    this.router.get(`/${ServerRoute.REST_TRANSACTIONS_IN_PROGRESS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(TransactionService.handleGetTransactionsActive.bind(this), ServerAction.CHARGING_STATIONS, req, res, next);
    });
  }

  protected buildRouteTransactionConsumption(): void {
    this.router.get(`/${ServerRoute.REST_TRANSACTIONS_CONSUMPTION}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.TransactionId = req.params.id;
      await RouterUtils.handleServerAction(TransactionService.handleGetTransactionConsumption.bind(this), ServerAction.CHARGING_STATIONS, req, res, next);
    });
  }
}
