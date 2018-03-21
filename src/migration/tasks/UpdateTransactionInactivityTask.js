const MDBTransaction = require('../../storage/mongodb/model/MDBTransaction');
const Database = require('../../utils/Database');
const ChargingStation = require('../../model/ChargingStation');
const moment = require('moment');

class UpdateTransactionInactivityTask {
	migrate(config={}) {
		return new Promise((fulfill, reject) => {
			// Start time
			let startTaskTime = moment();
			// Get the Active Transaction
			MDBTransaction.find({
						"stop.totalInactivitySecs" : { $exists: false }
					})
					.populate("chargeBoxID")
					.exec().then((transactionsMDB) => {
				// Process
				console.log("Tr Nbr: " + transactionsMDB.length);
				let proms = [];
				transactionsMDB.forEach((transactionMDB, indexTr) => {
					let transaction = {};
					// Update
					Database.updateTransaction(transactionMDB, transaction);
					// Get the Charging Station
					let chargingStation = new ChargingStation(transactionMDB.chargeBoxID);
					// Get Consumption
					proms.push(chargingStation.getConsumptionsFromTransaction(transaction, true));
					// proms.push(Promise.resolve());
				});
				console.log("Proms: " + proms.length);
				// Get all consumptions
				return Promise.all(proms);
			}).then((consumptions) => {
				console.log(consumptions.length);
				console.log(consumptions[0]);
				// End time
				let totalTaskTimeSecs = moment.duration(moment().diff(startTaskTime)).asSeconds();
				// Ok
				fulfill({ "totalTaskTimeSecs": totalTaskTimeSecs });
				// // Transaction Ended?
				// if (transactionMDB.stop) {
				// 	// Compute total inactivity seconds
				// 	transactionMDB.stop.totalInactivitySecs = 0;
				// 	consumption.values.forEach((value, index) => {
				// 		// Don't check the first
				// 		if (index > 0) {
				// 			// Check value + Check Previous value
				// 			if (value.value == 0 && consumption.values[index-1].value == 0) {
				// 				// Add the inactivity in secs
				// 				stopTransaction.totalInactivitySecs += moment.duration(
				// 					moment(value.date).diff(moment(consumption.values[index-1].date))
				// 				).asSeconds();
				// 			}
				// 		}
				// 	});
				// }
			}).catch((error) => {
				// Error
				reject(error);
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
