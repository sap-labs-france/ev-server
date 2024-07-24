import { Action, Entity } from '../../../../types/Authorization';
import { NextFunction, Request, Response } from 'express';
import Tenant, { TenantComponents } from '../../../../types/Tenant';
import WalletValidatorRest from '../validator/WalletValidatorRest';
import WalletStorage from '../../../../storage/mongodb/WalletStorage';

import AppError from '../../../../exception/AppError';
import AuthorizationService from './AuthorizationService';
// import Authorizations from '../../../../authorization/Authorizations';
// import Constants from '../../../../utils/Constants';
import { HTTPError } from '../../../../types/HTTPError';
import Logging from '../../../../utils/Logging';
// import LoggingHelper from '../../../../utils/LoggingHelper';
import { ServerAction } from '../../../../types/Server';
// import { StatusCodes } from 'http-status-codes';
// import Utils from '../../../../utils/Utils';
import UtilsService from './UtilsService';

const MODULE_NAME = 'WalletService';

export default class WalletService {
  public static async handleGetWalletBalance(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    //  UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.WALLET,
    //   Action.READ, Entity.WALLET, MODULE_NAME, 'handleGetWalletBalance');
    // Filter
    // const filteredRequest = WalletValidatorRest.getInstance().validateWalletBalanceGetReq(req.query);
    const filteredRequest = req.body;
    // Check auth
    // await AuthorizationService.checkAndGetWalletAuthorizations(
    //   req.tenant, req.user, Action.READ);
    // Retrieve wallet balance for the user
    const walletBalance = await WalletStorage.getWalletBalance(req.tenant, filteredRequest.id);
    res.json({ balance: walletBalance });
    next();
  }

  public static async handleWalletRecharge(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    // UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.WALLET,
    //   Action.CREATE, Entity.WALLET, MODULE_NAME, 'handleWalletRecharge');
    // Filter
    // const filteredRequest = WalletValidatorRest.getInstance().validateWalletRechargeReq(req.body);
    const filteredRequest = req.body;
    // Check auth
    // await AuthorizationService.checkAndGetWalletAuthorizations(
    //   req.tenant, req.user, Action.CREATE);
    // Perform the wallet recharge
    const rechargeAmount = filteredRequest.amount;
    if (rechargeAmount <= 0) {
      throw new AppError({
        errorCode: HTTPError.INVALID_CAPTCHA,
        message: 'Recharge amount must be greater than zero',
        user: req.user,
        module: MODULE_NAME,
        method: 'handleWalletRecharge'
      });
    }
    // Simulate recharge process
    console.log(filteredRequest.mobile, rechargeAmount);
    const walletBalance = await WalletStorage.updateWalletBalance(req.tenant, filteredRequest.mobile, rechargeAmount);
    // Log the recharge action
    await Logging.logInfo({
      tenantID: req.tenant.id,
      user: req.user,
      module: MODULE_NAME,
      method: 'handleWalletRecharge',
      message: `Wallet recharge of ${rechargeAmount} units successful`,
      action: action,
      detailedMessages: { rechargeAmount }
    });
    res.json({ balance: walletBalance });
    next();
  }

  public static async handleWalletWithdraw(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    // UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.WALLET,
    //   Action.CREATE, Entity.WALLET, MODULE_NAME, 'handleWalletRecharge');
    // Filter
    // const filteredRequest = WalletValidatorRest.getInstance().validateWalletRechargeReq(req.body);
    const filteredRequest = req.body;
    // Check auth
    // await AuthorizationService.checkAndGetWalletAuthorizations(
    //   req.tenant, req.user, Action.CREATE);
    // Perform the wallet recharge
    const rechargeAmount = filteredRequest.amount;
    if (rechargeAmount <= 0) {
      throw new AppError({
        errorCode: HTTPError.INVALID_CAPTCHA,
        message: 'Recharge amount must be greater than zero',
        user: req.user,
        module: MODULE_NAME,
        method: 'handleWalletRecharge'
      });
    }
    // Simulate recharge process
    console.log(filteredRequest.mobile, rechargeAmount);
    const walletBalance = await WalletStorage.updateWalletBalanceWithdraw(req.tenant, filteredRequest.mobile, rechargeAmount);
    // Log the recharge action
    await Logging.logInfo({
      tenantID: req.tenant.id,
      user: req.user,
      module: MODULE_NAME,
      method: 'handleWalletRecharge',
      message: `Wallet recharge of ${rechargeAmount} units successful`,
      action: action,
      detailedMessages: { rechargeAmount }
    });
    res.json({ balance: walletBalance });
    next();
  }

