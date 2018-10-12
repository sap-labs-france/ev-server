const Configuration = require('./Configuration');
const uuidV4 = require('uuid/v4');
const ObjectID = require('mongodb').ObjectID;
const Constants = require('./Constants');
const crypto = require('crypto');
const ClientOAuth2 = require('client-oauth2');
const axios = require('axios');

require('source-map-support').install();

let _centralSystemFrontEndConfig = Configuration.getCentralSystemFrontEndConfig();

class Utils {
	static generateGUID() {
		return uuidV4();
	}

	// Temporary method for Revenue Cloud concept
	static async pushTransactionToRevenueCloud(action, transaction, user, actionOnUser) {
			const Logging = require('./Logging'); // Avoid fucking circular deps

			// Refund Transaction
			let cloudRevenueAuth = new ClientOAuth2({
			  clientId: 'sb-revenue-cloud!b1122|revenue-cloud!b1532',
			  clientSecret: 'BtuZkWlC/58HmEMoqBCHc0jBoVg=',
			  accessTokenUri: 'https://seed-innovation.authentication.eu10.hana.ondemand.com/oauth/token'
			})
			// Get the token
			let authResponse = await cloudRevenueAuth.credentials.getToken();
			// Send HTTP request
			let result = await axios.post(
				'https://eu10.revenue.cloud.sap/api/usage-record/v1/usage-records',
				{
					'metricId': 'ChargeCurrent_Trial',
					'quantity': transaction.stop.totalConsumption / 1000,
					'startedAt': transaction.timestamp,
					'endedAt': transaction.stop.timestamp,
					'userTechnicalId': transaction.tagID
				},
				{
					'headers': {
						'Authorization': 'Bearer ' + authResponse.accessToken,
						'Content-Type': 'application/json'
					}
				}
			);
			// Log
			Logging.logSecurityInfo({
				user, actionOnUser, action,
				source: transaction.chargeBox.id,
				module: 'Utils', method: 'pushTransactionToRevenueCloud',
				message: `Transaction ID '${transaction.id}' has been refunded successfully`,
				detailedMessages: result.data});
	}

	static normalizeSOAPHeader(headers) {
		// ChargeBox Identity
		Utils.normalizeOneSOAPHeader(headers, 'chargeBoxIdentity');
		// Action
		Utils.normalizeOneSOAPHeader(headers, 'Action');
		// To
		Utils.normalizeOneSOAPHeader(headers, 'To');
	}

	static normalizeOneSOAPHeader(headers, name) {
		// Object?
		if (typeof headers[name] === 'object' && headers[name].$value) {
			// Yes: Set header
			headers[name] = headers[name].$value;
		}
	}

	static convertToDate(date) {
		// Check
		if (!date) {
			return date;
		}
		// Check Type
		if (!(date instanceof Date)) {
			return new Date(date);
		}
		return date;
	}

	static isEmptyJSon(document) {
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
	}

	static removeExtraEmptyLines(tab) {
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
	}

	static convertToObjectID(id) {
		let changedID = id;
		// Check
		if (typeof id == "string") {
			// Create Object
			changedID = new ObjectID(id);
		}
		return changedID;
	}

	static convertToInt(id) {
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
	}

	static convertToFloat(id) {
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
	}

	static convertUserToObjectID(user) {
		let userID = null;
		// Check Created By
		if (user) {
			// Set
			userID = user;
			// Check User Model
			if (typeof user == "object" &&
					user.constructor.name != "ObjectID") {
				// This is the User Model
				userID = Utils.convertToObjectID(user.id);
			}
			// Check String
			if (typeof user == "string") {
				// This is a String
				userID = Utils.convertToObjectID(user);
			}
		}
		return userID;
	}

	static pushCreatedLastChangedInAggregation(aggregation) {
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
	}

	static buildUserFullName(user, withID=true) {
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
	}

	// Save the users in file
	static saveFile(filename, content) {
		// Save
		fs.writeFileSync(path.join(__dirname, filename), content, 'UTF-8');
	}

	static getRandomInt() {
		return Math.floor((Math.random() * 2147483648 ) + 1); // INT32 (signed: issue in Schneider)
	}

	static buildEvseURL() {
		return _centralSystemFrontEndConfig.protocol + "://" +
			_centralSystemFrontEndConfig.host + ":" +
			_centralSystemFrontEndConfig.port;
	}

	static buildEvseUserURL(user) {
		let _evseBaseURL = Utils.buildEvseURL();
		// Add
		return _evseBaseURL + "/#/pages/users/user/" + user.getID();
	}

	static buildEvseChargingStationURL(chargingStation, connectorId=null) {
		let _evseBaseURL = Utils.buildEvseURL();

		// Connector provided?
		if (connectorId > 0) {
			// URL with connector
			return _evseBaseURL + "/#/pages/chargers/charger/" + chargingStation.getID() +
				"/connector/" + connectorId;
		} else {
			// URL with charger only
			return _evseBaseURL + "/#/pages/chargers/charger/" + chargingStation.getID();
		}
	}

	static buildEvseTransactionURL(chargingStation, connectorId, transactionId) {
		let _evseBaseURL = Utils.buildEvseURL();
		// Add
		return _evseBaseURL + "/#/pages/chargers/charger/" + chargingStation.getID() +
			"/connector/" + connectorId + "/transaction/" + transactionId;
	}

	static isServerInProductionMode() {
		var env = process.env.NODE_ENV || 'dev';
		return (env !== "dev");
	}

	static hideShowMessage(message) {
		// Check Prod
		if (Utils.isServerInProductionMode()) {
			return "An unexpected server error occurred. Check the server's logs!";
		} else {
			return message;
		}
	}

	static checkRecordLimit(recordLimit) {
		// String?
		if (typeof recordLimit == "string" ) {
			recordLimit = parseInt(recordLimit);
		}
		// Not provided?
		if (isNaN(recordLimit) || recordLimit < 0 || recordLimit === 0) {
			// Default
			recordLimit = Constants.DEFAULT_DB_LIMIT;
		}
		return recordLimit;
	}

	static checkRecordSkip(recordSkip) {
		// String?
		if (typeof recordSkip == "string" ) {
			recordSkip = parseInt(recordSkip);
		}
		// Not provided?
		if (isNaN(recordSkip) || recordSkip < 0) {
			// Default
			recordSkip = 0;
		}
		return recordSkip;
	}

	static generateToken(email) {
		return crypto.createHash('sha1').update(`${new Date().toISOString()}~${email}`).digest('hex');
	}

	static convertObjectIDToString(id) {
		if(id && typeof id == "object") {
			return id.toString();
		} else {
			return null
		}
	}
}

module.exports=Utils;
