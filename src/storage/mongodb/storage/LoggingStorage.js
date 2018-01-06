const Logging = require('../../../utils/Logging');
const Database = require('../../../utils/Database');
const MDBLog = require('../model/MDBLog');
const crypto = require('crypto');

let _centralRestServer;

class LoggingStorage {
	static setCentralRestServer(centralRestServer) {
		_centralRestServer = centralRestServer;
	}

	static handleDeleteLogs(deleteUpToDate) {
		// Build filter
		var filter = {};
		// Do Not Delete Security Logs
		filter.type = {};
		filter.type.$ne = 'S';
		// Date provided?
		if (deleteUpToDate) {
			filter.timestamp = {};
			filter.timestamp.$lte = new Date(deleteUpToDate);
		} else {
			return;
		}
		return MDBLog.remove(filter).then((result) => {
			// Notify Change
			_centralRestServer.notifyLoggingDeleted();
			// Return the result
			return result.result;
		});
	}

	static handleSaveLog(log) {
		// Create model
		var logMDB = new MDBLog(log);
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
		// Not provided?
		if (!numberOfLogs || isNaN(numberOfLogs)) {
			// Default
			numberOfLogs = 50;
		}
		// Limit Exceeded?
		if(numberOfLogs > 500) {
			numberOfLogs = 500;
		}
		if (typeof numberOfLogs == "string" ) {
			numberOfLogs = parseInt(numberOfLogs);
		}
		// Set the filters
		let filter = {};
		// Date from provided?
		if (dateFrom) {
			// Yes, add in filter
			filter.timestamp = {};
			filter.timestamp.$gte = new Date(dateFrom);
		}
		// Log level
		switch (level) {
			// Error
			case "E":
				// Build filter
				filter.level = 'E';
				break;
			// Warning
			case "W":
				filter.level = { $in : ['E','W'] };
				break;
			// Info
			case "I":
				filter.level = { $in : ['E','W','I'] };
				break;
			// Debug
			case "D":
				// No filter
				break;
		}
		// Charging Station
		if (chargingStation) {
			// Yes, add in filter
			filter.source = chargingStation;
		}
		// Type
		if (type) {
			// Yes, add in filter
			filter.type = type;
		}
		// Source?
		if (searchValue) {
			// Build filter
			filter.$or = [
				{ "message" : { $regex : `.*${searchValue}.*` } },
				{ "action" : { $regex : `.*${searchValue}.*` } },
				{ "userFullName" : { $regex : `.*${searchValue}.*` } }
			];
		}
		// Set the sort
		let sort = {};
		// Set timestamp
		if (sortDate) {
			sort.timestamp = sortDate;
		} else {
			// default
			sort.timestamp = -1;
		}
		console.log(filter);
		// Exec request
		return MDBLog.find(filter).sort(sort).limit(numberOfLogs).exec().then((loggingsMDB) => {
			var loggings = [];
			loggingsMDB.forEach(function(loggingMDB) {
				var logging = {};
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
