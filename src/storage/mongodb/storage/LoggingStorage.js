const Constants = require('../../../utils/Constants');
const Logging = require('../../../utils/Logging');
const Utils = require('../../../utils/Utils');
const Database = require('../../../utils/Database');

let _db;

class LoggingStorage {
	static setDatabase(db) {
		_db = db;
	}

	static async handleDeleteLogs(deleteUpToDate) {
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
		let result = await _db.collection('logs')
			.deleteMany( filters );
		// Return the result
		return result.result;
	}

	static async handleDeleteSecurityLogs(deleteUpToDate) {
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
		let result = await _db.collection('logs')
			.deleteMany( filters );
		// Return the result
		return result.result;
	}

	static async handleSaveLog(logToSave) {
		// Check User
		if (logToSave.user && typeof logToSave.user == "object") {
			logToSave.userID = Utils.convertToObjectID(logToSave.user.id);
		}
		if (logToSave.actionOnUser && typeof logToSave.actionOnUser == "object") {
			logToSave.actionOnUserID = Utils.convertToObjectID(logToSave.actionOnUser.id);
		}
		// Transfer
		let log = {};
		Database.updateLogging(logToSave, log, false);
		// Insert
	    await _db.collection('logs').insertOne(log);
	}

	static async handleGetLogs(dateFrom, level, type, chargingStation, searchValue, numberOfLogs, sortDate) {
		// Check Limit
		numberOfLogs = Utils.checkRecordLimit(numberOfLogs);
		// Set the filters
		let filters = {};
		// Date from provided?
		if (dateFrom) {
			// Yes, add in filter
			filters.timestamp = {};
			filters.timestamp.$gte = new Date(dateFrom);
		}
		// Log level
		switch (level) {
			// Error
			case "E":
				// Build filter
				filters.level = 'E';
				break;
			// Warning
			case "W":
				filters.level = { $in : ['E','W'] };
				break;
			// Info
			case "I":
				filters.level = { $in : ['E','W','I'] };
				break;
			// Debug
			case "D":
				// No filter
				break;
		}
		// Charging Station
		if (chargingStation) {
			// Yes, add in filter
			filters.source = chargingStation;
		}
		// Type
		if (type) {
			// Yes, add in filter
			filters.type = type;
		}
		// Source?
		if (searchValue) {
			// Build filter
			filters.$or = [
				{ "message" : { $regex : searchValue, $options: 'i' } },
				{ "action" : { $regex : searchValue, $options: 'i' } },
				{ "userFullName" : { $regex : searchValue, $options: 'i' } }
			];
		}
		// Create Aggregation
		let aggregation = [];
		// Filters
		if (filters) {
			aggregation.push({
				$match: filters
			});
		}
		// Set the sort
		let sort = {};
		// Set timestamp
		if (sortDate) {
			sort.timestamp = parseInt(sortDate);
		} else {
			// default
			sort.timestamp = -1;
		}
		// Sort
		aggregation.push({
			$sort: sort
		});
		// Limit
		if (numberOfLogs > 0) {
			aggregation.push({
				$limit: numberOfLogs
			});
		}
		// User
		aggregation.push({
			$lookup: {
				from: "users",
				localField: "userID",
				foreignField: "_id",
				as: "user"
			}
		});
		// Single Record
		aggregation.push({
			$unwind: { "path": "$user", "preserveNullAndEmptyArrays": true }
		});
		// Action on User
		aggregation.push({
			$lookup: {
				from: "users",
				localField: "actionOnUserID",
				foreignField: "_id",
				as: "actionOnUser"
			}
		});
		// Single Record
		aggregation.push({
			$unwind: { "path": "$actionOnUser", "preserveNullAndEmptyArrays": true }
		});
		// Read DB
		let loggingsMDB = await _db.collection('logs')
				.aggregate(aggregation)
				.toArray();
		let loggings = [];
		loggingsMDB.forEach((loggingMDB) => {
			let logging = {};
			// Set
			Database.updateLogging(loggingMDB, logging);
			// Set the model
			loggings.push(logging);
		});
		// Ok
		return loggings;
	}
}

module.exports = LoggingStorage;
