import moment from 'moment';
import DatabaseUtils from '../../storage/mongodb/DatabaseUtils';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import global from '../../types/GlobalType';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';

export default class CleanupMeterValuesTask extends MigrationTask {
  public totalCount: any;
  public done: any;
  public startTime: any;

  async migrate() {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);

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
    // Add Charging Station
    aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenant.id, 'transactions'),
        localField: 'transactionId',
        foreignField: '_id',
        as: 'transactions'
      }
    });
    aggregation.push({
      '$match': { 'transactions': { '$eq': [] } }
    });
    // Read all transactions
    const meterValuesMDB = await global.database.getCollection<any>(tenant.id, 'metervalues')
      .aggregate(aggregation).toArray();
    // Delete
    for (const meterValueMDB of meterValuesMDB) {
      // Delete
      await global.database.getCollection<any>(tenant.id, 'metervalues')
        .findOneAndDelete({ '_id': meterValueMDB._id });
    }
    // Log
    if (meterValuesMDB.length > 0) {
      Logging.logWarning({
        tenantID: Constants.DEFAULT_TENANT,
        source: 'CleanupMeterValuesTask', action: 'Migration',
        module: 'CleanupMeterValuesTask', method: 'migrate',
        message: `Tenant ${tenant.name} (${tenant.id}): ${meterValuesMDB.length} orphan Meter Values have been deleted`
      });
    }
  }

  getVersion() {
    return '1.0';
  }

  getName() {
    return 'CleanupMeterValuesTask';
  }

  isAsynchronous() {
    return true;
  }
}

