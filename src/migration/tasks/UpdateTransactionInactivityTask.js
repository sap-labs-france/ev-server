const moment = require('moment');
const Database = require('../../utils/Database');
const ChargingStation = require('../../entity/ChargingStation');

class UpdateTransactionInactivityTask {
  async migrate() {
    // Create Aggregation
    let aggregation = [];
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
        from: 'chargingstations',
        localField: 'chargeBoxID',
        foreignField: '_id',
        as: 'chargeBox'
      }
    });
    // Single Record
    aggregation.push({
      $unwind: {
        "path": "$chargeBox",
        "preserveNullAndEmptyArrays": true
      }
    });
    // Sort
    aggregation.push({
      $sort: { timestamp: -1 }
    });
    // Read DB
    let transactionsMDB = await global.db.collection('transactions')
      .aggregate(aggregation)
      .toArray();
    // Process each transaction
    for (const transactionMDB of transactionsMDB) {
      let transaction = {};
      // Update
      Database.updateTransaction(transactionMDB, transaction);
      // Get the Charging Station
      let chargingStation = new ChargingStation(transactionMDB.chargeBox);
      // Get Consumption
      let consumption = await chargingStation.getConsumptionsFromTransaction(transaction);
      // Set the total consumption
      transactionMDB.stop.totalConsumption = consumption.totalConsumption;
      // Compute total inactivity seconds
      transactionMDB.stop.totalInactivitySecs = 0;
      consumption.values.forEach((value, index) => {
        // Don't check the first
        if (index > 0) {
          // Check value + Check Previous value
          if (value.value == 0 && consumption.values[index - 1].value == 0) {
            // Add the inactivity in secs
            transactionMDB.stop.totalInactivitySecs += moment.duration(
              moment(value.date).diff(moment(consumption.values[index - 1].date))
            ).asSeconds();
          }
        }
      });
      // Save it
      await global.db.collection('transactions').findOneAndUpdate({
        "_id": transactionMDB._id
      }, {
        $set: transactionMDB
      });
    }
  }

  getVersion() {
    return "2";
  }

  getName() {
    return "TransactionInactivityTask";
  }
}
module.exports = UpdateTransactionInactivityTask;