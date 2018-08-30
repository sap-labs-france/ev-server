const Database = require('../../utils/Database');
const Utils = require('../../utils/Utils');
const crypto = require('crypto');

class TransactionStorage {
	static async deleteTransaction(transaction) {
		// Delete Transactions
		await global.db.collection('transactions')
			.findOneAndDelete( {'_id': transaction.id} );
		// Delete Meter Values
		await global.db.collection('metervalues')
			.deleteMany( {'transactionId': transaction.id} );
	}

	static async getMeterValuesFromTransaction(transactionId) {
		// Build filter
		let filter = {};
		// Mandatory filters
		filter.transactionId = Utils.convertToInt(transactionId);
		// Read DB
		let meterValuesMDB = await global.db.collection('metervalues')
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

	static async saveTransaction(transactionToSave) {
		// Set
		let transaction = {};
		Database.updateTransaction(transactionToSave, transaction, false);
		// Modify
	    let result = await global.db.collection('transactions').findOneAndUpdate(
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

	static async saveMeterValues(meterValuesToSave) {
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
		await global.db.collection('metervalues').insertMany(meterValuesMDB);
	}

	static async getTransactionYears() {
		// Read DB
		let firstTransactionsMDB = await global.db.collection('transactions')
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

	static async getTransactions(params, limit, skip, sort) {
		// Check Limit
		limit = Utils.checkRecordLimit(limit);
		// Check Skip
		skip = Utils.checkRecordSkip(skip);
		// Build filter
		let match = {};
		// Filter?
		if (params.search) {
			// Build filter
			match.$or = [
				{ "_id" : parseInt(params.search) },
				{ "tagID" : { $regex : params.search, $options: 'i' } },
				{ "chargeBoxID" : { $regex : params.search, $options: 'i' } }
			];
		}
		// User
		if (params.userId) {
			match.userID = Utils.convertToObjectID(params.userId);
		}
		// Charge Box
		if (params.chargeBoxID) {
			match.chargeBoxID = params.chargeBoxID;
		}
		// Connector
		if (params.connectorId) {
			match.connectorId = Utils.convertToInt(params.connectorId);
		}
		// Date provided?
		if (params.startDateTime || params.endDateTime) {
			match.timestamp = {};
		}
		// Start date
		if (params.startDateTime) {
			match.timestamp.$gte = Utils.convertToDate(params.startDateTime);
		}
		// End date
		if (params.endDateTime) {
			match.timestamp.$lte = Utils.convertToDate(params.endDateTime);
		}
		// Check stop tr
		if (params.stop) {
			match.stop = params.stop;
		}
		// Create Aggregation
		let aggregation = [];
		// Filters
		if (match) {
			aggregation.push({
				$match: match
			});
		}
		// Transaction Duration Secs
		aggregation.push({
			$addFields: {
				"totalDurationSecs": { $divide: [ { $subtract: [ "$stop.timestamp", "$timestamp" ] }, 1000 ] } 
			}
		});
		// Charger?
		if (params.withChargeBoxes || params.siteID) {
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
		}
		if (params.siteID) {
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
				$match: { "siteArea.siteID": Utils.convertToObjectID(params.siteID) }
			});
		}
		// Count Records
		let transactionsCountMDB = await global.db.collection('transactions')
			.aggregate([...aggregation, { $count: "count" }])
			.toArray();
		// Sort
		if (sort) {
			// Sort
			aggregation.push({
				$sort: sort
			});
		} else {
			// Default
			aggregation.push({
				$sort: { timestamp: -1 }
			});
		}
		// Skip
		aggregation.push({
			$skip: skip
		});
		// Limit
		aggregation.push({
			$limit: limit
		});
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
		let transactionsMDB = await global.db.collection('transactions')
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
		// Ok
		return {
			count: (transactionsCountMDB.length > 0 ? transactionsCountMDB[0].count : 0),
			result: transactions
		};
	}

	static async getTransaction(id) {
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
		let transactionsMDB = await global.db.collection('transactions')
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

	static async getActiveTransaction(chargeBoxID, connectorId) {
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
		let transactionsMDB = await global.db.collection('transactions')
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
