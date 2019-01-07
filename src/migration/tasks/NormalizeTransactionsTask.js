const Tenant = require('../../entity/Tenant');
const PricingStorage = require('../../storage/mongodb/PricingStorage');
const moment = require('moment');

class NormalizeTransactionsTask {
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
        "stop": {
          $exists: true
        }
      }
    });
    // Get the price
    const pricing = await PricingStorage.getPricing(tenant.getID());
    // Read all transactions
    const transactionsMDB = await global.database.getCollection(tenant.getID(), 'transactions')
      .aggregate(aggregation)
      .toArray();
    // Process each transaction
    for (const transactionMDB of transactionsMDB) {
      const transaction = {};
      // Update field
      transaction.chargeBoxID = transactionMDB.chargeBoxID;
      transaction.connectorId = transactionMDB.connectorId;
      transaction.meterStart = transactionMDB.meterStart;
      transaction.timestamp = transactionMDB.timestamp;
      transaction.tagID = transactionMDB.tagID;
      transaction.userID = transactionMDB.userID;
      if (transactionMDB.hasOwnProperty('stateOfCharge')) {
        transaction.stateOfCharge = transactionMDB.stateOfCharge;
      } else {
        transaction.stateOfCharge = 0;
      }
      transaction.stop = {};
      transaction.stop.meterStop = transactionMDB.stop.meterStop;
      transaction.stop.timestamp = transactionMDB.stop.timestamp;
      transaction.stop.totalConsumption = transactionMDB.stop.totalConsumption;
      transaction.stop.totalInactivitySecs = transactionMDB.stop.totalInactivitySecs;
      if (transactionMDB.stop.hasOwnProperty('tagID')) {
        transaction.stop.tagID = transactionMDB.stop.tagID;
      } else {
        transaction.stop.tagID = transactionMDB.tagID;
      }
      if (transactionMDB.stop.hasOwnProperty('userID')) {
        transaction.stop.userID = transactionMDB.stop.userID;
      } else {
        transaction.stop.userID = transactionMDB.userID;
      }
      if (transactionMDB.stop.hasOwnProperty('totalDurationSecs')) {
        transaction.stop.totalDurationSecs = transactionMDB.stop.totalDurationSecs;
      } else {
        transaction.stop.totalDurationSecs = moment.duration(moment(transactionMDB.stop.timestamp).diff(moment(transactionMDB.timestamp))).asSeconds();
      }
      if (transactionMDB.stop.hasOwnProperty('stateOfCharge')) {
        transaction.stop.stateOfCharge = transactionMDB.stop.stateOfCharge;
      } else {
        transaction.stop.stateOfCharge = 0;
      }
      if (pricing) {
        transaction.stop.priceUnit = pricing.priceUnit;
        transaction.stop.price = pricing.priceKWH * (transactionMDB.stop.totalConsumption / 1000);
      } else {
        transaction.stop.priceUnit = "";
        transaction.stop.price = 0;
      }
      // Save it
      await global.database.getCollection(tenant.getID(), 'transactions').findOneAndReplace(
        { "_id": transactionMDB._id },
        transaction, 
        { upsert: true, new: true, returnOriginal: false });
    }
  }

  getVersion() {
    return "1.0";
  }

  getName() {
    return "NormalizeTransactions";
  }
}

module.exports = NormalizeTransactionsTask;