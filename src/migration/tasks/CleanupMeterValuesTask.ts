import Tenant from '../../entity/Tenant';
import DatabaseUtils from '../../storage/mongodb/DatabaseUtils';
import moment from 'moment';
import Logging from '../../utils/Logging';
import Constants from '../../utils/Constants';
import MigrationTask from '../MigrationTask';
import TSGlobal from '../../types/GlobalType';
declare const global: TSGlobal;

export default class CleanupMeterValuesTask extends MigrationTask {
  public totalCount: any;
  public done: any;
  public startTime: any;

  async migrate() {
    const tenants = await Tenant.getTenants();

    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant) {
    this.totalCount = 0;
    this.done = 0;
    this.startTime = moment();
    // Create Aggregation
    const aggregation = [];
    // Add Charger
    aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenant.getID(), 'transactions'),
        localField: 'transactionId',
        foreignField: '_id',
        as: 'transactions'
      }
    });
    aggregation.push({
      "$match": { "transactions": { "$eq": [] } }
    });
    // Read all transactions
    const meterValuesMDB = await global.database.getCollection<any>(tenant.getID(), 'metervalues')
      .aggregate(aggregation).toArray();
    // Delete
    for (const meterValueMDB of meterValuesMDB) {
      // Delete
      await global.database.getCollection<any>(tenant.getID(), 'metervalues')
        .findOneAndDelete({ '_id': meterValueMDB._id });
    }
    // Log
    if (meterValuesMDB.length > 0) {
      Logging.logWarning({
        tenantID: Constants.DEFAULT_TENANT,
        source: "CleanupMeterValuesTask", action: "Migration",
        module: "CleanupMeterValuesTask", method: "migrate",
        message: `Tenant ${tenant.getName()} (${tenant.getID()}): ${meterValuesMDB.length} orphan Meter Values have been deleted`
      });
    }
  }

  getVersion() {
    return "1.0";
  }

  getName() {
    return "CleanupMeterValuesTask";
  }

  isAsynchronous() {
    return true;
  }
}

