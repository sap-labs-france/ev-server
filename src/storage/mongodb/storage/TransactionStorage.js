const Constants = require('../../../utils/Constants');
const Logging = require('../../../utils/Logging');
const Database = require('../../../utils/Database');
const Utils = require('../../../utils/Utils');
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

	static async handleGetMeterValuesFromTransaction(transactionId) {
		// Build filter
		let filter = {};
		// Mandatory filters
		filter.transactionId = Utils.convertToInt(transactionId);
		// Read DB
		let meterValuesMDB = await _db.collection('metervalues')
			.find(filter)
			.sort( {timestamp: 1, value: -1} )
			.toArray();
		let meterValues = [];
		// Set
		if (meterValuesMDB && meterValuesMDB.length > 0) {
			// Create
			meterValuesMDB.forEach((meterValueMDB) => {
				let meterValue = {};
				// Set values
				Database.updateMeterValue(meterValueMDB, meterValue);
				// Add
				meterValues.push(meterValue);
			});
		}
		// Ok
		return meterValues;
	}

	static async handleSaveTransaction(transactionToSave) {
		// Set
		let transaction = {};
		Database.updateTransaction(transactionToSave, transaction, false);
		// Modify
	    let result = await _db.collection('transactions').findOneAndUpdate(
			{"_id": Utils.convertToInt(transactionToSave.id)},
			{$set: transaction},
			{upsert: true, new: true, returnOriginal: false});
		// Create
		let updatedTransaction = {};
		// Update
		Database.updateTransaction(result.value, updatedTransaction);
		// Return
		return updatedTransaction;
	}

	static async handleSaveMeterValues(meterValuesToSave) {
		let meterValuesMDB = [];
		// Save all
		meterValuesToSave.values.forEach((meterValueToSave) => {
			let meterValue = {}
			// Id
			meterValue._id = crypto.createHash('sha256')
				.update(`${meterValueToSave.chargeBoxID}~${meterValueToSave.connectorId}~${meterValueToSave.timestamp}~${meterValueToSave.value}~${JSON.stringify(meterValueToSave.attribute)}`)
				.digest("hex");
			// Set
			Database.updateMeterValue(meterValueToSave, meterValue, false);
			// Add
			meterValuesMDB.push(meterValue);
		});
		// Execute
		await _db.collection('metervalues').insertMany(meterValuesMDB);
	}

	static async handleGetTransactionYears() {
		// Read DB
		let firstTransactionsMDB = await _db.collection('transactions')
			.find({})
			.sort({timestamp:1})
			.limit(1)
			.toArray();
		// Found?
		if (!firstTransactionsMDB || firstTransactionsMDB.length == 0) {
			return null;
		}
		let transactionYears = [];
		// Push the rest of the years up to now
		for (var i = new Date(firstTransactionsMDB[0].timestamp).getFullYear();
				i <= new Date().getFullYear(); i++) {
			// Add
			transactionYears.push(i);
		}
		return transactionYears;
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
				{ "_id" : parseInt(searchValue) },
				{ "tagID" : { $regex : searchValue, $options: 'i' } },
				{ "chargeBoxID" : { $regex : searchValue, $options: 'i' } }
			];
		}
		console.log(JSON.stringify(searchValue, null, ' '));
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
			match.connectorId = Utils.convertToInt(filter.connectorId);
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
			$match: { _id: Utils.convertToInt(id) }
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

	static async handleGetActiveTransaction(chargeBoxID, connectorId) {
		// Create Aggregation
		let aggregation = [];
		// Filters
		aggregation.push({
			$match: {
				"chargeBoxID": chargeBoxID,
				"connectorId": Utils.convertToInt(connectorId),
				"stop": { $exists: false }
			}
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
}

module.exports = TransactionStorage;
