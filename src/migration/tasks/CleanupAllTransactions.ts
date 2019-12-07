import Constants from '../../utils/Constants';
import global from '../../types/GlobalType';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Transaction from '../../types/Transaction';
import { DBOCPPStatusNotification } from '../../types/ocpp/OCPPStatusNotification';

export default class CleanupAllTransactions extends MigrationTask {
  async migrate() {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant) {
    // Remove useless properties
    await this.removeUselessProperties(tenant);
    // Recompute extra inactivity
    await this.updateExtraInactivity(tenant);
  }

  async updateExtraInactivity(tenant: Tenant) {
    let modifiedCount = 0;
    // Get all transactions
    const transactionsMDB: Transaction[] = await global.database.getCollection<any>(tenant.id, 'transactions').find(
      {
        'stop': { $exists: true },
        'stop.extraInactivityComputed': { $exists: false }
      }
    ).toArray();
    for (const transactionMDB of transactionsMDB) {
      // Get the two last Status
      const statusNotificationsMDB: DBOCPPStatusNotification[] = await global.database.getCollection<any>(tenant.id, 'statusnotifications').find(
        {
          chargeBoxID: transactionMDB.chargeBoxID,
          connectorId: transactionMDB.connectorId,
          timestamp: { $gt: new Date(new Date(transactionMDB.stop.timestamp).getTime() - 1000) }
        }
      ).sort({timestamp: 1}).limit(2).toArray();
      // Check for Extra Inactivity
      if (statusNotificationsMDB.length === 2 &&
          new Date(statusNotificationsMDB[0].timestamp).getTime() - new Date(transactionMDB.stop.timestamp).getTime() < 5000 &&
          statusNotificationsMDB[0].status === Constants.CONN_STATUS_FINISHING &&
          statusNotificationsMDB[1].status === Constants.CONN_STATUS_AVAILABLE) {
        // Init extra inactivity
        transactionMDB.stop.extraInactivitySecs = Math.floor(
          (new Date(statusNotificationsMDB[1].timestamp).getTime() - new Date(transactionMDB.stop.timestamp).getTime()) / 1000);
        transactionMDB.stop.extraInactivityComputed = true;
      } else {
        // Init extra inactivity
        transactionMDB.stop.extraInactivitySecs = 0;
        transactionMDB.stop.extraInactivityComputed = true;
      }
      // Update
      // Update
      await global.database.getCollection(tenant.id, 'transactions').findOneAndUpdate(
        { '_id': transactionMDB['_id'] },
        { $set: transactionMDB },
        { upsert: true, returnOriginal: false }
      );
      modifiedCount++;
    }
    // Log in the default tenant
    if (modifiedCount > 0) {
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        module: 'CleanupAllTransactions', method: 'migrateTenant',
        action: 'CleanUpTransactions',
        message: `${modifiedCount} Transactions' extra inactivity have been updated in Tenant '${tenant.name}'`
      });
    }
  }

  async removeUselessProperties(tenant: Tenant) {
    const result = await global.database.getCollection<any>(tenant.id, 'transactions').updateMany(
      { 'stop': { $exists: true } },
      {
        $unset: {
          'currentTotalInactivitySecs' : '',
          'currentCumulatedPrice' : '',
          'currentConsumption' : '',
          'currentTotalConsumption' : '',
          'currentStateOfCharge' : '',
          'currentSignedData' : '',
          'lastMeterValue' : '',
          'createdBy' : '',
          'lastChangedBy' : '',
          'numberOfMeterValues': ''
        }
      },
      { upsert: false }
    );
    // Log in the default tenant
    if (result.modifiedCount > 0) {
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        module: 'CleanupAllTransactions', method: 'migrateTenant',
        action: 'CleanUpTransactions',
        message: `${result.modifiedCount} Transactions have been cleaned in Tenant '${tenant.name}'`
      });
    }
  }

  getVersion() {
    return '1.0';
  }

  getName() {
    return 'CleanupAllTransactions';
  }

  isAsynchronous() {
    return true;
  }
}
