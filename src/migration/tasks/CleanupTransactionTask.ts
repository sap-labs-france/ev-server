import Tenant from '../../entity/Tenant';
import DatabaseUtils from '../../storage/mongodb/DatabaseUtils';
import moment from 'moment';
import Transaction from '../../entity/Transaction';
import Logging from '../../utils/Logging';
import Constants from '../../utils/Constants';
import MigrationTask from '../MigrationTask';
import global from'../../types/GlobalType'; 


export default class CleanupTransactionTask extends MigrationTask {
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
    // Filters
    aggregation.push({
      $match: {
        "stop": {
          $exists: true
        }
      }
    });
    // Add Charger
    aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenant.getID(), 'chargingstations'),
        localField: 'chargeBoxID',
        foreignField: '_id',
        as: 'chargeBox'
      }
    });
    aggregation.push({
      "$match": {
        "$or": [
          {
            "chargeBox": { "$eq": [] }
          },
          { "siteID": null },
          { "siteID": { "$exists": false } }
        ]
      }
    });
    // Read all transactions
    const transactionsMDB = await global.database.getCollection<any>(tenant.getID(), 'transactions')
      .aggregate(aggregation).toArray();
    // Delete
    for (const transactionMDB of transactionsMDB) {
      // Create
      const transaction = new Transaction(tenant.getID(), transactionMDB);
      // Delete
      await transaction.delete();
    }
    // Log
    if (transactionsMDB.length > 0) {
      Logging.logWarning({
        tenantID: Constants.DEFAULT_TENANT,
        source: "CleanupTransactionTask", action: "Migration",
        module: "CleanupTransactionTask", method: "migrate",
        message: `Tenant ${tenant.getName()} (${tenant.getID()}): ${transactionsMDB.length} orphan Transactions have been deleted`
      });
    }
  }

  getVersion() {
    return "1.0";
  }

  getName() {
    return "CleanupTransactionTask";
  }
}

