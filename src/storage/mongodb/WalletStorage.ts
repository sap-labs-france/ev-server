import Tenant from '../../types/Tenant';
import User from '../../types/User';
import Wallet from '../../types/Wallet';
import BackendError from '../../exception/BackendError';
import WalletTransaction from '../../types/WalletTransaction';
import Constants from '../../utils/Constants';
import DatabaseUtils from './DatabaseUtils';
import Logging from '../../utils/Logging';
import global from '../../types/GlobalType';
import { ObjectId } from 'mongodb';
import UserStorage from './UserStorage';
import WalletTransactionStorage from './WalletTransactionStorage';

const MODULE_NAME = 'WalletStorage';

export default class WalletStorage {
  public static async getWalletByMobile(tenant: Tenant, mobile: string = Constants.UNKNOWN_STRING_ID): Promise<User> {
    const userMDB = await UserStorage.getUsers(tenant, {
      mobile: mobile,
    }, Constants.DB_PARAMS_SINGLE_RECORD);
    return userMDB.count === 1 ? userMDB.result[0] : null;
  }

  public static async getWalletBalance(tenant: Tenant, userId: string): Promise<number> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);

    const user = await UserStorage.getUser(tenant, userId);
    if (!user || !user.wallet) {
      throw new BackendError({
        module: MODULE_NAME,
        method: 'getWalletBalance',
        message: 'Wallet not found'
      });
    }
    console.log(user.wallet.amount, user, 'amount called while checking');

    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getWalletBalance', startTime, { userId });
    return user.wallet.amount;
  }

  // public static async getWalletByUserID(tenant: Tenant, userID: string): Promise<User> {
  //   const startTime = Logging.traceDatabaseRequestStart();
  //   DatabaseUtils.checkTenantObject(tenant);
  //   const walletMDB = await global.database.getCollection<User>(tenant.id, 'wallets').findOne({ userID: DatabaseUtils.convertToObjectID(userID) });
  //
  //   await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getWalletByUserID', startTime, { userID });
  //   return walletMDB.wallet;
  // }

  public static async getTransactionsByUserId(tenant: Tenant, userId: string): Promise<any[]> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);

    const transactions = await global.database.getCollection<any>(tenant.id, 'wallettransactions')
      .find({ userID: DatabaseUtils.convertToObjectID(userId) })
      .toArray();

    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getTransactionsByUserId', startTime, { userId });
    return transactions;
  }


  // public static async getWalletTransactions(tenant: Tenant, userId: string, filters: { startDate?: Date; endDate?: Date; transactionTypes?: string[]; }, pagination: { limit: number; skip: number; sort: any; }): Promise<{ transactions: WalletTransaction[] }> {
  //   const startTime = Logging.traceDatabaseRequestStart();
  //   DatabaseUtils.checkTenantObject(tenant);
  //
  //   const query: any = { userID: userId };
  //
  //   if (filters.startDate) {
  //     query.timestamp = { $gte: filters.startDate };
  //   }
  //   if (filters.endDate) {
  //     query.timestamp = { ...query.timestamp, $lte: filters.endDate };
  //   }
  //   if (filters.transactionTypes && filters.transactionTypes.length > 0) {
  //     query.type = { $in: filters.transactionTypes };
  //   }
  //
  //   console.log(query);
  //
  //   const transactionsMDB = await global.database.getCollection<WalletTransaction>(tenant.id, 'wallettransactions')
  //     .find(query)
  //     .sort(pagination.sort)
  //     .skip(pagination.skip)
  //     .limit(pagination.limit)
  //     .toArray();
  //
  //   console.log(transactionsMDB, 'final answer');
  //
  //   // const countMDB = await global.database.getCollection<WalletTransaction>(tenant.id, 'wallettransactions')
  //   //   .countDocuments(query);
  //
  //   await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getWalletTransactions', startTime, {
  //     userId,
  //     filters,
  //     pagination
  //   });
  //   return { transactions: transactionsMDB };
  // }

  public static async updateWalletBalance(tenant: Tenant, mobile: string, rechargeAmount: number): Promise<number> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);

    const user = await WalletStorage.getWalletByMobile(tenant, mobile);
    if (!user.wallet) {
      throw new BackendError({
        module: MODULE_NAME,
        method: 'updateWalletBalance',
        message: 'Wallet not found'
      });
    }

    user.wallet.amount += rechargeAmount;
    await global.database.getCollection<any>(tenant.id, 'users').findOneAndUpdate(
      { '_id': DatabaseUtils.convertToObjectID(user.id) },
      { $set: { 'wallet.amount': user.wallet.amount } }
    );
    await WalletTransactionStorage.recordTransaction(tenant, user.id, 'credit', rechargeAmount, 'Wallet recharge');
    console.log(user.wallet.amount);
    // await UserStorage.saveUserWalletAmount(tenant, user.id, rechargeAmount);
    // console.log(user.id, 'userID');
    // await global.database.getCollection<Wallet>(tenant.id, 'wallets').updateOne(
    //   { userID: DatabaseUtils.convertToObjectID(user.mobile) },
    //   { $set: { balance: user.wallet.amount } }
    // );

    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'updateWalletBalance', startTime, { rechargeAmount });
    return user.wallet.amount;
  }

  public static async updateWalletBalanceWithdraw(tenant: Tenant, mobile: string, Amount: number): Promise<number> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);

    const user = await WalletStorage.getWalletByMobile(tenant, mobile);
    if (!user.wallet) {
      throw new BackendError({
        module: MODULE_NAME,
        method: 'updateWalletBalanceWithdraw',
        message: 'Wallet not found'
      });
    }

    if (user.wallet.amount < Amount) {
      throw new BackendError({
        module: MODULE_NAME,
        method: 'updateWalletBalanceWithdraw',
        message: 'Wallet does not have enough amount to pay'
      });
    }

    user.wallet.amount -= Amount;
    await global.database.getCollection<any>(tenant.id, 'users').findOneAndUpdate(
      { '_id': DatabaseUtils.convertToObjectID(user.id) },
      { $set: { 'wallet.amount': user.wallet.amount } }
    );
    await WalletTransactionStorage.recordTransaction(tenant, user.id, 'debit', Amount, 'Wallet withdrawal');

    console.log(user.wallet.amount);
    // await UserStorage.saveUserWalletAmount(tenant, user.id, rechargeAmount);
    // console.log(user.id, 'userID');
    // await global.database.getCollection<Wallet>(tenant.id, 'wallets').updateOne(
    //   { userID: DatabaseUtils.convertToObjectID(user.mobile) },
    //   { $set: { balance: user.wallet.amount } }
    // );

    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'updateWalletBalanceWithdraw', startTime, { Amount });
    return user.wallet.amount;
  }

  // public static async createWallet(tenant: Tenant, userID: string, initialBalance: number = 0): Promise<string> {
  //   const startTime = Logging.traceDatabaseRequestStart();
  //   DatabaseUtils.checkTenantObject(tenant);
  //
  //   const wallet = {
  //     _id: new ObjectId(),
  //     userID: DatabaseUtils.convertToObjectID(userID),
  //     balance: initialBalance,
  //     createdOn: new Date(),
  //     lastUpdatedOn: new Date()
  //   };
  //
  //   await global.database.getCollection<Wallet>(tenant.id, 'wallets').insertOne(wallet);
  //
  //   await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'createWallet', startTime, wallet);
  //   return wallet._id.toString();
  // }

  // public static async recordWalletTransaction(tenant: Tenant, userID: string, transaction: WalletTransaction): Promise<void> {
  //   const startTime = Logging.traceDatabaseRequestStart();
  //   DatabaseUtils.checkTenantObject(tenant);
  //
  //   transaction._id = new ObjectId();
  //   transaction.userID = DatabaseUtils.convertToObjectID(userID);
  //   transaction.timestamp = new Date();
  //
  //   await global.database.getCollection<WalletTransaction>(tenant.id, 'wallettransactions').insertOne(transaction);
  //
  //   await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'recordWalletTransaction', startTime, transaction);
  // }
}
