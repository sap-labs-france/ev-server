const fs = require('fs');
const path = require('path');
const Users = require('./Users');
require('source-map-support').install();

module.exports = {
  updateChargingStation(src, dest) {
    // Set it
    dest.id = src._id;
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

  updateConfiguration(src, dest) {
    // Set it
    dest.id = src._id;
    dest.timestamp = src.timestamp;
    dest.configuration = src.configuration;
  },

  updateStatusNotification(src, dest) {
    // Set it
    dest.id = src._id;
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
    dest.id = src._id;
    dest.timestamp = src.timestamp;
    dest.channel = src.channel;
    dest.sourceId = src.sourceId;
    dest.sourceDescr = src.sourceDescr;
    dest.userID = src.userID;
    dest.chargeBoxID = src.chargeBoxID;
  },

  updateMeterValue(src, dest) {
    // Set it
    dest.id = src._id;
    dest.connectorId = src.connectorId;
    dest.transactionId = src.transactionId;
    dest.timestamp = src.timestamp;
    dest.value = src.value;
    dest.attribute = src.attribute;
  },

  updateUser(src, dest) {
    // Set it
    dest.id = src._id;
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
    dest.createdBy = src.createdBy;
    dest.createdOn = src.createdOn;
    dest.lastChangedBy = src.lastChangedBy;
    dest.lastChangedOn = src.lastChangedOn;
    dest.tagIDs = src.tagIDs;
    // No user?
    if (!dest.createdBy) {
      // Set default user
      dest.createdBy = "Central Server";
      dest.createdOn = new Date();
    }
    // Check the password
    if (src.password && src.password.length > 0) {
      // Password can be overridden
      dest.password = src.password;
    }
    // Check the role
    if (src.role && src.role.length > 0) {
      // Role can be overridden
      dest.role = src.role;
    }
    // Check default role value
    if (!dest.role) {
      // Default
      dest.role = Users.USER_ROLE_BASIC;
    }
  },

  updateLoggingObject(src, dest) {
    // Set
    dest.id = src._id;
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
    dest.id = src._id;
    dest.transactionId = src._id;
    // Check User
    if (src.chargeBoxID && src.chargeBoxID._id) {
      // CB populated: Set only important fields
      dest.chargeBoxID = {};
      dest.chargeBoxID.id = src.chargeBoxID._id;
      dest.chargeBoxID.chargeBoxIdentity = src.chargeBoxID._id;
      dest.chargeBoxID.connectors = src.chargeBoxID.connectors;
    } else {
      dest.chargeBoxID = src.chargeBoxID;
    }
    // Check User
    if (src.userID && src.userID._id) {
      // User populated: Set only important fields
      dest.userID = {};
      dest.userID.id = src.userID._id;
      dest.userID.name = src.userID.name;
      dest.userID.firstName = src.userID.firstName;
      dest.userID.locale = src.userID.locale;
      dest.userID.email = src.userID.email;
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
      if (src.stop.userID && src.stop.userID._id) {
        // User populated: Set only important fields
        dest.stop.userID = {};
        dest.stop.userID.id = src.stop.userID._id;
        dest.stop.userID.name = src.stop.userID.name;
        dest.stop.userID.firstName = src.stop.userID.firstName;
        dest.stop.userID.locale = src.stop.userID.locale;
        dest.stop.userID.email = src.stop.userID.email;
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

  updateStartTransaction(src, dest) {
  },

  updateStopTransaction(src, dest) {
  }
};
