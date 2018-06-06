const Constants = require('../../../utils/Constants');
const Logging = require('../../../utils/Logging');
const Database = require('../../../utils/Database');
const Utils = require('../../../utils/Utils');
const MDBMeterValue = require('../model/MDBMeterValue');
const MDBTransaction = require('../model/MDBTransaction');
const mongoose = require('mongoose');
const crypto = require('crypto');
const ObjectID = require('mongodb').ObjectID;

let _db;

class TransactionStorage {
	static setDatabase(db) {
		_db = db;
	}

	static async handleDeleteTransaction(transaction) {
		// Delete Transactions
		await _db.collection('transactions')
			.findOneAndDelete( {'_id': transaction.id} );
		// Delete Meter Values
		await _db.collection('metervalues')
			.deleteMany( {'transactionId': transaction.id} );
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

	static handleSaveTransaction(transaction) {
		let transactionCreated = !transaction.stop;
		// Update
		return MDBTransaction.findOneAndUpdate({"_id": transaction.id}, transaction, {
			new: true,
			upsert: true
		}).then((transactionMDB) => {
			// Create
			let transaction = {};
			// Update
			Database.updateTransaction(transactionMDB, transaction);
			// // Notify
			// if (transactionCreated) {
			// 	// Created
			// 	_centralRestServer.notifyTransactionCreated(
			// 		{
			// 			"id": transaction.id,
			// 			"chargeBoxID": transaction.chargeBoxID,
			// 			"connectorId": transaction.connectorId,
			// 			"type": Constants.ENTITY_TRANSACTION
			// 		}
			// 	);
			// } else {
			// 	// Updated
			// 	_centralRestServer.notifyTransactionUpdated(
			// 		{
			// 			"id": transaction.id,
			// 			"chargeBoxID": transaction.chargeBoxID,
			// 			"connectorId": transaction.connectorId,
			// 			"type": Constants.ENTITY_TRANSACTION_STOP
			// 		}
			// 	);
			// }
			// Return
			return transaction;
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
				// // Notify
				// _centralRestServer.notifyTransactionUpdated(
				// 	{
				// 		"id": meterValues.values[0].transactionId,
				// 		"type": Constants.ENTITY_TRANSACTION_METER_VALUES
				// 	}
				// );
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

	static async handleGetTransactions(searchValue, filter, siteID, numberOfTransactions) {
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
			match.userID = Utils.convertToObjectID(filter.userId);
		}
		// Charge Box
		if (filter.chargeBoxID) {
			match.chargeBoxID = filter.chargeBoxID;
		}
		// Connector
		if (filter.connectorId) {
			match.connectorId = Utils.convertToNumber(filter.connectorId);
		}
		// Date provided?
		if (filter.startDateTime || filter.endDateTime) {
			match.timestamp = {};
		}
		// Start date
		if (filter.startDateTime) {
			match.timestamp.$gte = Utils.convertToDate(filter.startDateTime);
		}
		// End date
		if (filter.endDateTime) {
			match.timestamp.$lte = Utils.convertToDate(filter.endDateTime);
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
				as: 'chargeBox'
			}
		});
		// Single Record
		aggregation.push({
			$unwind: { "path": "$chargeBox", "preserveNullAndEmptyArrays": true }
		});
		if (siteID) {
			// Add Site Area
			aggregation.push({
				$lookup: {
					from: 'siteareas',
					localField: 'chargeBox.siteAreaID',
					foreignField: '_id',
					as: 'siteArea'
				}
			});
			// Single Record
			aggregation.push({
				$unwind: { "path": "$siteArea", "preserveNullAndEmptyArrays": true }
			});
			// Filter
			aggregation.push({
				$match: { "siteArea.siteID": Utils.convertToObjectID(siteID) }
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
				as: 'user'
			}
		});
		// Single Record
		aggregation.push({
			$unwind: { "path": "$user", "preserveNullAndEmptyArrays": true }
		});
		// Add User that stopped the transaction
		aggregation.push({
			$lookup: {
				from: 'users',
				localField: 'stop.userID',
				foreignField: '_id',
				as: 'stop.user'
			}
		});
		// Single Record
		aggregation.push({
			$unwind: { "path": "$stop.user", "preserveNullAndEmptyArrays": true }
		});
		// Read DB
		let transactionsMDB = await _db.collection('transactions')
			.aggregate(aggregation)
			.toArray();
		// Set
		let transactions = [];
		// Create
		if (transactionsMDB && transactionsMDB.length > 0) {
			// Create
			transactionsMDB.forEach((transactionMDB) => {
				// Set
				let transaction = {};
				Database.updateTransaction(transactionMDB, transaction);
				// Add
				transactions.push(transaction);
			});
		}
		return transactions;
	}

	static async handleGetTransaction(id) {
		// Create Aggregation
		let aggregation = [];
		// Filters
		aggregation.push({
			$match: { _id: Utils.convertToNumber(id) }
		});
		// Add User
		aggregation.push({
			$lookup: {
				from: "users",
				localField: "userID",
				foreignField: "_id",
				as: "user"
			}
		});
		// Add
		aggregation.push({
			$unwind: { "path": "$user", "preserveNullAndEmptyArrays": true }
		});
		// Add Stop User
		aggregation.push({
			$lookup: {
				from: "users",
				localField: "stop.userID",
				foreignField: "_id",
				as: "stop.user"
			}
		});
		// Add
		aggregation.push({
			$unwind: { "path": "$stop.user", "preserveNullAndEmptyArrays": true }
		});
		// Add
		aggregation.push({
			$lookup: {
				from: "chargingstations",
				localField: "chargeBoxID",
				foreignField: "_id",
				as: "chargeBox"
			}
		});
		// Add
		aggregation.push({
			$unwind: { "path": "$chargeBox", "preserveNullAndEmptyArrays": true }
		});
		// Read DB
		let transactionsMDB = await _db.collection('transactions')
			.aggregate(aggregation)
			.toArray();
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
	}

	static handleGetActiveTransaction(chargeBoxID, connectorID) {
		// Get the Active Transaction
		return MDBTransaction.find({
					"chargeBoxID": chargeBoxID,
					"connectorId": connectorID,
					"stop": { $exists: false }
				})
				.populate("userID")
				.exec().then((transactionsMDB) => {
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
