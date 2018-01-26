const Logging = require('../../../utils/Logging');
const Database = require('../../../utils/Database');
const Utils = require('../../../utils/Utils');
const MDBMeterValue = require('../model/MDBMeterValue');
const MDBTransaction = require('../model/MDBTransaction');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const crypto = require('crypto');

let _centralRestServer;

class TransactionStorage {
	static setCentralRestServer(centralRestServer) {
		_centralRestServer = centralRestServer;
	}

	static handleDeleteTransaction(transaction) {
		let result;
		return MDBTransaction.remove({ "_id" : transaction.id }).then((resultTransaction) => {
			result = resultTransaction;
			// Exec request
			return MDBMeterValue.remove({ "transactionId" : transaction.id });
		}).then((resultMeterValue) => {
			// Notify Change
			_centralRestServer.notifyTransactionDeleted(
				{
					"id": transaction.id,
					"connectorId": transaction.connectorId,
					"chargeBoxIdentity": transaction.chargeBoxID.id,
					"type": "Transaction"
				}
			);
			return result.result;
		});
	}

	static handleGetMeterValuesFromTransaction(transactionId) {
		// Build filter
		let filter = {};
		// Mandatory filters
		filter.transactionId = transactionId;

		// Exec request
		return MDBMeterValue.find(filter).sort( {timestamp: 1, value: -1} ).exec().then((meterValuesMDB) => {
			let meterValues = [];
			// Create
			meterValuesMDB.forEach((meterValueMDB) => {
				let meterValue = {};
				// Set values
				Database.updateMeterValue(meterValueMDB, meterValue);
				// Add
				meterValues.push(meterValue);
			});
			// Ok
			return meterValues;
		});
	}
	static handleSaveStartTransaction(startTransaction) {
		// Already created?
		if (!startTransaction.id) {
			// No: Set a new ID
			startTransaction.id = startTransaction.transactionId;
			startTransaction.userID = startTransaction.user.getID();
			startTransaction.tagID = startTransaction.idTag;
		}

		// Get
		return MDBTransaction.findOneAndUpdate({"_id": startTransaction.id}, startTransaction, {
				new: true,
				upsert: true
			}).then((startTransactionMDB) => {
				// Notify
				_centralRestServer.notifyTransactionCreated(
					{
						"id": startTransaction.id,
						"connectorId": startTransaction.connectorId,
						"chargeBoxIdentity": startTransaction.chargeBoxID,
						"type": "Transaction"
					}
				);
			});
	}

	static handleSaveStopTransaction(stopTransaction) {
		// Get the Start Transaction
		return MDBTransaction.findById({"_id": stopTransaction.transactionId}).then((transactionMDB) => {
			// Create model
			transactionMDB.stop = stopTransaction;
			// Set the User data
			if(stopTransaction.idTag) {
				transactionMDB.stop.tagID = stopTransaction.idTag;
			}
			if(stopTransaction.user) {
				transactionMDB.stop.userID = stopTransaction.user.getID();
			}
			// Create new
			return transactionMDB.save().then(() => {
				// Notify
				_centralRestServer.notifyTransactionUpdated(
					{
						"id": stopTransaction.transactionId,
						"type": "Stop"
					}
				);
			});
		});
	}

	static handleSaveMeterValues(meterValues) {
		// Save all
		return Promise.all(meterValues.values.map(meterValue => {
			// Create model
			let meterValueMDB = new MDBMeterValue(meterValue);
			// Set the ID
			let attribute = JSON.stringify(meterValue.attribute);
			meterValueMDB._id = crypto.createHash('sha256')
				.update(`${meterValue.chargeBoxID}~${meterValue.connectorId}~${meterValue.timestamp}~${meterValue.value}~${attribute}`)
				.digest("hex");
			// Save
			return meterValueMDB.save().then(() => {
				// Notify
				_centralRestServer.notifyTransactionUpdated(
					{
						"id": meterValues.values[0].transactionId,
						"type": "MeterValues"
					}
				);
			});
		}));
	}

