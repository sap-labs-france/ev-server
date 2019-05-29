const cfenv = require('cfenv');
const Configuration = require('./Configuration');
const Utils = require('./Utils');
const Constants = require('./Constants');

require('source-map-support').install();

let _heartbeatIntervalSecs;

class Database {
  static updateID(src, dest) {
    // Set it
    if (src.id) {
      dest.id = src.id;
    }
    if (!dest.id && src._id) {
      dest.id = src._id;
    }
    dest.id = Database.validateId(dest.id);
  }

  static validateId(id) {
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
  }

  static setChargingStationHeartbeatIntervalSecs(heartbeatIntervalSecs) {
    _heartbeatIntervalSecs = heartbeatIntervalSecs;
  }

  static updateChargingStation(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
      dest.siteAreaID = Database.validateId(src.siteAreaID);
    } else {
      dest.siteAreaID = Utils.convertToObjectID(src.siteAreaID);
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
    if (src.ocppProtocol) {
      dest.ocppProtocol = src.ocppProtocol;
    } else {
      dest.ocppProtocol = Constants.OCPP_PROTOCOL_SOAP;
    }
    if (src.cfApplicationIDAndInstanceIndex) {
      dest.cfApplicationIDAndInstanceIndex = src.cfApplicationIDAndInstanceIndex;
    }
    dest.lastHeartBeat = Utils.convertToDate(src.lastHeartBeat);
    dest.deleted = src.deleted;
    // Check Inactive Chargers
    if (forFrontEnd) {
      // Default
      dest.inactive = false;
      if (dest.lastHeartBeat) {
        const inactivitySecs = Math.floor((Date.now() - dest.lastHeartBeat.getTime()) / 1000);
        // Inactive?
        if (inactivitySecs > (_heartbeatIntervalSecs * 5)) {
          dest.inactive = true;
        }
      }
    }
    dest.lastReboot = Utils.convertToDate(src.lastReboot);
    if (src.chargingStationURL) {
      dest.chargingStationURL = src.chargingStationURL;
    }
    if (src.hasOwnProperty('numberOfConnectedPhase')) {
      dest.numberOfConnectedPhase = Utils.convertToInt(src.numberOfConnectedPhase);
    }
    if (src.hasOwnProperty('maximumPower')) {
      dest.maximumPower = Utils.convertToInt(src.maximumPower);
    }
    if (src.hasOwnProperty('cannotChargeInParallel')) {
      dest.cannotChargeInParallel = src.cannotChargeInParallel;
    }
    if (src.hasOwnProperty('powerLimitUnit')) {
      dest.powerLimitUnit = src.powerLimitUnit;
    }
    if (src.hasOwnProperty('latitude')) {
      dest.latitude = Utils.convertToFloat(src.latitude);
    }
    if (src.hasOwnProperty('longitude')) {
      dest.longitude = Utils.convertToFloat(src.longitude);
    }
    dest.connectors = [];
    if (src.connectors) {
      // Set
      for (const connector of src.connectors) {
        if (connector) {
          dest.connectors.push({
            "connectorId": Utils.convertToInt(connector.connectorId),
            "currentConsumption": Utils.convertToFloat(connector.currentConsumption),
            "currentStateOfCharge": Utils.convertToInt(connector.currentStateOfCharge),
            "totalConsumption": Utils.convertToFloat(connector.totalConsumption),
            "status": connector.status,
            "errorCode": connector.errorCode,
            "info": connector.info,
            "vendorErrorCode": connector.vendorErrorCode,
            "power": Utils.convertToInt(connector.power),
            "type": connector.type,
            "voltage": Utils.convertToInt(connector.voltage),
            "amperage": Utils.convertToInt(connector.amperage),
            "activeTransactionID": Utils.convertToInt(connector.activeTransactionID)
          });
        } else {
          dest.connectors.push(null);
        }
      }
    }
    // Update
    Database.updateCreatedAndLastChanged(src, dest);
    // No connectors?
    if (!dest.connectors) {
      dest.connectors = [];
    }
  }

