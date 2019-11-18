import cfenv from 'cfenv';
import cluster from 'cluster';
import os from 'os';
import Configuration from './Configuration';
import Constants from './Constants';
import Utils from './Utils';

export default class Database {
  public static updateID(src, dest): void {
    // Set it
    if (src.id) {
      dest.id = src.id;
    }
    if (!dest.id && src._id) {
      dest.id = src._id;
    }
    dest.id = Database.validateId(dest.id);
  }

  public static validateId(id): string {
    let changedID = id;
    // Object?
    if (changedID && (typeof changedID === 'object')) {
      // Mongo DB?
      if (changedID instanceof Buffer) {
        changedID = changedID.toString('hex');
      } else {
        changedID = changedID.toString();
      }
    }
    return changedID;
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
      dest.inactive = Utils.getIfChargingStationIsInactive(dest);
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
    if (src.hasOwnProperty('currentIPAddress')) {
      dest.currentIPAddress = src.currentIPAddress;
    }
    dest.connectors = [];
    if (src.connectors) {
      // Set
      for (const connector of src.connectors) {
        if (connector) {
          dest.connectors.push({
            'connectorId': Utils.convertToInt(connector.connectorId),
            'currentConsumption': Utils.convertToFloat(connector.currentConsumption),
            'currentStateOfCharge': Utils.convertToInt(connector.currentStateOfCharge),
            'totalInactivitySecs': Utils.convertToInt(connector.totalInactivitySecs),
            'totalConsumption': Utils.convertToFloat(connector.totalConsumption),
            'status': connector.status,
            'errorCode': connector.errorCode,
            'info': connector.info,
            'vendorErrorCode': connector.vendorErrorCode,
            'power': Utils.convertToInt(connector.power),
            'type': connector.type,
            'voltage': Utils.convertToInt(connector.voltage),
            'amperage': Utils.convertToInt(connector.amperage),
            'activeTransactionID': Utils.convertToInt(connector.activeTransactionID),
            'statusLastChangedOn': Utils.convertToDate(connector.statusLastChangedOn)
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

  static updateLock(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
    }
    dest.timestamp = Utils.convertToDate(src.timestamp);
    dest.type = src.type;
    dest.name = src.name;
    if (!src.hostname) {
      dest.hostname = Configuration.isCloudFoundry() ? cfenv.getAppEnv().name : os.hostname();
    } else {
      dest.hostname = src.hostname;
    }
  }

  static updateRunLock(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
    }
    dest.timestamp = Utils.convertToDate(src.timestamp);
    dest.type = 'runLock';
    dest.name = src.name;
    if (!src.hostname) {
      dest.hostname = Configuration.isCloudFoundry() ? cfenv.getAppEnv().name : os.hostname();
    } else {
      dest.hostname = src.hostname;
    }
  }

  static updateStatusNotification(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
    }
    dest.chargeBoxID = src.chargeBoxID;
    dest.connectorId = Utils.convertToInt(src.connectorId);
    dest.timestamp = Utils.convertToDate(src.timestamp);
    if (src.timezone) {
      dest.timezone = src.timezone;
    }
    dest.status = src.status;
    dest.errorCode = src.errorCode;
    dest.info = src.info;
    dest.vendorId = src.vendorId;
    dest.vendorErrorCode = src.vendorErrorCode;
    dest.statusLastChangedOn = src.statusLastChangedOn;
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
    if (src.attribute.format === 'SignedData') {
      dest.value = src.value;
    } else {
      dest.value = Utils.convertToInt(src.value);
    }
    dest.attribute = src.attribute;
  }

  static updateUser(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
      if (src.image) {
        dest.image = src.image;
      }
      if ('siteAdmin' in src) {
        dest.siteAdmin = src.siteAdmin;
      }
    }
    if (src.hasOwnProperty('name')) {
      dest.name = src.name;
    }
    if (src.hasOwnProperty('firstName')) {
      dest.firstName = src.firstName;
    }
    if (src.hasOwnProperty('email')) {
      dest.email = src.email;
    }
    if (src.hasOwnProperty('phone')) {
      dest.phone = src.phone;
    }
    if (src.hasOwnProperty('mobile')) {
      dest.mobile = src.mobile;
    }
    if (src.hasOwnProperty('notificationsActive')) {
      dest.notificationsActive = src.notificationsActive;
    }
    if (src.hasOwnProperty('notifications')) {
      dest.notifications = src.notifications;
    }
    if (src.hasOwnProperty('iNumber')) {
      dest.iNumber = src.iNumber;
    }
    if (src.hasOwnProperty('costCenter')) {
      dest.costCenter = src.costCenter;
    }
    dest.address = {};
    if (src.hasOwnProperty('address')) {
      Database.updateAddress(src.address, dest.address);
    }
    if (src.hasOwnProperty('status')) {
      dest.status = src.status;
    }
    if (src.hasOwnProperty('locale')) {
      dest.locale = src.locale;
    }
    if (src.hasOwnProperty('eulaAcceptedOn')) {
      dest.eulaAcceptedOn = Utils.convertToDate(src.eulaAcceptedOn);
      dest.eulaAcceptedVersion = src.eulaAcceptedVersion;
      dest.eulaAcceptedHash = src.eulaAcceptedHash;
    }
    Database.updateCreatedAndLastChanged(src, dest);
    dest.deleted = src.deleted;
    if (forFrontEnd && src.hasOwnProperty('tagIDs')) {
      dest.tagIDs = src.tagIDs;
    }
    if (src.hasOwnProperty('plateID')) {
      dest.plateID = src.plateID;
    }
    if (src.hasOwnProperty('role')) {
      dest.role = src.role;
    }
    if (src.hasOwnProperty('password')) {
      dest.password = src.password;
      dest.passwordWrongNbrTrials = Utils.convertToInt(src.passwordWrongNbrTrials);
      dest.passwordBlockedUntil = Utils.convertToDate(src.passwordBlockedUntil);
    }
    if (src.hasOwnProperty('passwordResetHash')) {
      dest.passwordResetHash = src.passwordResetHash;
    }
    if (src.hasOwnProperty('verifiedAt')) {
      dest.verifiedAt = Utils.convertToDate(src.verifiedAt);
    }
    // No check of if (src.verificationToken), otherwise we cannot set it back to null (after being verified)
    dest.verificationToken = src.verificationToken;
  }

  static updateCreatedAndLastChanged(src, dest) {
    // Check
    if (src.createdBy) {
      // Set
      dest.createdBy = src.createdBy;
      // User model?
      if (typeof dest.createdBy === 'object' &&
        dest.createdBy.constructor.name !== 'ObjectID') {
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
      if (typeof dest.lastChangedBy === 'object' &&
        dest.lastChangedBy.constructor.name !== 'ObjectID') {
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
    if (src.lastPatchJobOn) {
      dest.lastPatchJobOn = src.lastPatchJobOn;
    }
    if (src.lastPatchJobOn) {
      dest.lastPatchJobResult = src.lastPatchJobResult;
    }

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

  public static updateLogging(src, dest, forFrontEnd = true): void {
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
    if (src.hasOwnProperty('host')) {
      dest.host = src.host;
    } else {
      dest.host = Configuration.isCloudFoundry() ? cfenv.getAppEnv().name : os.hostname();
    }
    if (src.hasOwnProperty('process')) {
      dest.process = src.process;
    } else {
      dest.process = cluster.isWorker ? 'worker ' + cluster.worker.id : 'master';
    }
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
}
