import express, { NextFunction, Request, Response } from 'express';
import WalletService from '../../service/WalletService';
// import { ServerAction } from '../../../../../types/Server';
// eslint-disable-next-line sort-imports
import { RESTServerRoute, ServerAction } from '../../../../../types/Server';
import RouterUtils from '../../../../../utils/RouterUtils';

export default class WalletRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }


  public buildRoutes(): express.Router {
    this.buildRouteWalletRecharge();
    this.buildRouteWalletWithdraw();
    this.buildRouteWalletBalanceCheck();
    this.buildRouteWalletTransaction();
    return this.router;
  }

  // private buildRouteWalletRecharge(): void {
  //   this.router.post(`/${RESTServerRoute.WALLET_RECHARGE}/:id`, (req: Request, res: Response, next: NextFunction) => {
  //     req.query.ID = req.params.id;
  //     // const { userId, amount } = req.body; // Assuming userId and amount are provided in the request body
  //     void RouterUtils.handleRestServerAction(WalletService.handleWalletRecharge.bind(this), ServerAction.WALLET_RECHARGE, req, res, next);
  //   });
  // }

  private buildRouteWalletBalanceCheck(): void {
    this.router.get(`/${RESTServerRoute.WALLET_BALANCE}`, (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      // const { userId, amount } = req.body; // Assuming userId and amount are provided in the request body
      void RouterUtils.handleRestServerAction(WalletService.handleGetWalletBalance.bind(this), ServerAction.WALLET_BALANCE, req, res, next);
    });
  }

  private buildRouteWalletTransaction(): void {
    this.router.get(`/${RESTServerRoute.WALLET_TRANSACTION}`, (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      // const { userId, amount } = req.body; // Assuming userId and amount are provided in the request body
      void RouterUtils.handleRestServerAction(WalletService.handleGetWalletTransactions.bind(this), ServerAction.WALLET_TRANSACTION, req, res, next);
    });
  }

  private buildRouteWalletRecharge(): void {
    this.router.post(`/${RESTServerRoute.WALLET_RECHARGE}`, (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      // const { userId, amount } = req.body; // Assuming userId and amount are provided in the request body
      void RouterUtils.handleRestServerAction(WalletService.handleWalletRecharge.bind(this), ServerAction.WALLET_RECHARGE, req, res, next);
    });
  }

  private buildRouteWalletWithdraw(): void {
    this.router.post(`/${RESTServerRoute.WALLET_WITHDRAW}`, (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      // const { userId, amount } = req.body; // Assuming userId and amount are provided in the request body
      void RouterUtils.handleRestServerAction(WalletService.handleWalletWithdraw.bind(this), ServerAction.WALLET_WITHDRAW, req, res, next);
    });
  }
  // private buildRouteWalletBalance(): void {
  //   this.router.get(`/wallet/balance/:userId`, (req: Request, res: Response, next: NextFunction) => {
  //     const userId = req.params.userId;
  //     void RouterUtils.handleRestServerAction(WalletService.handleWalletBalance.bind(this), ServerAction.WALLET_BALANCE, req, res, next);
  //   });
  // }

  // Add more wallet routes like withdrawal, transaction history, etc., as needed
}
