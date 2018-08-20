const Utils = require('../../../utils/Utils');
const Constants = require('../../../utils/Constants');

let _db;

class StatisticsStorage {
	static setDatabase(db) {
		_db = db;
	}

	static async handleGetChargingStationStats(filter, siteID, groupBy) {
		// Build filter
		let match = {};
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
		// Check User
		if (filter.userID) {
			match.userID = Utils.convertToObjectID(filter.userID);
		}
		// Create Aggregation
		let aggregation = [];
		// Filters
		aggregation.push({
			$match: match
		});
		// Filter on Site?
		if (siteID) {
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
		// Group
		switch (groupBy) {
			// By Consumption
			case Constants.STATS_GROUP_BY_CONSUMPTION:
				aggregation.push({
					$group: {
						_id: {chargeBox: "$chargeBoxID", year: { $year: "$timestamp" }, month: { $month: "$timestamp" }},
						total: { $sum: { $divide: [ "$stop.totalConsumption", 1000 ] } }
					}
				});
				break;
		
			// By usage
			case Constants.STATS_GROUP_BY_USAGE:
				aggregation.push({
					$group: {
						_id: {chargeBox: "$chargeBoxID", year: { $year: "$timestamp" }, month: { $month: "$timestamp" }},
						total : { $sum: { $divide: [ { $subtract: ["$stop.timestamp", "$timestamp"] } , 60 * 60 * 1000 ] } }
					}
				});
				break;
		}
		// Sort
		aggregation.push({
			$sort: { "_id.month": 1, "_id.chargeBox": 1 }
		});
		// Read DB
		let transactionStatsMDB = await _db.collection('transactions')
			.aggregate(aggregation)
			.toArray();
		// Set
		let transactions = [];
		// Create
		if (transactionStatsMDB && transactionStatsMDB.length > 0) {
			// Create
			let month = -1;
			let transaction;
			transactionStatsMDB.forEach((transactionStatMDB) => {
				// Init
				if(month !== transactionStatMDB._id.month) {
					// Set
					month = transactionStatMDB._id.month;
					// Create new
					transaction = {};
					transaction.month = transactionStatMDB._id.month - 1;
					// Add
					if (transaction) {
						transactions.push(transaction);
					}
				}
				// Set consumption
				// Add
				transaction[transactionStatMDB._id.chargeBox] = transactionStatMDB.total;
			});
		}
		return transactions;
	}

	static async handleGetUserStats(filter, siteID, groupBy) {
		// Build filter
		let match = {};
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
		// Check User
		if (filter.userID) {
			match.userID = Utils.convertToObjectID(filter.userID);
		}
		// Create Aggregation
		let aggregation = [];
		// Filters
		aggregation.push({
			$match: match
		});
		// Filter on Site?
		if (siteID) {
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
		// Group
		switch (groupBy) {
			// By Consumption
			case Constants.STATS_GROUP_BY_CONSUMPTION:
				aggregation.push({
					$group: {
						_id: {userID: "$userID", year: { $year: "$timestamp" }, month: { $month: "$timestamp" }},
						total: { $sum: { $divide: [ "$stop.totalConsumption", 1000 ] } }
					}
				});
				break;
		
			// By usage
			case Constants.STATS_GROUP_BY_USAGE:
				aggregation.push({
					$group: {
						_id: {userID: "$userID", year: { $year: "$timestamp" }, month: { $month: "$timestamp" }},
						total : { $sum: { $divide: [ { $subtract: ["$stop.timestamp", "$timestamp"] } , 60 * 60 * 1000 ] } }
					}
				});
				break;
		}
		// Resolve Users
		aggregation.push({
			$lookup: {
				from: 'users',
				localField: '_id.userID',
				foreignField: '_id',
				as: 'user'
			}
		});
		// Single Record
		aggregation.push({
			$unwind: { "path": "$user", "preserveNullAndEmptyArrays": true }
		});
		// Sort
		aggregation.push({
			$sort: { "_id.month": 1, "_id.chargeBox": 1 }
		});
		// Read DB
		let transactionStatsMDB = await _db.collection('transactions')
			.aggregate(aggregation)
			.toArray();
		// Set
		let transactions = [];
		// Create
		if (transactionStatsMDB && transactionStatsMDB.length > 0) {
			// Create
			let month = -1;
			let transaction;
			transactionStatsMDB.forEach((transactionStatMDB) => {
				// Init
				if(month !== transactionStatMDB._id.month) {
					// Set
					month = transactionStatMDB._id.month;
					// Create new
					transaction = {};
					transaction.month = transactionStatMDB._id.month - 1;
					// Add
					if (transaction) {
						transactions.push(transaction);
					}
				}
				// Set consumption
				transaction[Utils.buildUserFullName(transactionStatMDB.user)] = transactionStatMDB.total;
			});
		}
		return transactions;
	}
}

module.exports = StatisticsStorage;
