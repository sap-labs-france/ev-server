import Constants from '../../utils/Constants';
import DatabaseUtils from '../../storage/mongodb/DatabaseUtils';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Transaction from '../../types/Transaction';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'AddInactivityStatusInTransactionsTask';

export default class AddInactivityStatusInTransactionsTask extends MigrationTask {
  async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant): Promise<void> {
    let modifiedCount = 0;
    // Get all transactions
    const aggregation = [];
    aggregation.push({
      $match: {
        'stop': { $exists: true },
        'stop.inactivityStatus': { $exists: false }
      }
    });
    // Add Charge Box
    DatabaseUtils.pushChargingStationLookupInAggregation({
      tenantID: tenant.id, aggregation: aggregation, localField: 'chargeBoxID',
      foreignField: '_id', asField: 'chargeBox', oneToOneCardinality: true, oneToOneCardinalityNotNull: false
    });
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'chargeBox.siteAreaID');
    // Call
    const transactionsMDB: Transaction[] = await global.database.getCollection<any>(tenant.id, 'transactions')
      .aggregate(aggregation).toArray();
    // Set the Inactivity Status
    for (const transactionMDB of transactionsMDB) {
      // Init extra inactivity
      transactionMDB.stop.inactivityStatus = Utils.getInactivityStatusLevel(
        transactionMDB.chargeBox, transactionMDB.connectorId,
        transactionMDB.stop.totalInactivitySecs + transactionMDB.stop.extraInactivitySecs);
      // Update
      await global.database.getCollection(tenant.id, 'transactions').findOneAndUpdate(
        { '_id': transactionMDB['_id'] },
        { $set: { 'stop.inactivityStatus': transactionMDB.stop.inactivityStatus } },
        { upsert: true, returnOriginal: false }
      );
      modifiedCount++;
    }
    // Log in the default tenant
    if (modifiedCount > 0) {
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'migrateTenant',
        message: `${modifiedCount} Transactions' inactivity status have been updated in Tenant '${tenant.name}'`
      });
    }
  }

  getVersion(): string {
    return '1.0';
  }

  getName(): string {
    return 'AddInactivityStatusInTransactions';
  }

  isAsynchronous(): boolean {
    return true;
  }
}
