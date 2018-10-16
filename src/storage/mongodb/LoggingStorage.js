const Utils = require('../../utils/Utils');
const Database = require('../../utils/Database');
const Constants = require('../../utils/Constants');

class LoggingStorage {
	static async deleteLogs(deleteUpToDate) {
		// Build filter
		let filters = {};
		// Do Not Delete Security Logs
		filters.type = {};
		filters.type.$ne = 'S';
		// Date provided?
		if (deleteUpToDate) {
			filters.timestamp = {};
			filters.timestamp.$lte = new Date(deleteUpToDate);
		} else {
			return;
		}
		// Delete Logs
		let result = await global.db.collection('logs')
			.deleteMany( filters );
		// Return the result
		return result.result;
	}

	static async deleteSecurityLogs(deleteUpToDate) {
		// Build filter
		let filters = {};
		// Delete Only Security Logs
		filters.type = {};
		filters.type.$eq = 'S';
		// Date provided?
		if (deleteUpToDate) {
			filters.timestamp = {};
			filters.timestamp.$lte = new Date(deleteUpToDate);
		} else {
			return;
		}
		// Delete Logs
		let result = await global.db.collection('logs')
			.deleteMany( filters );
		// Return the result
		return result.result;
	}

	static async saveLog(logToSave) {
		console.log(JSON.stringify(logToSave));
		// Check User
		logToSave.userID = Utils.convertUserToObjectID(logToSave.user);
		logToSave.actionOnUserID = Utils.convertUserToObjectID(logToSave.actionOnUser);
		// Transfer
		let log = {};
		Database.updateLogging(logToSave, log, false);
		// Insert
	  await global.db.collection('logs').insertOne(log);
	}

	static async getLog(id) {
		// Read DB
		let loggingMDB = await global.db.collection('logs')
			.find({_id: Utils.convertToObjectID(id)})
			.limit(1)
			.toArray();
		let logging = null;
		// Set
		if (loggingMDB && loggingMDB.length > 0) {
			// Set
			logging = {};
			Database.updateLogging(loggingMDB[0], logging);
		}
		return logging;
	}

	static async getLogs(params={}, limit, skip, sort) {
		// Check Limit
		limit = Utils.checkRecordLimit(limit);
		// Check Skip
		skip = Utils.checkRecordSkip(skip);
		// Set the filters
		let filters = {};
		// Date from provided?
		if (params.dateFrom) {
			// Yes, add in filter
			filters.timestamp = {};
			filters.timestamp.$gte = new Date(params.dateFrom);
		}
		// Log level
		switch (params.level) {
			// Error
			case 'E':
				// Build filter
				filters.level = 'E';
				break;
			// Warning
			case 'W':
				filters.level = { $in : ['E','W'] };
				break;
			// Info
			case 'I':
				filters.level = { $in : ['E','W','I'] };
				break;
		}
		// Charging Station
		if (params.source) {
			// Yes, add in filter
			filters.source = params.source;
		}
		// Type
		if (params.type) {
			// Yes, add in filter
			filters.type = params.type;
		}
		// Action
		if (params.action) {
			// Yes, add in filter
			filters.action = params.action;
		}
		// User ID
		if (params.userID) {
			// Yes, add in filter
			filters.$or = [
				{ 'userID': Utils.convertToObjectID(params.userID) },
				{ 'actionOnUserID': Utils.convertToObjectID(params.userID) }
			];
		}
		// Source?
		if (params.search) {
			// Set
			let searchArray = [
				{ 'message': { $regex : params.search, $options: 'i' } },
				{ 'action': { $regex : params.search, $options: 'i' } }
			];
			// Already exists?
			if (filters.$or) {
				// Add them all
				filters.$and = [
					{ $or: [...filters.$or] },
					{ $or: [...searchArray] },
				];
			} else {
				// Only one
				filters.$or = searchArray;
			}
		}
		// Create Aggregation
		let aggregation = [];
		// Filters
		if (filters) {
			aggregation.push({
				$match: filters
			});
		}
		// Count Records
		let loggingsCountMDB = await global.db.collection('logs')
			.aggregate([...aggregation, { $count: 'count' }], { collation: { locale : Constants.DEFAULT_LOCALE, strength: 2 }})
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
				$sort: { timestamp : -1 }
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
		// User
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
			$unwind: { 'path': '$user', 'preserveNullAndEmptyArrays': true }
		});
		// Action on User
		aggregation.push({
			$lookup: {
				from: 'users',
				localField: 'actionOnUserID',
				foreignField: '_id',
				as: 'actionOnUser'
			}
		});
		// Single Record
		aggregation.push({
			$unwind: { 'path': '$actionOnUser', 'preserveNullAndEmptyArrays': true }
		});
		// Read DB
		let loggingsMDB = await global.db.collection('logs')
				.aggregate(aggregation)
				.toArray();
		let loggings = [];
		for (const loggingMDB of loggingsMDB) {
			let logging = {};
			// Set
			Database.updateLogging(loggingMDB, logging);
			// Set the model
			loggings.push(logging);
		}
		// Ok
		return {
			count: (loggingsCountMDB.length > 0 ? loggingsCountMDB[0].count : 0),
			result: loggings
		};
	}
}

module.exports = LoggingStorage;