  static updateEula(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
    }
    dest.timestamp = Utils.convertToDate(src.timestamp);
    dest.version = src.version;
    dest.language = src.language;
    dest.text = src.text;
    dest.hash = src.hash;
  }

  static updatePricing(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
    }
    dest.timestamp = Utils.convertToDate(src.timestamp);
    dest.priceKWH = Utils.convertToFloat(src.priceKWH);
    dest.priceUnit = src.priceUnit;
  }

  static updateMigration(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
    }
    dest.timestamp = Utils.convertToDate(src.timestamp);
    dest.name = src.name;
    dest.version = src.version;
    dest.durationSecs = Utils.convertToFloat(src.durationSecs);
  }

  static updateRunningMigration(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
    }
    dest.timestamp = Utils.convertToDate(src.timestamp);
    dest.name = src.name;
    dest.version = src.version;
    dest.hostname = Configuration.isCloudFoundry() ? cfenv.getAppEnv().name : require('os').hostname();
  }

  static updateConfiguration(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
    }
    dest.timestamp = Utils.convertToDate(src.timestamp);
    dest.configuration = src.configuration;
  }

  static updateStatusNotification(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
    }
    dest.chargeBoxID = src.chargeBoxID;
    dest.connectorId = Utils.convertToInt(src.connectorId);
    dest.timestamp = Utils.convertToDate(src.timestamp);
    if (src.hasOwnProperty('timezone')) {
      dest.timezone = src.timezone;
    }
    dest.status = src.status;
    dest.errorCode = src.errorCode;
    dest.info = src.info;
    dest.vendorId = src.vendorId;
    dest.vendorErrorCode = src.vendorErrorCode;
  }

  static updateNotification(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
      dest.userID = Database.validateId(src.userID);
    } else {
      dest.userID = Utils.convertToObjectID(src.userID);
    }
    dest.timestamp = Utils.convertToDate(src.timestamp);
    dest.channel = src.channel;
    dest.sourceId = src.sourceId;
    dest.sourceDescr = src.sourceDescr;
    dest.data = src.data;
    // User
    if (forFrontEnd && !Utils.isEmptyJSon(src.user)) {
      dest.user = {};
      Database.updateUser(src.user, dest.user);
    }
    // ChargeBox
    dest.chargeBoxID = src.chargeBoxID;
    if (forFrontEnd && !Utils.isEmptyJSon(src.chargeBox)) {
      dest.chargeBox = {};
      Database.updateChargingStation(src.chargeBox, dest.chargeBox);
    }
  }

  static updateMeterValue(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
    }
    dest.chargeBoxID = src.chargeBoxID;
    dest.connectorId = Utils.convertToInt(src.connectorId);
    dest.transactionId = Utils.convertToInt(src.transactionId);
    dest.timestamp = Utils.convertToDate(src.timestamp);
    dest.value = Utils.convertToInt(src.value);
    dest.attribute = src.attribute;
  }

  static updateUser(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
      if (src.image) {
        dest.image = src.image;
      }
    }
    if (src.hasOwnProperty("name")) {
      dest.name = src.name;
    }
    if (src.hasOwnProperty("firstName")) {
      dest.firstName = src.firstName;
    }
    if (src.hasOwnProperty("email")) {
      dest.email = src.email;
    }
    if (src.hasOwnProperty("phone")) {
      dest.phone = src.phone;
    }
    if (src.hasOwnProperty("mobile")) {
      dest.mobile = src.mobile;
    }
    if (src.hasOwnProperty("notificationsActive")) {
      dest.notificationsActive = src.notificationsActive;
    }
    if (src.hasOwnProperty("iNumber")) {
      dest.iNumber = src.iNumber;
    }
    if (src.hasOwnProperty("costCenter")) {
      dest.costCenter = src.costCenter;
    }
    dest.address = {};
    if (src.hasOwnProperty("address")) {
      Database.updateAddress(src.address, dest.address);
    }
    if (src.hasOwnProperty("status")) {
      dest.status = src.status;
    }
    if (src.hasOwnProperty("locale")) {
      dest.locale = src.locale;
    }
    if (src.hasOwnProperty("eulaAcceptedOn")) {
      dest.eulaAcceptedOn = Utils.convertToDate(src.eulaAcceptedOn);
      dest.eulaAcceptedVersion = src.eulaAcceptedVersion;
      dest.eulaAcceptedHash = src.eulaAcceptedHash;
    }
    Database.updateCreatedAndLastChanged(src, dest);
    dest.deleted = src.deleted;
    if (forFrontEnd && src.hasOwnProperty("tagIDs")) {
      dest.tagIDs = src.tagIDs;
    }
    if (src.hasOwnProperty("plateID")) {
      dest.plateID = src.plateID;
    }
    if (src.hasOwnProperty("role")) {
      dest.role = src.role;
    }
    if (src.hasOwnProperty("password")) {
      dest.password = src.password;
      dest.passwordWrongNbrTrials = Utils.convertToInt(src.passwordWrongNbrTrials);
      dest.passwordBlockedUntil = Utils.convertToDate(src.passwordBlockedUntil);
    }
    if (src.hasOwnProperty("passwordResetHash")) {
      dest.passwordResetHash = src.passwordResetHash;
    }
    if (src.hasOwnProperty("verifiedAt")) {
      dest.verifiedAt = Utils.convertToDate(src.verifiedAt);
    }
    // No check of if(src.verificationToken), otherwise we cannot set it back to null (after being verified)
    dest.verificationToken = src.verificationToken;
  }

  static updateSite(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
      dest.image = src.image;
      dest.companyID = Database.validateId(src.companyID);
    } else {
      dest.companyID = Utils.convertToObjectID(src.companyID);
    }
    dest.name = src.name;
    dest.address = {};
    dest.allowAllUsersToStopTransactions = src.allowAllUsersToStopTransactions;
    dest.autoUserSiteAssignment = src.autoUserSiteAssignment;
    Database.updateAddress(src.address, dest.address);
    Database.updateCreatedAndLastChanged(src, dest);
  }

  static updateVehicleManufacturer(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
      dest.logo = src.logo;
      dest.numberOfVehicles = src.numberOfVehicles;
    }
    dest.name = src.name;
    Database.updateCreatedAndLastChanged(src, dest);
  }

  static updateCreatedAndLastChanged(src, dest) {
    // Check
    if (src.createdBy) {
      // Set
      dest.createdBy = src.createdBy;
      // User model?
      if (typeof dest.createdBy == "object" &&
        dest.createdBy.constructor.name != "ObjectID") {
        // Yes
        dest.createdBy = {};
        Database.updateUser(src.createdBy, dest.createdBy);
      } else {
        try {
          dest.createdBy = Utils.convertToObjectID(dest.createdBy);
          // eslint-disable-next-line no-empty
        } catch (e) {
        } // Not an Object ID
      }
    }
    // Check
    if (src.createdOn) {
      dest.createdOn = Utils.convertToDate(src.createdOn);
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
        Database.updateUser(src.lastChangedBy, dest.lastChangedBy);
      } else {
        try {
          dest.lastChangedBy = Utils.convertToObjectID(dest.lastChangedBy);
          // eslint-disable-next-line no-empty
        } catch (e) {
        } // Not an Object ID
      }
    }
    // Check
    if (src.lastChangedOn) {
      dest.lastChangedOn = Utils.convertToDate(src.lastChangedOn);
    }
  }

  static updateCompany(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
      dest.logo = src.logo;
    }
    dest.name = src.name;
    dest.address = {};
    Database.updateAddress(src.address, dest.address);
    Database.updateCreatedAndLastChanged(src, dest);
  }

  static updateTenant(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
    }
    dest.name = src.name;
    dest.subdomain = src.subdomain;
    dest.email = src.email;
    dest.components = (src.components ? src.components : {});
    Database.updateCreatedAndLastChanged(src, dest);
  }

  static updateConnection(src, dest, forFrontEnd = true) {
    dest.connectorId = src.connectorId;
    dest.createdAt = Utils.convertToDate(src.createdAt);
    dest.updatedAt = Utils.convertToDate(src.updatedAt);
    dest.validUntil = Utils.convertToDate(src.validUntil);
    if (forFrontEnd) {
      Database.updateID(src, dest);
      dest.userId = Database.validateId(src.userId);
    } else {
      dest.userId = Utils.convertToObjectID(src.userId);
    }
    dest.data = src.data;
  }

  static updateVehicle(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
      dest.images = src.images;
      dest.numberOfImages = src.numberOfImages;
      dest.vehicleManufacturerID = Database.validateId(src.vehicleManufacturerID);
    } else {
      dest.vehicleManufacturerID = Utils.convertToObjectID(src.vehicleManufacturerID);
    }
    dest.type = src.type;
    dest.model = src.model;
    dest.batteryKW = Utils.convertToInt(src.batteryKW);
    dest.autonomyKmWLTP = Utils.convertToInt(src.autonomyKmWLTP);
    dest.autonomyKmReal = Utils.convertToInt(src.autonomyKmReal);
    dest.horsePower = Utils.convertToInt(src.horsePower);
    dest.torqueNm = Utils.convertToInt(src.torqueNm);
    dest.performance0To100kmh = Utils.convertToFloat(src.performance0To100kmh);
    dest.weightKg = Utils.convertToInt(src.weightKg);
    dest.lengthMeter = Utils.convertToFloat(src.lengthMeter);
    dest.widthMeter = Utils.convertToFloat(src.widthMeter);
    dest.heightMeter = Utils.convertToFloat(src.heightMeter);
    dest.releasedOn = Utils.convertToDate(src.releasedOn);
    Database.updateCreatedAndLastChanged(src, dest);
  }

  static updateOcpiEndpoint(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
    }

    dest.name = src.name;
    dest.baseUrl = src.baseUrl;
    dest.localToken = src.localToken;
    dest.token = src.token;
    dest.countryCode = src.countryCode;
    dest.partyId = src.partyId;
    dest.backgroundPatchJob = src.backgroundPatchJob;

    if (src.version) {
      dest.version = src.version;
    }
    if (src.businessDetails) {
      dest.businessDetails = src.businessDetails;
    }
    if (src.availableEndpoints) {
      dest.availableEndpoints = src.availableEndpoints;
    }
    if (src.status) {
      dest.status = src.status;
    }
    if (src.versionUrl) {
      dest.versionUrl = src.versionUrl;
    }
    if (src.hasOwnProperty("lastPatchJobOn")) {
      dest.lastPatchJobOn = src.lastPatchJobOn;
    }
    if (src.hasOwnProperty("lastPatchJobOn")) {
      dest.lastPatchJobResult = src.lastPatchJobResult;
    }

    Database.updateCreatedAndLastChanged(src, dest);
  }

  static updateSetting(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
    }

    dest.identifier = src.identifier;
    dest.content = src.content;

    Database.updateCreatedAndLastChanged(src, dest);
  }

  static updateAddress(src, dest) {
    if (src) {
      dest.address1 = src.address1;
      dest.address2 = src.address2;
      dest.postalCode = src.postalCode;
      dest.city = src.city;
      dest.department = src.department;
      dest.region = src.region;
      dest.country = src.country;
      dest.latitude = Utils.convertToFloat(src.latitude);
      dest.longitude = Utils.convertToFloat(src.longitude);
    }
  }

  static updateSiteArea(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
      dest.image = src.image;
      dest.siteID = Database.validateId(src.siteID);
    } else {
      dest.siteID = Utils.convertToObjectID(src.siteID);
    }
    dest.name = src.name;
    dest.address = {};
    dest.maximumPower = src.maximumPower;
    dest.accessControl = src.accessControl;
    Database.updateAddress(src.address, dest.address);
    Database.updateCreatedAndLastChanged(src, dest);
  }

  static updateLogging(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
      dest.userID = Database.validateId(src.userID);
      dest.actionOnUserID = Database.validateId(src.actionOnUserID);
    } else {
      dest.userID = Utils.convertToObjectID(src.userID);
      dest.actionOnUserID = Utils.convertToObjectID(src.actionOnUserID);
    }
    dest.level = src.level;
    dest.source = src.source;
    dest.type = src.type;
    dest.module = src.module;
    dest.method = src.method;
    dest.timestamp = Utils.convertToDate(src.timestamp);
    dest.action = src.action;
    dest.message = src.message;
    dest.detailedMessages = src.detailedMessages;
    if (forFrontEnd && !Utils.isEmptyJSon(src.user)) {
      dest.user = {};
      Database.updateUser(src.user, dest.user);
    }
    if (forFrontEnd && !Utils.isEmptyJSon(src.actionOnUser)) {
      dest.actionOnUser = {};
      Database.updateUser(src.actionOnUser, dest.actionOnUser);
    }
  }

  static updateTransaction(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
      dest.siteID = Database.validateId(src.siteID);
      dest.siteAreaID = Database.validateId(src.siteAreaID);
      dest.userID = Database.validateId(src.userID);
    } else {
      dest.siteID = Utils.convertToObjectID(src.siteID);
      dest.siteAreaID = Utils.convertToObjectID(src.siteAreaID);
      dest.userID = Utils.convertToObjectID(src.userID);
    }
    // User
    if (forFrontEnd && !Utils.isEmptyJSon(src.user)) {
      dest.user = {};
      Database.updateUser(src.user, dest.user, forFrontEnd);
    }
    if (src.hasOwnProperty('numberOfMeterValues')) {
      dest.numberOfMeterValues = src.numberOfMeterValues;
    }
    if (src.hasOwnProperty('currentStateOfCharge')) {
      dest.currentStateOfCharge = src.currentStateOfCharge;
    }
    if (src.hasOwnProperty('lastMeterValue')) {
      dest.lastMeterValue = src.lastMeterValue;
    }
    if (src.hasOwnProperty('currentTotalInactivitySecs')) {
      dest.currentTotalInactivitySecs = src.currentTotalInactivitySecs;
    }
    if (src.hasOwnProperty('currentCumulatedPrice')) {
      dest.currentCumulatedPrice = src.currentCumulatedPrice;
    }
    if (src.hasOwnProperty('currentConsumption')) {
      dest.currentConsumption = src.currentConsumption;
    }
    if (src.hasOwnProperty('currentTotalConsumption')) {
      dest.currentTotalConsumption = src.currentTotalConsumption;
    }
    if (src.hasOwnProperty('timezone')) {
      dest.timezone = src.timezone;
    }
    dest.chargeBoxID = src.chargeBoxID;
    dest.connectorId = Utils.convertToInt(src.connectorId);
    dest.meterStart = Utils.convertToInt(src.meterStart);
    dest.tagID = src.tagID;
    if (src.hasOwnProperty('price')) {
      dest.price = Utils.convertToInt(src.price);
      dest.priceUnit = src.priceUnit;
      dest.roundedPrice = src.roundedPrice;
      dest.pricingSource = src.pricingSource;
    }
    if (!Utils.isEmptyJSon(src.refundData)) {
      dest.refundData = {};
      dest.refundData.refundId = src.refundData.refundId;
      dest.refundData.refundedAt = Utils.convertToDate(src.refundData.refundedAt);
      dest.refundData.type = src.refundData.type;
      dest.refundData.reportId = src.refundData.reportId;
    }
    dest.timestamp = Utils.convertToDate(src.timestamp);
    dest.stateOfCharge = Utils.convertToInt(src.stateOfCharge);
    if (!Utils.isEmptyJSon(src.stop)) {
      dest.stop = {};
      if (forFrontEnd && !Utils.isEmptyJSon(src.stop.user)) {
        dest.stop.user = {};
        Database.updateUser(src.stop.user, dest.stop.user, forFrontEnd);
      }
      forFrontEnd && src.stop.userID ? dest.stop.userID = Database.validateId(src.stop.userID) : dest.stop.userID = Utils.convertToObjectID(src.stop.userID);
      dest.stop.timestamp = Utils.convertToDate(src.stop.timestamp);
      dest.stop.tagID = src.stop.tagID;
      dest.stop.meterStop = Utils.convertToInt(src.stop.meterStop);
      if (src.stop.transactionData) {
        dest.stop.transactionData = src.stop.transactionData;
      }
      dest.stop.stateOfCharge = Utils.convertToInt(src.stop.stateOfCharge);
      dest.stop.totalConsumption = Utils.convertToInt(src.stop.totalConsumption);
      dest.stop.totalInactivitySecs = Utils.convertToInt(src.stop.totalInactivitySecs);
      dest.stop.extraInactivitySecs = Utils.convertToInt(src.stop.extraInactivitySecs);
      dest.stop.totalDurationSecs = Utils.convertToInt(src.stop.totalDurationSecs);
      if (src.stop.hasOwnProperty('price')) {
        dest.stop.price = Utils.convertToInt(src.stop.price);
        dest.stop.roundedPrice = src.stop.roundedPrice;
        dest.stop.priceUnit = src.stop.priceUnit;
        dest.stop.pricingSource = src.stop.pricingSource;
      }
    }
    if (!Utils.isEmptyJSon(src.remotestop)) {
      dest.remotestop = {};
      dest.remotestop.timestamp = src.remotestop.timestamp;
      dest.remotestop.tagID = src.remotestop.tagID;
    }
    if (forFrontEnd) {
      if (!Utils.isEmptyJSon(src.chargeBox)) {
        dest.chargeBox = {};
        Database.updateChargingStation(src.chargeBox, dest.chargeBox);
      }
    }
  }

  static updateConsumption(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
      dest.userID = Database.validateId(src.userID);
      dest.chargeBoxID = Database.validateId(src.chargeBoxID);
      dest.siteID = Database.validateId(src.siteID);
      dest.siteAreaID = Database.validateId(src.siteAreaID);
    } else {
      dest.userID = Utils.convertToObjectID(src.userID);
      dest.chargeBoxID = src.chargeBoxID;
      dest.siteID = Utils.convertToObjectID(src.siteID);
      dest.siteAreaID = Utils.convertToObjectID(src.siteAreaID);
    }
    dest.connectorId = Utils.convertToInt(src.connectorId);
    dest.transactionId = Utils.convertToInt(src.transactionId);
    dest.endedAt = Utils.convertToDate(src.endedAt);
    if (src.stateOfCharge) {
      dest.stateOfCharge = Utils.convertToInt(src.stateOfCharge);
    }
    dest.startedAt = Utils.convertToDate(src.startedAt);
    dest.cumulatedConsumption = Utils.convertToInt(src.cumulatedConsumption);
    dest.consumption = Utils.convertToInt(src.consumption);
    dest.instantPower = Utils.convertToInt(src.instantPower);
    dest.totalInactivitySecs = Utils.convertToInt(src.totalInactivitySecs);
    if (src.pricingSource) {
      dest.pricingSource = src.pricingSource;
      dest.amount = Utils.convertToFloat(src.amount);
      dest.cumulatedAmount = Utils.convertToFloat(src.cumulatedAmount);
      dest.roundedAmount = Utils.convertToFloat(src.roundedAmount);
      dest.currencyCode = src.currencyCode;
    }
  }
}

module.exports = Database;