  public static async handleGetWalletTransactions(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    // UtilsService.assertComponentIsActiveFromToken(req.user, 'wallet', Action.LIST, Entity.WALLET_TRANSACTION, MODULE_NAME, 'handleGetWalletTransactions');

    // Check authorization
    // await AuthorizationService.checkAndGetWalletAuthorizations(req.tenant, req.user, Action.LIST);

    // Get user ID from the request
    const userId = req.body.userID;

    // Retrieve transactions
    const transactions = await WalletStorage.getTransactionsByUserId(req.tenant, userId);

    // Respond with transactions
    res.json(transactions);
    next();
  }

  // public static async handleGetWalletTransactions(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
  //   // Check if component is active
  //   // UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.WALLET,
  //   //   Action.LIST, Entity.WALLET_TRANSACTION, MODULE_NAME, 'handleGetWalletTransactions');
  //
  //   // Filter
  //   // const filteredRequest = WalletValidatorRest.getInstance().validateWalletTransactionsGetReq(req.query);
  //   const filteredRequest = req.body;
  //   // Check auth
  //   // await AuthorizationService.checkAndGetWalletAuthorizations(req.tenant, req.user, Action.LIST);
  //
  //   // Retrieve wallet transactions
  //   const transactions = await WalletStorage.getWalletTransactions(
  //     req.tenant,
  //     filteredRequest.userID,
  //     {
  //       startDate: filteredRequest.startDate,
  //       endDate: filteredRequest.endDate,
  //       transactionTypes: filteredRequest.transactionType ? filteredRequest.transactionType.split('|') : [],
  //     },
  //     {
  //       limit: filteredRequest.limit,
  //       skip: filteredRequest.skip,
  //       sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.sortFields),
  //     }
  //   );
  //
  //   res.json(transactions);
  //   next();
  // }


  // public static async handleGetWalletTransactions(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
  //   // Check if component is active
  //   UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.WALLET,
  //     Action.LIST, Entity.WALLET_TRANSACTION, MODULE_NAME, 'handleGetWalletTransactions');
  //   // Filter
  //   const filteredRequest = WalletValidatorRest.getInstance().validateWalletTransactionsGetReq(req.query);
  //   // Check auth
  //   await AuthorizationService.checkAndGetWalletAuthorizations(
  //     req.tenant, req.user, Action.LIST);
  //   // Retrieve wallet transactions
  //   const transactions = await WalletStorage.getWalletTransactions(
  //     req.tenant,
  //     {
  //       userID: req.user.id,
  //       startDate: filteredRequest.StartDate,
  //       endDate: filteredRequest.EndDate,
  //       transactionTypes: filteredRequest.TransactionType ? filteredRequest.TransactionType.split('|') : null,
  //       ...otherFilters
  //     },
  //     {
  //       limit: filteredRequest.Limit,
  //       skip: filteredRequest.Skip,
  //       sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields),
  //       onlyRecordCount: filteredRequest.OnlyRecordCount
  //     }
  //   );
  //   res.json(transactions);
  //   next();
  // }

  // Other methods like handleWalletTransactionRefund, handleWalletTransactionHistory, etc. can be added similarly.

}
