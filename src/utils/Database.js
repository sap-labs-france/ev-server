const fs = require('fs');
const path = require('path');
const Users = require('./Users');
const Utils = require('./Utils');
require('source-map-support').install();

module.exports = {
	updateID(src, dest) {
		// Set it
		if (src.id) {
			dest.id = src.id;
		}
		if (!dest.id && src._id) {
			dest.id = src._id;
		}
		dest.id = this.validateId(dest.id);
	},

	validateId(id) {
		let changedID = id;
		// Object?
		if (changedID && (typeof changedID == "object")) {
			// Mongo DB?
			if (changedID instanceof Buffer) {
				changedID = changedID.toString('hex');
			} else {
				changedID = changedID.toString();
			}
		}
		return changedID;
	},

	updateChargingStation(src, dest, forFrontEnd=true) {
		if (forFrontEnd) {
			this.updateID(src, dest);
		}
		dest.chargePointSerialNumber = src.chargePointSerialNumber;
		dest.chargePointModel = src.chargePointModel;
		dest.chargeBoxSerialNumber = src.chargeBoxSerialNumber;
		dest.chargePointVendor = src.chargePointVendor;
		dest.iccid = src.iccid;
		dest.imsi = src.imsi;
		dest.meterType = src.meterType;
		dest.firmwareVersion = src.firmwareVersion;
		dest.meterSerialNumber = src.meterSerialNumber;
		dest.endpoint = src.endpoint;
		dest.ocppVersion = src.ocppVersion;
		dest.lastHeartBeat = src.lastHeartBeat;
		dest.lastReboot = src.lastReboot;
		if (src.numberOfConnectedPhase) {
			dest.numberOfConnectedPhase = src.numberOfConnectedPhase;
		}
		dest.siteAreaID = src.siteAreaID;
		if (src.chargingStationURL) {
			dest.chargingStationURL = src.chargingStationURL;
		}
		dest.connectors = [];
		if (src.connectors) {
			// Set
			src.connectors.forEach((connector) => {
				if (connector) {
					dest.connectors.push({
						"connectorId": connector.connectorId,
						"currentConsumption": connector.currentConsumption,
						"totalConsumption": connector.totalConsumption,
						"status": connector.status,
						"errorCode": connector.errorCode,
						"power": connector.power,
						"activeTransactionID": connector.activeTransactionID
					});
				} else {
					dest.connectors.push(null);
				}
			});
		}
		this.updateCreatedAndLastChanged(src, dest);
		if (!dest.connectors) {
			dest.connectors = [];
		}
	},

	updateEula(src, dest, forFrontEnd=true) {
		if (forFrontEnd) {
			this.updateID(src, dest);
		}
		dest.timestamp = src.timestamp;
		dest.version = src.version;
		dest.language = src.language;
		dest.text = src.text;
		dest.hash = src.hash;
	},

	updatePricing(src, dest, forFrontEnd=true) {
		if (forFrontEnd) {
			this.updateID(src, dest);
		}
		dest.timestamp = src.timestamp;
		dest.priceKWH = src.priceKWH;
		dest.priceUnit = src.priceUnit;
	},

	updateMigration(src, dest, forFrontEnd=true) {
		if (forFrontEnd) {
			this.updateID(src, dest);
		}
		dest.timestamp = src.timestamp;
		dest.name = src.name;
		dest.version = src.version;
		dest.durationSecs = src.durationSecs;
	},

	updateConfiguration(src, dest, forFrontEnd=true) {
		if (forFrontEnd) {
			this.updateID(src, dest);
		}
		dest.timestamp = src.timestamp;
		dest.configuration = src.configuration;
	},

	updateStatusNotification(src, dest, forFrontEnd=true) {
		if (forFrontEnd) {
			this.updateID(src, dest);
		}
		dest.connectorId = src.connectorId;
		dest.timestamp = src.timestamp;
		dest.status = src.status;
		dest.errorCode = src.errorCode;
		dest.info = src.info;
		dest.vendorId = src.vendorId;
		dest.vendorErrorCode = src.vendorErrorCode;
	},

	updateNotification(src, dest, forFrontEnd=true) {
		if (forFrontEnd) {
			this.updateID(src, dest);
		}
		dest.timestamp = src.timestamp;
		dest.channel = src.channel;
		dest.sourceId = src.sourceId;
		dest.sourceDescr = src.sourceDescr;
		// User
		dest.userID = src.userID;
		if (!Utils.isEmptyJSon(dest.userID)) {
			dest.user = {};
			this.updateUser(src.userID, dest.user);
		}
		// ChargeBox
		dest.chargeBoxID = src.chargeBoxID
		if (!Utils.isEmptyJSon(dest.chargeBoxID)) {
			dest.chargeBox = {};
			this.updateChargingStation(src.chargeBoxID, dest.chargeBox);
		}
	},

	updateMeterValue(src, dest, forFrontEnd=true) {
		if (forFrontEnd) {
			this.updateID(src, dest);
		}
		dest.connectorId = src.connectorId;
		dest.transactionId = src.transactionId;
		dest.timestamp = src.timestamp;
		dest.value = src.value;
		dest.attribute = src.attribute;
	},

	updateUser(src, dest, forFrontEnd=true) {
		if (forFrontEnd) {
			this.updateID(src, dest);
		}
		dest.name = src.name;
		dest.firstName = src.firstName;
		if (forFrontEnd) {
			dest.image = src.image;
		}
		dest.email = src.email;
		dest.phone = src.phone;
		dest.mobile = src.mobile;
		dest.iNumber = src.iNumber;
		dest.costCenter = src.costCenter;
		dest.numberOfSites = src.numberOfSites;
		dest.numberOfTransactions = src.numberOfTransactions;
		dest.address = {};
		this.updateAddress(src.address, dest.address)
		if (src.status) {
			dest.status = src.status;
		}
		if (src.locale) {
			dest.locale = src.locale;
		}
		if (src.eulaAcceptedOn && src.eulaAcceptedVersion && src.eulaAcceptedHash) {
			dest.eulaAcceptedOn = src.eulaAcceptedOn;
			dest.eulaAcceptedVersion = src.eulaAcceptedVersion;
			dest.eulaAcceptedHash = src.eulaAcceptedHash;
		}
		this.updateCreatedAndLastChanged(src, dest);
		dest.deleted = src.deleted;
		if (forFrontEnd && src.tagIDs) {
			dest.tagIDs = src.tagIDs;
		}
		if (src.role) {
			dest.role = src.role;
		}
		if (src.password) {
			dest.password = src.password;
			dest.passwordWrongNbrTrials = (!src.passwordWrongNbrTrials?0:src.passwordWrongNbrTrials);
			dest.passwordBlockedUntil = (!src.passwordBlockedUntil?"":src.passwordBlockedUntil);
		}
		dest.passwordResetHash = src.passwordResetHash;
	},

	updateSite(src, dest, forFrontEnd=true) {
		if (forFrontEnd) {
			this.updateID(src, dest);
			dest.image = src.image;
			dest.numberOfSiteAreas = src.numberOfSiteAreas;
			dest.numberOfUsers = src.numberOfUsers;
		}
		dest.name = src.name;
		dest.address = {};
		dest.allowAllUsersToStopTransactions = src.allowAllUsersToStopTransactions;
		this.updateAddress(src.address, dest.address)
		dest.companyID = src.companyID;
		this.updateCreatedAndLastChanged(src, dest);
	},

	updateVehicleManufacturer(src, dest, forFrontEnd=true) {
		if (forFrontEnd) {
			this.updateID(src, dest);
		}
		dest.name = src.name;
		dest.logo = src.logo;
		dest.numberOfVehicles = src.numberOfVehicles;
		this.updateCreatedAndLastChanged(src, dest);
	},

	updateCreatedAndLastChanged(src, dest) {
		// Check
		if (src.createdBy) {
			// Set
			dest.createdBy = src.createdBy;
			// User model?
			if (typeof dest.createdBy == "object" &&
					dest.createdBy.constructor.name != "ObjectID") {
				// Yes
				dest.createdBy = {};
				this.updateUser(src.createdBy, dest.createdBy);
			}
		}
		// Check
		if (src.createdOn) {
			dest.createdOn = src.createdOn;
		}
		// Check
		if (src.lastChangedBy) {
			// Set
			dest.lastChangedBy = src.lastChangedBy;
			// User model?
			if (typeof dest.lastChangedBy == "object" &&
					dest.lastChangedBy.constructor.name != "ObjectID") {
				// Yes
				dest.lastChangedBy = {};
				this.updateUser(src.lastChangedBy, dest.lastChangedBy);
			}
		}
		// Check
		if (src.lastChangedOn) {
			dest.lastChangedOn = src.lastChangedOn;
		}
	},

	updateCompany(src, dest, forFrontEnd=true) {
		if (forFrontEnd) {
			this.updateID(src, dest);
		}
		dest.name = src.name;
		dest.address = {};
		this.updateAddress(src.address, dest.address);
		dest.logo = src.logo;
		dest.numberOfSites = src.numberOfSites;
		this.updateCreatedAndLastChanged(src, dest);
	},

	updateVehicle(src, dest, forFrontEnd=true) {
		if (forFrontEnd) {
			this.updateID(src, dest);
		}
		dest.type = src.type;
		dest.model = src.model;
		dest.batteryKW = src.batteryKW;
		dest.autonomyKmWLTP = src.autonomyKmWLTP;
		dest.autonomyKmReal = src.autonomyKmReal;
		dest.horsePower = src.horsePower;
		dest.torqueNm = src.torqueNm;
		dest.performance0To100kmh = src.performance0To100kmh;
		dest.weightKg = src.weightKg;
		dest.lengthMeter = src.lengthMeter;
		dest.widthMeter = src.widthMeter;
		dest.heightMeter = src.heightMeter;
		dest.releasedOn = src.releasedOn;
		dest.images = src.images;
		dest.numberOfImages = src.numberOfImages;
		dest.vehicleManufacturerID = src.vehicleManufacturerID;
		this.updateCreatedAndLastChanged(src, dest);
	},

	updateAddress(src, dest) {
		if (src) {
			dest.address1 = src.address1;
			dest.address2 = src.address2;
			dest.postalCode = src.postalCode;
			dest.city = src.city;
			dest.department = src.department;
			dest.region = src.region;
			dest.country = src.country;
			dest.latitude = src.latitude;
			dest.longitude = src.longitude;
		}
	},

	updateSiteArea(src, dest, forFrontEnd=true) {
		if (forFrontEnd) {
			this.updateID(src, dest);
			dest.image = src.image;
			dest.numberOfChargeBoxes = src.numberOfChargeBoxes;
		}
		dest.name = src.name;
		dest.accessControl = src.accessControl;
		dest.siteID = src.siteID;
		this.updateCreatedAndLastChanged(src, dest);
	},

	updateLogging(src, dest, forFrontEnd=true) {
		if (forFrontEnd) {
			this.updateID(src, dest);
		}
		dest.level = src.level;
		dest.source = src.source;
		dest.type = src.type;
		dest.module = src.module;
		dest.method = src.method;
		dest.timestamp = src.timestamp;
		dest.action = src.action;
		dest.message = src.message;
		dest.detailedMessages = src.detailedMessages;
		if (src.user && typeof src.user == "object") {
			dest.user = {};
			this.updateUser(src.user, dest.user);
		}
		if (src.actionOnUser && typeof src.actionOnUser == "object") {
			dest.actionOnUser = {};
			this.updateUser(src.actionOnUser, dest.actionOnUser);
		}
	},

	updateTransaction(src, dest, forFrontEnd=true) {
		if (forFrontEnd) {
			this.updateID(src, dest);
		}
		// ChargeBox
		dest.chargeBoxID = src.chargeBoxID;
		if (forFrontEnd && !Utils.isEmptyJSon(src.chargeBox)) {
			dest.chargeBox = {};
			this.updateChargingStation(src.chargeBox, dest.chargeBox);
		}
		// User
		dest.userID = src.userID;
		if (forFrontEnd && !Utils.isEmptyJSon(src.user)) {
			dest.user = {};
			this.updateUser(src.user, dest.user);
		}
		dest.connectorId = src.connectorId;
		dest.timestamp = src.timestamp;
		dest.tagID = src.tagID;
		dest.meterStart = src.meterStart;
		// Stop?
		if (!Utils.isEmptyJSon(src.stop)) {
			dest.stop = {};
			// User
			dest.stop.userID = src.stop.userID;
			if (forFrontEnd && !Utils.isEmptyJSon(src.stop.user)) {
				dest.stop.user = {};
				this.updateUser(src.stop.user, dest.stop.user);
			}
			dest.stop.timestamp = src.stop.timestamp;
			dest.stop.tagID = src.stop.tagID;
			dest.stop.meterStop = src.stop.meterStop;
			dest.stop.transactionData = src.stop.transactionData;
			dest.stop.totalConsumption = src.stop.totalConsumption;
			dest.stop.totalInactivitySecs = src.stop.totalInactivitySecs;
		}
		// Remote Stop?
		if (!Utils.isEmptyJSon(src.remotestop)) {
			dest.remotestop = {};
			dest.remotestop.timestamp = src.remotestop.timestamp;
			dest.remotestop.tagID = src.remotestop.tagID;
		}
	}
};
