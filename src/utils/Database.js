const fs = require('fs');
const path = require('path');
const Users = require('./Users');
require('source-map-support').install();

module.exports = {
  updateChargingStation(src, dest) {
    // Set it
    if (src.id) {
      dest.id = src.id;
    }
    dest.chargeBoxIdentity = src.id;
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
    dest.connectors = src.connectors;
    if (!dest.connectors) {
      dest.connectors = [];
    }
  },

  updateMigration(src, dest) {
    // Set it
    if (src.id) {
      dest.id = src.id;
    }
    dest.timestamp = src.timestamp;
    dest.name = src.name;
    dest.version = src.version;
  },

  updateConfiguration(src, dest) {
    // Set it
    if (src.id) {
      dest.id = src.id;
    }
    dest.timestamp = src.timestamp;
    dest.configuration = src.configuration;
  },

  updateStatusNotification(src, dest) {
    // Set it
    if (src.id) {
      dest.id = src.id;
    }
    dest.connectorId = src.connectorId;
    dest.timestamp = src.timestamp;
    dest.status = src.status;
    dest.errorCode = src.errorCode;
    dest.info = src.info;
    dest.vendorId = src.vendorId;
    dest.vendorErrorCode = src.vendorErrorCode;
  },

  updateNotification(src, dest) {
    // Set it
    if (src.id) {
      dest.id = src.id;
    }
    dest.timestamp = src.timestamp;
    dest.channel = src.channel;
    dest.sourceId = src.sourceId;
    dest.sourceDescr = src.sourceDescr;
    dest.userID = src.userID;
    dest.chargeBoxID = src.chargeBoxID;
  },

  updateMeterValue(src, dest) {
    // Set it
    if (src.id) {
      dest.id = src.id;
    }
    dest.connectorId = src.connectorId;
    dest.transactionId = src.transactionId;
    dest.timestamp = src.timestamp;
    dest.value = src.value;
    dest.attribute = src.attribute;
  },

  updateUser(src, dest) {
    // Set it
    if (src.id) {
      dest.id = src.id;
    }
    dest.name = src.name;
    dest.firstName = src.firstName;
    dest.image = src.image;
    dest.locale = src.locale;
    dest.email = src.email;
    dest.phone = src.phone;
    dest.mobile = src.mobile;
    dest.iNumber = src.iNumber;
    dest.costCenter = src.costCenter;
    dest.status = src.status;
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
    dest.role = src.role;
    // Check the password
    if (src.password && src.password.length > 0) {
      // Password can be overridden
      dest.password = src.password;
    }
  },

  updateLoggingObject(src, dest) {
    // Set
    if (src.id) {
      dest.id = src.id;
    }
    dest.level = src.level;
    dest.source = src.source;
    dest.module = src.module;
    dest.method = src.method;
    dest.timestamp = src.timestamp;
    dest.action = src.action;
    dest.message = src.message;
    dest.userFullName = src.userFullName;
    dest.detailedMessages = src.detailedMessages;
  },

  updateTransaction(src, dest) {
    // Set ID
    if (src.id) {
      dest.id = src.id;
    }
    dest.transactionId = src.id;
    // Check User
    if (src.chargeBoxID && src.chargeBoxID.id) {
      // CB populated: Set only important fields
      dest.chargeBoxID = {};
      dest.chargeBoxID.id = src.chargeBoxID.id;
      dest.chargeBoxID.chargeBoxIdentity = src.chargeBoxID.id;
      dest.chargeBoxID.connectors = src.chargeBoxID.connectors;
    } else {
      dest.chargeBoxID = src.chargeBoxID;
    }
    // Check User
    if (src.userID && src.userID.id) {
      // User populated: Set only important fields
      dest.userID = {};
      dest.userID.id = src.userID.id;
      dest.userID.name = src.userID.name;
      dest.userID.firstName = src.userID.firstName;
      dest.userID.locale = src.userID.locale;
      dest.userID.email = src.userID.email;
      dest.userID.image = src.userID.image;
    } else {
      dest.userID = src.userID;
    }
    dest.connectorId = src.connectorId;
    dest.timestamp = src.timestamp;
    dest.tagID = src.tagID;
    dest.meterStart = src.meterStart;
    // Stop?
    if (src.stop) {
      dest.stop = {};
      // Check User
      if (src.stop.userID && src.stop.userID.id) {
        // Only if it's different
        if (src.stop.userID.id !== src.userID.id) {
          // User populated: Set only important fields
          dest.stop.userID = {};
          dest.stop.userID.id = src.stop.userID.id;
          dest.stop.userID.name = src.stop.userID.name;
          dest.stop.userID.firstName = src.stop.userID.firstName;
          dest.stop.userID.locale = src.stop.userID.locale;
          dest.stop.userID.email = src.stop.userID.email;
          dest.stop.userID.image = src.stop.userID.image;
        }
      } else {
        dest.stop.userID = src.stop.userID;
      }
      dest.stop.timestamp = src.stop.timestamp;
      dest.stop.tagID = src.stop.tagID;
      dest.stop.meterStop = src.stop.meterStop;
      dest.stop.transactionData = src.stop.transactionData;
      dest.stop.totalConsumption = src.stop.totalConsumption;
    }
  },
};