	static handleGetTransactionYears() {
		// Yes: Get only active ones
		return MDBTransaction.findOne({})
				.sort({timestamp:1})
				.limit(1)
				.exec().then(firstTransactionMDB => {
			if (!firstTransactionMDB) {
				return null;
			}
			let transactionYears = [];
			// Push the rest of the years up to now
			for (var i = new Date(firstTransactionMDB.timestamp).getFullYear(); i <= new Date().getFullYear(); i++) {
				// Add
				transactionYears.push(i);
			}
			return transactionYears;
		});
	}

	static handleGetTransactions(searchValue, filter, withPicture, numberOfTransactions) {
		// Build filter
		let $match = {};
		// User
		if (filter.userId) {
			$match.userID = new ObjectId(filter.userId);
		}
		// Charge Box
		if (filter.chargeBoxIdentity) {
			$match.chargeBoxID = filter.chargeBoxIdentity;
		}
		// Connector
		if (filter.connectorId) {
			$match.connectorId = parseInt(filter.connectorId);
		}
		// Date provided?
		if (filter.startDateTime || filter.endDateTime) {
			$match.timestamp = {};
		}
		// Start date
		if (filter.startDateTime) {
			$match.timestamp.$gte = new Date(filter.startDateTime);
		}
		// End date
		if (filter.endDateTime) {
			$match.timestamp.$lte = new Date(filter.endDateTime);
		}
		// Check stop tr
		if (filter.stop) {
			$match.stop = filter.stop;
		}
		// Check Limit
		numberOfTransactions = Utils.checkRecordLimit(numberOfTransactions);
		// Yes: Get only active ones
		return MDBTransaction.find($match)
				.limit(numberOfTransactions)
				.populate("userID", (withPicture?{}:{image:0}))
				.populate("chargeBoxID")
				.populate("stop.userID")
				.sort({timestamp:-1})
				.exec().then(transactionsMDB => {
			// Set
			let transactions = [];
			// Filter
			transactionsMDB = TransactionStorage._filterTransactions(transactionsMDB, searchValue);
			// Create
			transactionsMDB.forEach((transactionMDB) => {
				// Set
				let transaction = {};
				Database.updateTransaction(transactionMDB, transaction);
				// Add
				transactions.push(transaction);
			});
			return transactions;
		});
	}

	static handleGetTransaction(transactionId, withPicture) {
		// Get the Start Transaction
		return MDBTransaction.findById({"_id": transactionId}).populate("userID", (withPicture?{}:{image:0})).populate("chargeBoxID")
				.populate("stop.userID").exec().then((transactionMDB) => {
			// Set
			let transaction = null;
			// Found?
			if (transactionMDB) {
				// Set data
				transaction = {};
				Database.updateTransaction(transactionMDB, transaction);
			}
			// Ok
			return transaction;
		});
	}

	static _filterTransactions(transactionsMDB, searchValue) {
		let regexp = new RegExp(searchValue, 'i');
		// Check User and ChargeBox
		return transactionsMDB.filter((transactionMDB) => {
			// User not found?
			if (!transactionMDB.userID) {
				Logging.logError({
					module: "MongoDBStorage", method: "getTransactions",
					message: `Transaction ID '${transactionMDB.id}': User does not exist` });
				return false;
			}
			// Charge Box not found?
			if (!transactionMDB.chargeBoxID) {
				Logging.logError({
					module: "MongoDBStorage", method: "getTransactions",
					message: `Transaction ID '${transactionMDB.id}': Charging Station does not exist` });
				return false;
			}
			// Filter?
			if (searchValue) {
				// Yes { $regex : searchValue, $options: 'i' }
				return regexp.test(transactionMDB.chargeBoxID.id.toString()) ||
					regexp.test(transactionMDB.userID.name.toString()) ||
					regexp.test(transactionMDB.userID.firstName.toString());
			}
			// Default ok
			return true;
		});
	}
}

module.exports = TransactionStorage;
