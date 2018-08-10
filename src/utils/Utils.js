const Configuration = require('./Configuration');
const uuidV4 = require('uuid/v4');
const ObjectID = require('mongodb').ObjectID;

require('source-map-support').install();

let _centralSystemFrontEndConfig = Configuration.getCentralSystemFrontEndConfig();

module.exports = {
	generateGUID() {
		return uuidV4();
	},

	convertToDate(date) {
		// Check
		if (!date) {
			return date;
		}
		// Check Type
		if (!(date instanceof Date)) {
			return new Date(date);
		}
		return date;
	},

	isEmptyJSon(document) {
		// Empty?
		if (!document) {
			return true;
		}
		// Check type
		if (typeof document != "object") {
			return true;
		}
		// Check
		return Object.keys(document).length == 0;
	},

	removeExtraEmptyLines(tab) {
		// Start from the end
		for (var i = tab.length-1; i > 0 ; i--) {
			// Two consecutive empty lines?
			if (tab[i].length == 0 && tab[i-1].length == 0) {
				// Remove the last one
				tab.splice(i, 1);
			}
			// Check last line
			if (i == 1 && tab[i-1].length == 0) {
				// Remove the first one
				tab.splice(i-1, 1);
			}
		}
	},

	convertToObjectID(id) {
		let changedID = id;
		// Check
		if (typeof id == "string") {
			// Create Object
			changedID = new ObjectID(id);
		}
		return changedID;
	},

	convertToInt(id) {
		let changedID = id;
		if (!id) {
			return 0;
		}
		// Check
		if (typeof id == "string") {
			// Create Object
			changedID = parseInt(id);
		}
		return changedID;
	},

	convertToFloat(id) {
		let changedID = id;
		if (!id) {
			return 0;
		}
		// Check
		if (typeof id == "string") {
			// Create Object
			changedID = parseFloat(id);
		}
		return changedID;
	},

	convertUserToObjectID(user) {
		let userID = null;
		// Check Created By
		if (user) {
			// Set
			userID = user;
			// Check User Model
			if (typeof user == "object" &&
					user.constructor.name != "ObjectID") {
				// This is the User Model
				userID = this.convertToObjectID(user.id);
			}
			// Check String
			if (typeof user == "string") {
				// This is a String
				userID = this.convertToObjectID(user);
			}
		}
		return userID;
	},

	pushCreatedLastChangedInAggregation(aggregation) {
		// Filter
		let filterUserFields = {
			"email" : 0,
			"phone" : 0,
			"mobile" : 0,
			"iNumber" : 0,
			"costCenter" : 0,
			"status" : 0,
			"createdBy" : 0,
			"createdOn" : 0,
			"lastChangedBy" : 0,
			"lastChangedOn" : 0,
			"role" : 0,
			"password" : 0,
			"locale" : 0,
			"deleted" : 0,
			"passwordWrongNbrTrials" : 0,
			"passwordBlockedUntil" : 0,
			"passwordResetHash" : 0,
			"eulaAcceptedOn" : 0,
			"eulaAcceptedVersion" : 0,
			"eulaAcceptedHash" : 0,
			"image" : 0,
			"address" : 0
		};
		// Created By
		aggregation.push({
			$lookup: {
				from: "users",
				localField: "createdBy",
				foreignField: "_id",
				as: "createdBy"
			}
		});
		// Single Record
		aggregation.push({
			$unwind: { "path": "$createdBy", "preserveNullAndEmptyArrays": true }
		});
		// Filter
		aggregation.push({
			$project: {
				"createdBy": filterUserFields
			}
		});
		// Last Changed By
		aggregation.push({
			$lookup: {
				from: "users",
				localField: "lastChangedBy",
				foreignField: "_id",
				as: "lastChangedBy"
			}
		});
		// Single Record
		aggregation.push({
			$unwind: { "path": "$lastChangedBy", "preserveNullAndEmptyArrays": true }
		});
		// Filter
		aggregation.push({
			$project: {
				"lastChangedBy": filterUserFields
			}
		});
	},

	buildUserFullName(user, withID=true) {
		if (!user) {
			return "Unknown";
		}
		// First name?
		if (!user.firstName) {
			return user.name;
		}
		// Set the ID?
		if (withID) {
			return `${user.firstName} ${user.name} (${user.id})`;
		} else {
			return `${user.firstName} ${user.name}`;
		}
	},

	// Save the users in file
	saveFile(filename, content) {
		// Save
		fs.writeFileSync(path.join(__dirname, filename), content, 'UTF-8');
	},

	getRandomInt() {
		return Math.floor((Math.random() * 2147483648 ) + 1); // INT32 (signed: issue in Schneider)
	},

	buildEvseURL() {
		return _centralSystemFrontEndConfig.protocol + "://" +
			_centralSystemFrontEndConfig.host + ":" +
			_centralSystemFrontEndConfig.port;
	},

	buildEvseUserURL(user) {
		let _evseBaseURL = this.buildEvseURL();
		// Add : https://localhost:8080/#/pages/chargers/charger/REE001
		return _evseBaseURL + "/#/pages/users/user/" + user.getID();
	},

	buildEvseChargingStationURL(chargingStation, connectorId=null) {
		let _evseBaseURL = this.buildEvseURL();

		// Connector provided?
		if (connectorId > 0) {
			// URL with connector
			return _evseBaseURL + "/#/pages/chargers/charger/" + chargingStation.getID() +
				"/connector/" + connectorId;
		} else {
			// URL with charger only
			return _evseBaseURL + "/#/pages/chargers/charger/" + chargingStation.getID();
		}
	},

	buildEvseTransactionURL(chargingStation, connectorId, transactionId) {
		let _evseBaseURL = this.buildEvseURL();
		// Add : https://localhost:8080/#/pages/chargers/charger/REE001
		return _evseBaseURL + "/#/pages/chargers/charger/" + chargingStation.getID() +
		"/connector/" + connectorId + "/transaction/" + transactionId;
	},

	isServerInProductionMode() {
		var env = process.env.NODE_ENV || 'dev';
		return (env !== "dev");
	},

	hideShowMessage(message) {
		// Check Prod
		if (this.isServerInProductionMode()) {
			return "An unexpected server error occurred. Check the server's logs!";
		} else {
			return message;
		}
	},

	checkRecordLimit(recordLimit) {
		if (typeof recordLimit == "string" ) {
			recordLimit = parseInt(recordLimit);
		}
		// Not provided?
		if (isNaN(recordLimit) || recordLimit < 0) {
			// Default
			recordLimit = 100;
		}
		// Limit Exceeded?
		if(recordLimit > 500) {
			recordLimit = 500;
		}
		return recordLimit;
	}
};
