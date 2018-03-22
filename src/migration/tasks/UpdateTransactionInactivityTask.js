const MDBTransaction = require('../../storage/mongodb/model/MDBTransaction');
const Database = require('../../utils/Database');
const ChargingStation = require('../../model/ChargingStation');
const moment = require('moment');

class UpdateTransactionInactivityTask {
	processTransactionBlock() {
		return new Promise((fulfill, reject) => {
			// Get the Active Transaction
			let blockNumberOfTr;
			// Get a block of 10 transactions
			MDBTransaction.find({
    					"stop" : { $exists: true },
						"stop.totalInactivitySecs" : { $exists: false }
					})
					.populate("chargeBoxID")
					.limit(10)
					.exec().then((transactionsMDB) => {
				// Process
				blockNumberOfTr = transactionsMDB.length;
				let proms = [];
				// Treat each transaction
				transactionsMDB.forEach((transactionMDB, index) => {
					// Transaction Ended?
					if (transactionMDB.stop) {
						// Create promise
						proms.push(new Promise((fulfill, reject) => {
							let transaction = {};
							// UpdateindexTr
							Database.updateTransaction(transactionMDB, transaction);
							// Get the Charging Station
							let chargingStation = new ChargingStation(transactionMDB.chargeBoxID);
							// Get Consumption
							chargingStation.getConsumptionsFromTransaction(transaction, false).then((consumption) => {
								// Compute total inactivity seconds
								transactionMDB.stop.totalInactivitySecs = 0;
								consumption.values.forEach((value, index) => {
									// Don't check the first
									if (index > 0) {
										// Check value + Check Previous value
										if (value.value == 0 && consumption.values[index-1].value == 0) {
											// Add the inactivity in secs
											transactionMDB.stop.totalInactivitySecs += moment.duration(
												moment(value.date).diff(moment(consumption.values[index-1].date))
											).asSeconds();
										}
									}
								});
								// Save it without the User
								return transactionMDB.save();
								// return Promise.resolve();
							}).then((result) => {
								fulfill();
							}).catch((error) => {
								// Error
								reject(error);
							});
						}));
					}
				});
				// Get all consumptions
				return Promise.all(proms);
			}).then((results) => {
				// End of processing?
				if ((blockNumberOfTr == 0) || (blockNumberOfTr % 10) != 0) {
					// Finished
					fulfill();
				} else {
					// Process next block
					this.processTransactionBlock().then(() => {
						// Ok
						fulfill();
					});
				}
			}).catch((error) => {
				// Error
				reject(error);
			});
		});
	}

	migrate(config={}) {
		return new Promise((fulfill, reject) => {
			// Start time
			let startTaskTime = moment();
			// Process
			this.processTransactionBlock().then(() => {
				// End time
				let totalTaskTimeSecs = moment.duration(moment().diff(startTaskTime)).asSeconds();
				// Ok
				fulfill({ "totalTaskTimeSecs": totalTaskTimeSecs });
			});
		});
	}

	getVersion() {
		return "1";
	}

	getName() {
		return "TransactionInactivityTask";
	}
}
module.exports=UpdateTransactionInactivityTask;
