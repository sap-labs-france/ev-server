const mongoose = require('mongoose');
const Constants = require('../../../utils/Constants');
const Logging = require('../../../utils/Logging');
const Utils = require('../../../utils/Utils');
const Database = require('../../../utils/Database');
const MDBLog = require('../model/MDBLog');
const crypto = require('crypto');
const ObjectId = mongoose.Types.ObjectId;

let _centralRestServer;

class LoggingStorage {
	static setCentralRestServer(centralRestServer) {
		_centralRestServer = centralRestServer;
	}

	static handleDeleteLogs(deleteUpToDate) {
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
		return MDBLog.remove(filters).then((result) => {
			// Notify Change
			_centralRestServer.notifyLoggingDeleted();
			// Return the result
			return result.result;
		});
	}

	static handleDeleteSecurityLogs(deleteUpToDate) {
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
		return MDBLog.remove(filters).then((result) => {
			// Notify Change
			_centralRestServer.notifyLoggingDeleted();
			// Return the result
			return result.result;
		});
	}

	static handleSaveLog(log) {
		// Check User
		if (log.user && typeof log.user == "object") {
			// This is the User Model
			log.userID = new ObjectId(log.user.id);
		}
		if (log.actionOnUser && typeof log.actionOnUser == "object") {
			// This is the User Model
			log.actionOnUserID = new ObjectId(log.actionOnUser.id);
		}
		// Create model
		let logMDB = new MDBLog(log);
		// Save
		return logMDB.save().then(() => {
			// Available?
			if (_centralRestServer) {
				// Notify Change
				_centralRestServer.notifyLoggingCreated();
			}
		});
	}

	static handleGetLogs(dateFrom, level, type, chargingStation, searchValue, numberOfLogs, sortDate) {
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
		// Execute
		return MDBLog.aggregate(aggregation)
				.exec().then((loggingsMDB) => {
			let loggings = [];
			loggingsMDB.forEach(function(loggingMDB) {
				let logging = {};
				// Set
				Database.updateLoggingObject(loggingMDB, logging);
				// Set the model
				loggings.push(logging);
			});
			// Ok
			return loggings;
		});
	}
}

module.exports = LoggingStorage;
