import BBPromise from 'bluebird';
import Constants from '../../utils/Constants';
import TSGlobal from '../../types/GlobalType';
import MigrationTask from '../MigrationTask';
import OCPPStorage from '../../storage/mongodb/OCPPStorage';
import Tenant from '../../entity/Tenant';
declare const global: TSGlobal;

export default class UpdateTransactionExtraInactivityTask extends MigrationTask {
  async migrate() {
    const tenants = await Tenant.getTenants();
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant) {
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: {
        'stop': { $exists: true },
        'stop.extraInactivitySecs': { $exists: false }
      }
    });
    // Read DB
    const transactionsMDB = await global.database.getCollection<any>(tenant.getID(), 'transactions')
      .aggregate(aggregation)
      .toArray();

    // Process them
    await BBPromise.map(transactionsMDB, async (transactionMDB) => {
      // Get the last status
      const statusNotifications = await OCPPStorage.getStatusNotifications(tenant.getID(), {
        chargeBoxID: transactionMDB.chargeBoxID,
        connectorId: transactionMDB.connectorId,
        status: Constants.CONN_STATUS_AVAILABLE,
        dateFrom: transactionMDB.stop.timestamp,
      }, 1, 0, { timestamp: 1 });
      // Check
      if (statusNotifications.count > 0) {
        const statusNotification = statusNotifications.result[0];
        // Compute the extra inactivity
        const transactionStopTimestamp = new Date(transactionMDB.stop.timestamp);
        const statusNotifTimestamp = new Date(statusNotification.timestamp);
        // Set
        transactionMDB.stop.extraInactivitySecs = Math.floor((statusNotifTimestamp.getTime() - transactionStopTimestamp.getTime()) / 1000);
      } else {
        // Set
        transactionMDB.stop.extraInactivitySecs = 0;
      }
      // Save
      await global.database.getCollection<any>(tenant.getID(), 'transactions').findOneAndUpdate(
        { '_id': transactionMDB._id },
        { $set: transactionMDB },
        { upsert: true, returnOriginal: false }
      );
    },
    { concurrency: 5 });
  }

  isAsynchronous() {
    return true;
  }

  getVersion() {
    return '1.0';
  }

  getName() {
    return 'UpdateTransactionExtraInactivityTask';
  }
}

