const Tenant = require('../../entity/Tenant');
const DatabaseUtils = require('../../storage/mongodb/DatabaseUtils');
const moment = require('moment');
const Transaction = require('../../entity/Transaction');
const Logging = require('../../utils/Logging');
const Constants = require('../../utils/Constants');
const MigrationTask = require('../MigrationTask');

class CleanupTransactionTask extends MigrationTask {
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
    const transactionsMDB = await global.database.getCollection(tenant.getID(), 'transactions')
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

module.exports = CleanupTransactionTask;
