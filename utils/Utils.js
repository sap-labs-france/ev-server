var fs = require('fs');
var path = require('path');

var _config;

module.exports = {

  // Get the process params
  getParam: function(paramName) {
  	var index = process.argv.indexOf(paramName);
    if (index === -1) {
      // Not found!
      console.log(`${paramName} not found!`);
      return null;
    } else {
      // Found
      var res = process.argv[index+1];
      console.log(`${paramName}=${res}`);
      return res;
    }
  },

  // Read the config file
  getConfig() {
    // Read conf
    if (!_config) {
      _config = JSON.parse(fs.readFileSync(path.join(__dirname,"../config.json"), "UTF-8"));
    }
    return _config;
  },

  // Read the user file
  getUsers() {
    // Read conf
    return JSON.parse(fs.readFileSync(path.join(__dirname,"../users.json"), "UTF-8"));
  },

  // Central System config
  getCentralSystemsConfig() {
    // Read conf
    return this.getConfig().CentralSystems;
  },

  // Central System config
  getStoragesConfig() {
    // Read conf
    return this.getConfig().Storages;
  },

  // Central System config
  getChargingStationConfig() {
    // Read conf
    return this.getConfig().ChargingStation;
  },

  getRandomInt() {
    return Math.floor((Math.random() * 1000000000) + 1);
  },

  updateChargingStationObject(src, dest) {
    // Set it
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
    dest.connectors = src.connectors;
    dest.lastHeartBeat = src.lastHeartBeat;
    dest.lastReboot = src.lastReboot;
    dest.meterIntervalSecs = src.meterIntervalSecs;
    dest.connectors.forEach(connector => {
      // Set on the fly
      if(connector.power) {
        // Compute
        connector.currentConsumptionPercent = Math.ceil((connector.currentConsumption / connector.power) * 100);
      } else {
        // Init
        connector.currentConsumptionPercent = 0;
      }
    });
  },

  updateConfiguration(src, dest) {
    // Set it
    dest.chargeBoxIdentity = src.chargeBoxIdentity;
    dest.timestamp = src.timestamp;
    dest.configuration = src.configuration;
  },

  updateStatusNotification(src, dest) {
    // Set it
    dest.chargeBoxIdentity = src.chargeBoxIdentity;
    dest.connectorId = src.connectorId;
    dest.status = src.status;
    dest.errorCode = src.errorCode;
    dest.info = src.info;
    dest.timestamp = src.timestamp;
    dest.vendorId = src.vendorId;
    dest.vendorErrorCode = src.vendorErrorCode;
  },

  updateMeterValue(src, dest) {
    // Set it
    dest.chargeBoxIdentity = src.chargeBoxIdentity;
    dest.connectorId = src.connectorId;
    dest.transactionId = src.transactionId;
    dest.timestamp = src.timestamp;
    dest.values = src.values;
  },

  updateUser(src, dest) {
    // Set it
    dest.name = src.name;
    dest.firstName = src.firstName;
    dest.tagID = src.tagID;
    dest.email = src.email;
    dest.phone = src.phone;
    dest.mobile = src.mobile;
    dest.badgeNumber = src.badgeNumber;
    dest.iNumber = src.iNumber;
    dest.costCenter = src.costCenter;
    dest.location = src.location;
    dest.createdBy = src.createdBy;
    dest.createdOn = src.createdOn;
    dest.lastChangedBy = src.lastChangedBy;
    dest.lastChangedOn = src.lastChangedOn;
    dest.status = src.status;
    dest.electricVehicules = src.electricVehicules;
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
    dest.detailedMessages = src.detailedMessages;
  },

  updateStartTransaction(src, dest) {
    // Set it
    dest.chargeBoxIdentity = src.chargeBoxIdentity;
    dest.connectorId = src.connectorId;
    dest.transactionId = src.transactionId;
    dest.idTag = src.idTag;
    dest.timestamp = src.timestamp;
    dest.meterStart = src.meterStart;
  }
}
