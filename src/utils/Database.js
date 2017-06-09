var fs = require('fs');
var path = require('path');
var Users = require('./Users');

module.exports = {
  updateChargingStationObject(src, dest) {
    // Set it
    dest.id = src.id;
    dest.chargeBoxIdentity = src.chargeBoxIdentity;
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
    dest.meterIntervalSecs = src.meterIntervalSecs || 0;
    dest.connectors = src.connectors;
    if (!dest.connectors) {
      dest.connectors = [];
    }
  },

  updateConfiguration(src, dest) {
    // Set it
    dest.timestamp = src.timestamp;
    dest.configuration = src.configuration;
  },

  updateStatusNotification(src, dest) {
    // Set it
    dest.connectorId = src.connectorId;
    dest.timestamp = src.timestamp;
    dest.status = src.status;
    dest.errorCode = src.errorCode;
    dest.info = src.info;
    dest.vendorId = src.vendorId;
    dest.vendorErrorCode = src.vendorErrorCode;
  },

  updateMeterValue(src, dest) {
    // Set it
    dest.connectorId = src.connectorId;
    dest.transactionId = src.transactionId;
    dest.timestamp = src.timestamp;
    dest.value = src.value;
    dest.attribute = src.attribute;
  },

  updateUser(src, dest) {
    // Set it
    dest.id = src.id;
    dest.name = src.name;
    dest.firstName = src.firstName;
    dest.image = src.image;
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
      dest.lastChangedBy = dest.createdBy;
      dest.lastChangedOn = dest.createdOn;
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
    // Set it
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

  updateStartTransaction(src, dest) {
    // Set it
    dest.chargeBoxID = src.chargeBoxID;
    // Check User
    if (src.userID && src.userID.name) {
      // User populated: Set only important fields
      dest.userID = {};
      dest.userID.id = src.userID.id;
      dest.userID.name = src.userID.name;
      dest.userID.firstName = src.userID.firstName;
    } else {
      dest.userID = src.userID;
    }
    dest.connectorId = src.connectorId;
    dest.timestamp = src.timestamp;
    dest.transactionId = src.transactionId;
    dest.meterStart = src.meterStart;
  },

  updateStopTransaction(src, dest) {
    // Set it
    dest.chargeBoxID = src.chargeBoxID;
    // Check User
    if (src.userID && src.userID.name) {
      // User populated: Set only important fields
      dest.userID = {};
      dest.userID.id = src.userID.id;
      dest.userID.name = src.userID.name;
      dest.userID.firstName = src.userID.firstName;
    } else {
      dest.userID = src.userID;
    }
    dest.transactionId = src.transactionId;
    dest.timestamp = src.timestamp;
    dest.connectorId = src.connectorId;
    dest.meterStop = src.meterStop;
    dest.transactionData = src.transactionData;
  }
};
