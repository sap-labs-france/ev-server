const Constants = require('../../../utils/Constants');
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
		return MDBTransaction.findByIdAndRemove( transaction.id ).then((resultTransaction) => {
			result = resultTransaction;
			// Exec request
			return MDBMeterValue.remove({ "transactionId" : transaction.id });
		}).then((resultMeterValue) => {
			// Notify Change
			_centralRestServer.notifyTransactionDeleted(
				{
					"id": transaction.id,
					"chargeBoxID": transaction.chargeBox.id,
					"connectorId": transaction.connectorId,
					"type": Constants.NOTIF_ENTITY_TRANSACTION
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
			if (startTransaction.user) {
				startTransaction.userID = startTransaction.user.getID();
			}
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
						"chargeBoxID": startTransaction.chargeBoxID,
						"connectorId": startTransaction.connectorId,
						"type": Constants.NOTIF_ENTITY_TRANSACTION
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
				transactionMDB.stop.userID = stopTransaction.user.id;
			}
			// Create new
			return transactionMDB.save().then((result) => {
				// Notify
				_centralRestServer.notifyTransactionUpdated(
					{
						"id": stopTransaction.transactionId,
						"type": Constants.NOTIF_ENTITY_TRANSACTION_STOP
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
						"type": Constants.NOTIF_ENTITY_TRANSACTION_METER_VALUES
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

	static handleGetTransactions(searchValue, filter, siteID, numberOfTransactions) {
		// Check Limit
		numberOfTransactions = Utils.checkRecordLimit(numberOfTransactions);
		// Build filter
		let match = {};
		// Filter?
		if (searchValue) {
			// Build filter
			match.$or = [
				{ "_id" : { $regex : searchValue, $options: 'i' } },
				{ "tagID" : { $regex : searchValue, $options: 'i' } },
				{ "chargeBoxID" : { $regex : searchValue, $options: 'i' } }
			];
		}
		// User
		if (filter.userId) {
			match.userID = new ObjectId(filter.userId);
		}
		// Charge Box
		if (filter.chargeBoxID) {
			match.chargeBoxID = filter.chargeBoxID;
		}
		// Connector
		if (filter.connectorId) {
			match.connectorId = parseInt(filter.connectorId);
		}
		// Date provided?
		if (filter.startDateTime || filter.endDateTime) {
			match.timestamp = {};
		}
		// Start date
		if (filter.startDateTime) {
			match.timestamp.$gte = new Date(filter.startDateTime);
		}
		// End date
		if (filter.endDateTime) {
			match.timestamp.$lte = new Date(filter.endDateTime);
		}
		// Check stop tr
		if (filter.stop) {
			match.stop = filter.stop;
		}
		// Create Aggregation
		let aggregation = [];
		// Filters
		if (match) {
			aggregation.push({
				$match: match
			});
		}
		// Add Charge Box
		aggregation.push({
			$lookup: {
				from: 'chargingstations',
				localField: 'chargeBoxID',
				foreignField: '_id',
				as: 'chargeBoxID'
			}
		});
		// Single Record
		aggregation.push({
			$unwind: "$chargeBoxID"
		});
		if (siteID) {
			// Add Site Area
			aggregation.push({
				$lookup: {
					from: 'siteareas',
					localField: 'chargeBoxID.siteAreaID',
					foreignField: '_id',
					as: 'siteAreaID'
				}
			});
			// Single Record
			aggregation.push({
				$unwind: { "path": "$siteAreaID", "preserveNullAndEmptyArrays": true }
			});
			// Filter
			aggregation.push({
				$match: { "siteAreaID.siteID": new ObjectId(siteID) }
			});
		}
		// Sort
		aggregation.push({
			$sort: { timestamp: -1 }
		});
		// Limit
		if (numberOfTransactions > 0) {
			aggregation.push({
				$limit: numberOfTransactions
			});
		}
		// Add User that started the transaction
		aggregation.push({
			$lookup: {
				from: 'users',
				localField: 'userID',
				foreignField: '_id',
				as: 'userID'
			}
		});
		// Single Record
		aggregation.push({
			$unwind: { "path": "$userID", "preserveNullAndEmptyArrays": true }
		});
		// Add User that stopped the transaction
		aggregation.push({
			$lookup: {
				from: 'users',
				localField: 'stop.userID',
				foreignField: '_id',
				as: 'stop.userID'
			}
		});
		// Single Record
		aggregation.push({
			$unwind: { "path": "$stop.userID", "preserveNullAndEmptyArrays": true }
		});
		// Execute
		return MDBTransaction.aggregate(aggregation)
				.exec().then((transactionsMDB) => {
			// Set
			let transactions = [];
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

	static handleGetTransaction(transactionId) {
		// Get the Start Transaction
		return MDBTransaction.findById({"_id": transactionId})
				.populate("userID")
				.populate("chargeBoxID")
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

	static handleGetActiveTransaction(chargeBoxID, connectorID) {
		// Get the Active Transaction
		return MDBTransaction.find({
					"chargeBoxID": chargeBoxID,
					"connectorId": connectorID,
					"stop": { $exists: false }
				}).then((transactionsMDB) => {
			// Set
			let transaction = null;
			// Found?
			if (transactionsMDB && transactionsMDB.length > 0) {
				// Set data
				transaction = {};
				Database.updateTransaction(transactionsMDB[0], transaction);
			}
			// Ok
			return transaction;
		});
	}
}

module.exports = TransactionStorage;
