import Tenant from '../../types/Tenant';
import BackendError from '../../exception/BackendError';
import Constants from '../../utils/Constants';
import DatabaseUtils from './DatabaseUtils';
import Logging from '../../utils/Logging';
import global from '../../types/GlobalType';
import { ObjectId } from 'mongodb';
import WalletTransaction from '../../types/WalletTransaction';

const MODULE_NAME = 'WalletTransactionStorage';

export default class WalletTransactionStorage {
  public static async recordTransaction(tenant: Tenant, userID: string, type: 'credit' | 'debit', amount: number, description: string = ''): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);

    const transaction: WalletTransaction = {
      userID: DatabaseUtils.convertToObjectID(userID),
      type,
      amount,
      timestamp: new Date(),
      description,
    };

    await global.database.getCollection<WalletTransaction>(tenant.id, 'wallettransactions').insertOne(transaction);

    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'recordTransaction', startTime, transaction);
  }

  public static async getTransactionsByUser(tenant: Tenant, userID: string): Promise<WalletTransaction[]> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);

    const transactions = await global.database.getCollection<WalletTransaction>(tenant.id, 'wallettransactions').find({
      userID: DatabaseUtils.convertToObjectID(userID)
    }).toArray();

    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getTransactionsByUser', startTime, { userID });
    return transactions;
  }
}
