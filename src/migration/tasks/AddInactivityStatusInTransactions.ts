import DatabaseUtils from '../../storage/mongodb/DatabaseUtils';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import global from '../../types/GlobalType';
import Tenant from '../../types/Tenant';
import Transaction from '../../types/Transaction';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import MigrationTask from '../MigrationTask';

export default class AddInactivityStatusInTransactions extends MigrationTask {
  async migrate() {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant) {
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
      tenantID: tenant.id,
      aggregation: aggregation,
      localField: 'chargeBoxID',
      foreignField: '_id',
      asField: 'chargeBox',
      oneToOneCardinality: true,
      oneToOneCardinalityNotNull: false
    });
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
        module: 'AddInactivityStatusInTransactions', method: 'migrateTenant',
        action: 'AddInactivityStatusInTransactions',
        message: `${modifiedCount} Transactions' inactivity status have been updated in Tenant '${tenant.name}'`
      });
    }
  }

  getVersion() {
    return '1.0';
  }

  getName() {
    return 'AddInactivityStatusInTransactions';
  }

  isAsynchronous() {
    return true;
  }
}
