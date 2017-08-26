const MigrationTask = require('../MigrationTask');
const MDBTransaction = require('../../storage/mongodb/model/MDBTransaction');
const mongoose = require('mongoose');
const Logging = require('../../utils/Logging');

let MDBStartTransaction = mongoose.model('StartTransaction',{
  _id: String,
  chargeBoxID: {type: String, ref: 'ChargingStation'},
  tagID: {type: String, ref: 'Tag'},
  userID: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
  connectorId: Number,
  timestamp: Date,
  reservationId: Number,
  transactionId: Number,
  meterStart: Number
});

let StopTransaction = module.exports = mongoose.model('StopTransaction',{
  _id: String,
  chargeBoxID: {type: String, ref: 'ChargingStation'},
  tagID: {type: String, ref: 'Tag'},
  userID: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
  transactionId: Number,
  totalConsumption: Number,
  timestamp: Date,
  meterStop: Number,
  reason : String,
  transactionData: []
});

class MigrateStartStopTransactionTask extends MigrationTask {
  constructor() {
    super();
  }

  migrate() {
    // Return
    return new Promise((fulfill, reject) => {
      // Yes
      MDBStartTransaction.aggregate(
          { $lookup: { from: "stoptransactions", localField: "transactionId", foreignField: "transactionId", as: "stop"} },
          { $unwind : { path:"$stop", preserveNullAndEmptyArrays: true } }
        ).then((transactionsMDB) => {
          // Get the Charging Station
          global.storage.getChargingStations().then((chargingStations) => {
            let promises = [];
            // Create transaction
            transactionsMDB.forEach((transactionMDB) => {
              // Create model
              var newTransactionMDB = new MDBTransaction();
              // Set start transaction
              newTransactionMDB._id = transactionMDB.transactionId;
              newTransactionMDB.chargeBoxID = transactionMDB.chargeBoxID;
              newTransactionMDB.tagID = transactionMDB.tagID;
              newTransactionMDB.userID = transactionMDB.userID;
              newTransactionMDB.connectorId = transactionMDB.connectorId;
              newTransactionMDB.timestamp = transactionMDB.timestamp;
              newTransactionMDB.reservationId = transactionMDB.reservationId;
              newTransactionMDB.meterStart = transactionMDB.meterStart;
              // Stop
              if(transactionMDB.stop) {
                newTransactionMDB.stop = {};
                newTransactionMDB.stop.timestamp = transactionMDB.stop.timestamp;
                newTransactionMDB.stop.tagID = transactionMDB.stop.tagID;
                newTransactionMDB.stop.userID = transactionMDB.stop.userID;
                newTransactionMDB.stop.meterStop = transactionMDB.stop.meterStop;
                newTransactionMDB.stop.reason = transactionMDB.stop.reason;
                newTransactionMDB.stop.transactionData = transactionMDB.stop.transactionData;
              }

              // Save first
              newTransactionMDB.save().then(() => {
                // Compute consumption (optimization)
                // Retrieve Charging Station
                let chargingStationFiltered = chargingStations.filter((chargingStation) => {
                  return chargingStation.getID() === newTransactionMDB.chargeBoxID;
                });
                // Found?
                if (chargingStationFiltered.length > 0) {
                  // Yes: use it
                  let chargingStation = chargingStationFiltered[0];
                  let transaction = {};
                  Database.updateTransaction(newTransactionMDB, transaction);
                  // Compute consumption
                  chargingStation.getConsumptionsFromTransaction(transaction, true).then((consumption) => {
                    // Set the total consumption (optimization)
                    newTransactionMDB.stop.totalConsumption = consumption.totalConsumption;
                    // Save the consumption
                    promises.push(newTransactionMDB.save());
                  });
                }
              });
            });
            // Wait
            Promise.all(promises).then((results) => {
              // Log
              Logging.logInfo({
                userFullName: "System", source: "BootStrap", module: "start", method: "-", action: "Migrate",
                message: `Migration task ${this.getName()} version ${this.getVersion()} has migrated ${results.length} records` });
                fulfill("Ok");
            }).catch((error) =>{
              reject(error);
            });
          });
        });
    });
  }

  getName() {
    return "StartStopTransaction";
  }

  getVersion() {
    return "1";
  }
}
module.exports=MigrateStartStopTransactionTask;
