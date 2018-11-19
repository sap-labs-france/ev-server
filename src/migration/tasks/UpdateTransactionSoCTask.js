const Database = require('../../utils/Database');
const Tenant = require('../../entity/Tenant');
const DatabaseUtils = require('../../storage/mongodb/DatabaseUtils');

class UpdateTransactionSoCTask {
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
        "attribute.context": {
          $in: ['Transaction.Begin', 'Transaction.End']
        },
        "attribute.measurand": 'SoC'
      }
    });
    // Add Transaction
    aggregation.push({
			$lookup: {
			  "from": DatabaseUtils.getCollectionName(tenant.getID(), 'transactions'),
			  "localField": "transactionId",
			  "foreignField": "_id",
			  "as": "transaction"
			}
    });
    aggregation.push({
			$unwind: {
        path : "$transaction",
        preserveNullAndEmptyArrays : false
      }
    });
    // Filters
    aggregation.push({
			$match: {
			  "transaction.stop": {
			    "$exists": true
			  }
			}
    });
    // Sort
    aggregation.push({
      $sort: { timestamp: -1 }
    });
    // Read DB
    const meterValuesMDB = await global.database.getCollection(tenant.getID(), 'metervalues')
      .aggregate(aggregation)
      .toArray();
    // Transaction Processed
    const transactionsProcessed = [];
    // Process each transaction
    for (const meterValueMDB of meterValuesMDB) {
      // Check
      if (!meterValueMDB.transaction.hasOwnProperty('stateOfCharge')) {
        // Default
        meterValueMDB.transaction.stateOfCharge = 0;
      }
      // Check
      if (!meterValueMDB.transaction.stop.hasOwnProperty('stateOfCharge')) {
        // Default
        meterValueMDB.transaction.stop.stateOfCharge = 0;
      }
      // Add
      let foundTransaction = transactionsProcessed.find((transactionProcessed) => transactionProcessed._id ===  meterValueMDB.transaction._id);
      if (!foundTransaction) {
        // Add
        transactionsProcessed.push(meterValueMDB.transaction);
        // Set
        foundTransaction = meterValueMDB.transaction;
      }
      // Check Transaction Begin
      if (meterValueMDB.attribute.context === "Transaction.Begin") {
        // Set the Start SoC
        foundTransaction.stateOfCharge = meterValueMDB.value;
      // Check Transaction End
      } else if (meterValueMDB.attribute.context === "Transaction.End") {
        // Set the End SoC
        foundTransaction.stop.stateOfCharge = meterValueMDB.value;
      }
      const transaction = {};
      // Update
      Database.updateTransaction(foundTransaction, transaction, false);
      // Save it
      await global.database.getCollection(tenant.getID(), 'transactions').findOneAndUpdate({
        "_id": meterValueMDB.transaction._id
      }, {
        $set: transaction
      }, {
        upsert: true,
        new: true,
        returnOriginal: false
      });
    }
  }

  getVersion() {
    return "1.0";
  }

  getName() {
    return "TransactionSoCTask";
  }
}

module.exports = UpdateTransactionSoCTask;