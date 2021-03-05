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
    return this.router;
  }

  protected buildRouteCompletedTransactions(): void {
    this.router.get(`/${ServerRoute.REST_TRANSACTIONS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(TransactionService.handleGetTransactionsCompleted.bind(this), ServerAction.CHARGING_STATIONS, req, res, next);
    });
  }
}
