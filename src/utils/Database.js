const fs = require('fs');
const path = require('path');
const Users = require('./Users');
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
	},

	updateChargingStation(src, dest) {
		this.updateID(src, dest);
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
		dest.siteAreaID = src.siteAreaID;
		dest.connectors = src.connectors;
		if (src.createdBy && src.createdOn) {
			dest.createdBy = src.createdBy;
			dest.createdOn = src.createdOn;
		}
		if (src.lastChangedBy && src.lastChangedOn) {
			dest.lastChangedBy = src.lastChangedBy;
			dest.lastChangedOn = src.lastChangedOn;
		}
		if (!dest.connectors) {
			dest.connectors = [];
		}
	},

	updateEula(src, dest) {
		this.updateID(src, dest);
		dest.timestamp = src.timestamp;
		dest.version = src.version;
		dest.language = src.language;
		dest.text = src.text;
		dest.hash = src.hash;
	},

	updatePricing(src, dest) {
		this.updateID(src, dest);
		dest.timestamp = src.timestamp;
		dest.priceKWH = src.priceKWH;
		dest.priceUnit = src.priceUnit;
	},

	updatePricing(src, dest) {
		this.updateID(src, dest);
		dest.timestamp = src.timestamp;
		dest.priceKWH = src.priceKWH;
		dest.priceUnit = src.priceUnit;
	},

	updateMigration(src, dest) {
		this.updateID(src, dest);
		dest.timestamp = src.timestamp;
		dest.name = src.name;
		dest.version = src.version;
	},

	updateConfiguration(src, dest) {
		this.updateID(src, dest);
		dest.timestamp = src.timestamp;
		dest.configuration = src.configuration;
	},

	updateStatusNotification(src, dest) {
		this.updateID(src, dest);
		dest.connectorId = src.connectorId;
		dest.timestamp = src.timestamp;
		dest.status = src.status;
		dest.errorCode = src.errorCode;
		dest.info = src.info;
		dest.vendorId = src.vendorId;
		dest.vendorErrorCode = src.vendorErrorCode;
	},

	updateNotification(src, dest) {
		this.updateID(src, dest);
		dest.timestamp = src.timestamp;
		dest.channel = src.channel;
		dest.sourceId = src.sourceId;
		dest.sourceDescr = src.sourceDescr;
		// User
		if (src.userID) {
			dest.user = {};
			this.updateUser(src.userID, dest.user);
		}
		// ChargeBox
		if (src.chargeBoxID) {
			dest.chargeBox = {};
			this.updateChargingStation(src.chargeBoxID, dest.chargeBox);
		}
	},

	updateMeterValue(src, dest) {
		this.updateID(src, dest);
		dest.connectorId = src.connectorId;
		dest.transactionId = src.transactionId;
		dest.timestamp = src.timestamp;
		dest.value = src.value;
		dest.attribute = src.attribute;
	},

	updateUser(src, dest) {
		this.updateID(src, dest);
		dest.name = src.name;
		dest.firstName = src.firstName;
		dest.image = src.image;
		dest.email = src.email;
		dest.phone = src.phone;
		dest.mobile = src.mobile;
		dest.iNumber = src.iNumber;
		dest.costCenter = src.costCenter;
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
		if (src.createdBy && src.createdOn) {
			dest.createdBy = src.createdBy;
			dest.createdOn = src.createdOn;
		}
		if (src.lastChangedBy && src.lastChangedOn) {
			dest.lastChangedBy = src.lastChangedBy;
			dest.lastChangedOn = src.lastChangedOn;
		}
		dest.deleted = src.deleted;
		dest.tagIDs = src.tagIDs;
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

	updateSite(src, dest) {
		this.updateID(src, dest);
		dest.name = src.name;
		dest.address = {};
		this.updateAddress(src.address, dest.address)
		dest.image = src.image;
		dest.companyID = src.companyID;
		dest.numberOfSiteAreas = src.numberOfSiteAreas;
		if (src.createdBy && src.createdOn) {
			dest.createdBy = src.createdBy;
			dest.createdOn = src.createdOn;
		}
		if (src.lastChangedBy && src.lastChangedOn) {
			dest.lastChangedBy = src.lastChangedBy;
			dest.lastChangedOn = src.lastChangedOn;
		}
	},

	updateCompany(src, dest) {
		this.updateID(src, dest);
		dest.name = src.name;
		dest.address = {};
		this.updateAddress(src.address, dest.address)
		dest.logo = src.logo;
		dest.numberOfSites = src.numberOfSites;
		if (src.createdBy && src.createdOn) {
			dest.createdBy = src.createdBy;
			dest.createdOn = src.createdOn;
		}
		if (src.lastChangedBy && src.lastChangedOn) {
			dest.lastChangedBy = src.lastChangedBy;
			dest.lastChangedOn = src.lastChangedOn;
		}
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

	updateSiteArea(src, dest) {
		this.updateID(src, dest);
		dest.name = src.name;
		dest.image = src.image;
		dest.numberOfChargeBoxes = src.numberOfChargeBoxes;
		dest.siteID = src.siteID;
	},

	updateLoggingObject(src, dest) {
		this.updateID(src, dest);
		dest.level = src.level;
		dest.source = src.source;
		dest.type = src.type;
		dest.module = src.module;
		dest.method = src.method;
		dest.timestamp = src.timestamp;
		dest.action = src.action;
		dest.message = src.message;
		dest.userFullName = src.userFullName;
		dest.detailedMessages = src.detailedMessages;
	},

	updateTransaction(src, dest) {
		this.updateID(src, dest);
		dest.transactionId = src.id;
		// ChargeBox
		if (src.chargeBoxID) {
			dest.chargeBox = {};
			this.updateChargingStation(src.chargeBoxID, dest.chargeBox);
		}
		// User
		if (src.userID) {
			dest.user = {};
			this.updateUser(src.userID, dest.user);
		}
		dest.connectorId = src.connectorId;
		dest.timestamp = src.timestamp;
		dest.tagID = src.tagID;
		dest.meterStart = src.meterStart;
		// Stop?
		if (src.stop) {
			dest.stop = {};
			// User
			if (src.stop.userID) {
				dest.stop.user = {};
				this.updateUser(src.stop.userID, dest.stop.user);
			}
			dest.stop.timestamp = src.stop.timestamp;
			dest.stop.tagID = src.stop.tagID;
			dest.stop.meterStop = src.stop.meterStop;
			dest.stop.transactionData = src.stop.transactionData;
			dest.stop.totalConsumption = src.stop.totalConsumption;
		}
	}
};
