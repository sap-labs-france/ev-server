var Utils = require('../utils/Utils');
var SoapChargingStationClient = require('../client/soap/SoapChargingStationClient');
var Promise = require('promise');
var Logging = require('../utils/Logging');
var User = require('./User');
var Users = require('../utils/Users');
var moment = require('moment');

class ChargingStation {
  constructor(chargingStation) {
    // Init model
    this._model = {};

    // Set it
    Utils.updateChargingStationObject(chargingStation, this._model);
  }

  handleAction(action, args) {
    // Handle Client Requests
    switch (action) {
      // Reset
      case "Reset":
        // Reboot
        return this.requestReset(args);
        break;

      // Clear cache
      case "ClearCache":
        // Reboot
        return this.requestClearCache(args);
        break;

      // Configuration
      case "GetConfiguration":
        // Reboot
        return this.requestConfiguration(args);
        break;

      // Not Exists!
      default:
        // Log
        Logging.logError({
          source: "Central Server", module: "ChargingStation", method: "handleAction",
          message: `Action does not exist: ${action}` });
        throw new Error(`Action does not exist: ${action}`);
    }
  }

  getChargePointVendor() {
    return this._model.chargePointVendor;
  }

  setChargePointVendor(chargePointVendor) {
    this._model.chargePointVendor = chargePointVendor;
  }

  getChargePointModel() {
    return this._model.chargePointModel;
  }

  setChargePointModel(chargePointModel) {
    this._model.chargePointModel = chargePointModel;
  }

  getChargePointSerialNumber() {
    return this._model.chargePointSerialNumber;
  }

  setChargePointSerialNumber(chargePointSerialNumber) {
    this._model.chargePointSerialNumber = chargePointSerialNumber;
  }

  getChargeBoxSerialNumber() {
    return this._model.chargeBoxSerialNumber;
  }

  setChargeBoxSerialNumber(chargeBoxSerialNumber) {
    this._model.chargeBoxSerialNumber = chargeBoxSerialNumber;
  }

  getFirmwareVersion() {
    return this._model.firmwareVersion;
  }

  setFirmwareVersion(firmwareVersion) {
    this._model.firmwareVersion = firmwareVersion;
  }

  getIccid() {
    return this._model.iccid;
  }

  setIccid(iccid) {
    this._model.iccid = iccid;
  }

  getImsi() {
    return this._model.imsi;
  }

  setImsi(imsi) {
    this._model.imsi = imsi;
  }

  getMeterType() {
    return this._model.meterType;
  }

  setMeterType(meterType) {
    this._model.meterType = meterType;
  }

  getMeterSerialNumber() {
    return this._model.meterSerialNumber;
  }

  setMeterSerialNumber(meterSerialNumber) {
    this._model.meterSerialNumber = meterSerialNumber;
  }

  getEndPoint() {
    return this._model.endpoint;
  }

  setEndPoint(endpoint) {
    this._model.endpoint = endpoint;
  }

  getOcppVersion() {
    return this._model.ocppVersion;
  }

  setOcppVersion(ocppVersion) {
    this._model.ocppVersion = ocppVersion;
  }

  getChargeBoxIdentity() {
    return this._model.chargeBoxIdentity;
  }

  setChargeBoxIdentity(chargeBoxIdentity) {
    this._model.chargeBoxIdentity = chargeBoxIdentity;
  }

  getChargingStationClient() {
    // Already created?
    if (!this._chargingStationClient) {
      // Init client
      return new SoapChargingStationClient(this).then((soapClient) => {
        this._chargingStationClient = soapClient;
        return this._chargingStationClient;
      });
    } else {
      return Promise.resolve(this._chargingStationClient);
    }
  }

  getLastHeartBeat() {
    return this._model.lastHeartBeat;
  }

  setLastHeartBeat(lastHeartBeat) {
    this._model.lastHeartBeat = lastHeartBeat;
  }

  getConnectors() {
    return this._model.connectors;
  }

  setConnectors(connectors) {
    this._model.connectors = connectors;
  }

  getMeterIntervalSecs() {
    return this._model.meterIntervalSecs;
  }

  setMeterIntervalSecs(meterIntervalSecs) {
    this._model.meterIntervalSecs = meterIntervalSecs;
  }

  getLastReboot() {
    return this._model.lastReboot;
  }

  setLastReboot(lastReboot) {
    this._model.lastReboot = lastReboot;
  }

  getModel() {
    return this._model;
  }

  save() {
    // Init Connectors
    if (!this.getConnectors()) {
      this.setConnectors([]);
    }

    // Save
    return global.storage.saveChargingStation(this);
  }

  saveStatusNotification(statusNotification) {
    // Set the Station ID
    statusNotification.chargeBoxIdentity = this.getChargeBoxIdentity();

    // Update the connector -----------------------------------------
    // Get the connectors
    let connectors = this.getConnectors();

    // Init previous connector status
    for (var i = 0; i < statusNotification.connectorId; i++) {
      // Check if former connector can be set
      if (!connectors[i]) {
        // Init
        connectors[i] = { connectorId: i+1, currentConsumption: 0, status: 'Unknown', power: 0 };
      }
    }

    // Set the status
    connectors[statusNotification.connectorId-1].connectorId = statusNotification.connectorId;
    // Error Code?
    connectors[statusNotification.connectorId-1].status = statusNotification.status;
    connectors[statusNotification.connectorId-1].errorCode = statusNotification.errorCode;
    this.setConnectors(connectors);

    // Compute the power of the connector
    // Use a function to pass the connector`
    return ((connector) => {
      // Get the configuration
      return this.getConfiguration("StatusNotification").then((configuration) => {
        var voltageRerefence = 0;
        var current = 0;
        var chargerConsumption = 0;
        var nbPhase = 0;

        if (configuration.configuration) {
          // Search for params
          for (var i = 0; i < configuration.configuration.length; i++) {
            // Check
            switch (configuration.configuration[i].key) {
              // Voltage
              case "voltagererefence":
                // Get the meter interval
                voltageRerefence = parseInt(configuration.configuration[i].value);
                break;

              // Current
              case "currentpb" + statusNotification.connectorId:
                // Get the meter interval
                current = parseInt(configuration.configuration[i].value);
                break;

              // Nb Phase
              case "nbphase":
                // Get the meter interval
                nbPhase = parseInt(configuration.configuration[i].value);
                break;
            }
          }

          // Compute it
          connector.power = Math.floor(voltageRerefence * current * Math.sqrt(nbPhase));

          // Save
          return this.save();
        } else {
          // Log
          return Promise.reject(new Error(`Cannot retrieve the Configuration of ${this.getChargeBoxIdentity()}`));
        }

      }).then(() => {
        // Save Status Notif
        return global.storage.saveStatusNotification(statusNotification);
      });
    })(connectors[statusNotification.connectorId-1]);
  }

  saveBootNotification(bootNotification) {
    // Set the Station ID
    bootNotification.chargeBoxIdentity = this.getChargeBoxIdentity();

    // Save Boot Notification
    return global.storage.saveBootNotification(bootNotification);
  }

  saveMeterValues(meterValues) {
    // Create model
    var newMeterValues = {};
    var meterIntervalSecs = parseInt(this.getMeterIntervalSecs());

    // Init
    newMeterValues.values = [];

    // Set the charger ID
    newMeterValues.chargeBoxIdentity = this.getChargeBoxIdentity();

    // Check if OCPP 1.6
    if (meterValues.meterValue) {
      // Set it to 'values'
      meterValues.values = meterValues.meterValue;
    }
    // Only one value?
    if (!Array.isArray(meterValues.values)) {
      // Make it an array
      meterValues.values = [meterValues.values];
    }

    // For each value
    meterValues.values.forEach((value, index) => {
      var newMeterValue = {};

      // Set the ID
      newMeterValue.chargeBoxIdentity = newMeterValues.chargeBoxIdentity;
      newMeterValue.connectorId = meterValues.connectorId;
      if (meterValues.transactionId) {
        newMeterValue.transactionId = meterValues.transactionId;
      }
      newMeterValue.timestamp = value.timestamp;

      // Check OCPP 1.6
      if (value.sampledValue) {
        // Normalize
        value.value = value.sampledValue;
      }

      // Values provided?
      if (value.value) {
        // OCCP1.2: Set the values
        if(value.value.$value) {
          // Set
          newMeterValue.value = value.value.$value;
          newMeterValue.attribute = value.value.attributes;
        } else {
          newMeterValue.value = parseInt(value.value);
        }
      }
      // Add
      newMeterValues.values.push(newMeterValue);
    });

    // Save it
    return global.storage.saveMeterValues(newMeterValues).then(() => {
      // Log
      Logging.logInfo({
        source: this.getChargeBoxIdentity(), module: "ChargingStation", method: "saveMeterValues",
        action: "MeterValues",
        message: `Meter Values saved successfully`,
        detailedMessages: newMeterValues });
    });
  }

  saveConfiguration(configuration) {
    // Set the charger ID
    configuration.chargeBoxIdentity = this.getChargeBoxIdentity();
    configuration.timestamp = new Date();

    // Set the meter value interval to the charging station
    var meterIntervalSecs = 0;
    for (var i = 0; i < configuration.configurationKey.length; i++) {
      // Check
      switch (configuration.configurationKey[i].key) {
        // Meter interval
        case "metervaluesampleinterval":
          // Get the meter interval
          meterIntervalSecs = parseInt(configuration.configurationKey[i].value);
          break;
      }
      // Found?
      if(meterIntervalSecs) {
        break;
      }
    }
    // Set
    this.setMeterIntervalSecs(meterIntervalSecs);
    // Save
    return this.save().then(() => {
      // Save config
      return global.storage.saveConfiguration(configuration);
    });
  }

  saveStartTransaction(transaction) {
    // Set the charger ID
    transaction.chargeBoxIdentity = this.getChargeBoxIdentity();

    // Execute
    return this.checkIfUserIsAuthorized(transaction, global.storage.saveStartTransaction);
  }

  saveDataTransfer(dataTransfer) {
    // Set the charger ID
    dataTransfer.chargeBoxIdentity = this.getChargeBoxIdentity();
    dataTransfer.timestamp = new Date();

    // Save it
    return global.storage.saveDataTransfer(dataTransfer);
  }

  saveDiagnosticsStatusNotification(diagnosticsStatusNotification) {
    // Set the charger ID
    diagnosticsStatusNotification.chargeBoxIdentity = this.getChargeBoxIdentity();
    diagnosticsStatusNotification.timestamp = new Date();

    // Save it
    return global.storage.saveDiagnosticsStatusNotification(diagnosticsStatusNotification);
  }

  saveFirmwareStatusNotification(firmwareStatusNotification) {
    // Set the charger ID
    firmwareStatusNotification.chargeBoxIdentity = this.getChargeBoxIdentity();
    firmwareStatusNotification.timestamp = new Date();

    // Save it
    return global.storage.saveFirmwareStatusNotification(firmwareStatusNotification);
  }

  saveAuthorize(authorize) {
    // Set the charger ID
    authorize.chargeBoxIdentity = this.getChargeBoxIdentity();
    authorize.timestamp = new Date();

    // Execute
    return this.checkIfUserIsAuthorized(authorize, global.storage.saveAuthorize);
  }

  checkIfUserIsAuthorized(request, saveFunction) {
    // Get User
    return global.storage.getUserByTagId(request.idTag).then((user) => {
      // Found?
      if (user) {
        // Check status
        if (user.getStatus() !== Users.USER_ACTIVE) {
          // Reject but save ok
          return Promise.reject( new Error(`User ${user.getFullName()} with TagID ${request.idTag} is not Active`) );
        } else {
          // Save it
          request.user = user;
          return saveFunction(request);
        }
      } else {
        // Create an empty user
        var user = new User({
          name: "Absent",
          firstName: "Temporarily",
          status: Users.USER_PENDING,
          email: request.idTag + "@twilight.zone.fr",
          tagIDs: [request.idTag]
        });

        // Save the user
        return user.save().then(() => {
          // Reject but save ok
          return Promise.reject( new Error(`User with Tag ID ${request.idTag} not found but saved as inactive user (John DOE)`) );
        }, (err) => {
          // Reject, cannot save
          return Promise.reject( new Error(`User with Tag ID ${request.idTag} not found and cannot be created: ${err.toString()}`) );
        });
      }
    });
  }

  saveStopTransaction(stopTransaction) {
    // Set the charger ID
    stopTransaction.chargeBoxIdentity = this.getChargeBoxIdentity();

    // User Provided?
    if (stopTransaction.idTag) {
      // Save it with the user
      return this.checkIfUserIsAuthorized(stopTransaction, global.storage.saveStopTransaction);
    } else {
      // Save it without the User
      return global.storage.saveStopTransaction(stopTransaction);
    }
  }

  // Restart the charger
  requestReset(args) {
    // Get the client
    return this.getChargingStationClient().then((chargingStationClient) => {
      // Restart
      return chargingStationClient.reset(args);
    });
  }

  // Clear the cache
  requestClearCache(args) {
    // Get the client
    return this.getChargingStationClient().then((chargingStationClient) => {
      // Restart
      return chargingStationClient.clearCache(args);
    });
  }

  // Get the configuration for the EVSE
  requestConfiguration(configParamNames) {
    // Get the client
    return this.getChargingStationClient().then((chargingStationClient) => {
      // Get config
      return chargingStationClient.getConfiguration(configParamNames);
    });
  }

  // Get the configuration for the EVSE
  getConfiguration() {
    return global.storage.getConfiguration(this.getChargeBoxIdentity()).then((configuration) => {
      return configuration;
    });
  }

  getStatusNotifications(connectorId) {
    return global.storage.getStatusNotifications(this.getChargeBoxIdentity(), connectorId).then((statusNotifications) => {
      return statusNotifications;
    });
  }

  getLastStatusNotification(connectorId) {
    return global.storage.getLastStatusNotification(this.getChargeBoxIdentity(), connectorId).then((statusNotification) => {
      return statusNotification;
    });
  }

  getConfiguration() {
    return global.storage.getConfiguration(this.getChargeBoxIdentity()).then((configuration) => {
      return configuration;
    });
  }

  getConfigurationParamValue(paramName) {
    return global.storage.getConfigurationParamValue(this.getChargeBoxIdentity(), paramName).then((paramValue) => {
      return paramValue;
    });
  }

  getLastConsumption(connectorId, transactionId) {
    // Get the consumption
    return this.getConsumptions(connectorId, transactionId,
       moment().clone().subtract(parseInt(this.getMeterIntervalSecs())*10, "seconds").toDate().toISOString());
  }

  getConsumptions(connectorId, transactionId, startDateTime, endDateTime) {
    var invalidNbrOfMetrics = 0;
    var totalNbrOfMetrics = 0;

    // Convert to an int
    var meterIntervalSecs = parseInt(this.getMeterIntervalSecs());

    // Define start date default
    if (!startDateTime) {
      // Curent date
      startDateTime = new Date().toISOString(); // Current day
    }
    // Adjust the start time to get the last 2 meter values
    var startDateTimeAdjusted = moment(startDateTime).clone().subtract(meterIntervalSecs, "seconds").toDate().toISOString();

    // Define end date default
    if (!endDateTime) {
      endDateTime = new Date().toISOString(); // Current day
    }

    // Build the request
    return global.storage.getMeterValues(
        this.getChargeBoxIdentity(),
        connectorId,
        transactionId,
        startDateTimeAdjusted,
        endDateTime).then((meterValues) => {
      // Parse the results
      var sampleMultiplier = 3600 / meterIntervalSecs;
      var initialValue = 0; // Should be retrieved from the StartTransaction (MeterStart)
      var chargingStationConsumption = {};
      chargingStationConsumption.values = [];
      chargingStationConsumption.totalConsumption = 0;
      chargingStationConsumption.chargeBoxIdentity = this.getChargeBoxIdentity();
      if (connectorId) {
        chargingStationConsumption.connectorId = connectorId;
      }
      if (startDateTime) {
        chargingStationConsumption.startDateTime = startDateTime;
      }
      if (endDateTime) {
        chargingStationConsumption.endDateTime = endDateTime;
      }

      // Init var
      var lastMeterValue;
      var firstValue = false;

      // Build the model
      meterValues.forEach((meterValue, meterValueIndex) => {
        // Get the stored values
        let numberOfReturnedMeters = chargingStationConsumption.values.length;
        // Filter on consumption value
        if (meterValue.attribute && meterValue.attribute.measurand && meterValue.attribute.measurand === "Energy.Active.Import.Register") {
          // Get the moment
          let currentTimestamp = moment(meterValue.timestamp);

          // Filter values not in the interval!
          if (numberOfReturnedMeters > 0) {
            // Get the diff
            var diffSecs = currentTimestamp.diff(lastMeterValue.timestamp, "seconds");
            // Check
            if (diffSecs < meterIntervalSecs) {
              // Value <> 0?
              if(meterValue.value) {
                // Yes: count it as error
                invalidNbrOfMetrics++;
                // Keep the last one
                lastMeterValue = meterValue;
              }
              // Continue
              return;
            }
          }

          // First init
          if (!firstValue) {
            // Keep
            lastMeterValue = meterValue;
            firstValue = true;

            // Calculate the consumption with the last value provided
          } else {
            // Last value is > ?
            if (lastMeterValue.value > meterValue.value) {
              // Yes: reinit it (the value has started over from 0)
              lastMeterValue.value = 0;
            }

            // Start to return the value after the requested date
            if (currentTimestamp.isSameOrAfter(startDateTime) ) {
              // compute
              var currentConsumption = (meterValue.value - lastMeterValue.value) * sampleMultiplier;
              // Check if it will be added
              let addValue = true;
              // Check graph values: at least one returned value and not the last meter value
              if ((numberOfReturnedMeters > 0) && (meterValueIndex !== meterValues.length-1)) {
                // Current value is 0 and previous is 0
                if (currentConsumption == 0 && chargingStationConsumption.values[numberOfReturnedMeters-1].value == 0) {
                  // Do not add
                  addValue = false;
                // Current value is positive and n-1 is 0: add 0 before the end graph is drawn
                } else if (currentConsumption > 0 && chargingStationConsumption.values[numberOfReturnedMeters-1].value == 0) {
                  // Check the timeframe: should be just before: if not add one
                  if (currentTimestamp.diff(chargingStationConsumption.values[numberOfReturnedMeters-1].date, "seconds") > meterIntervalSecs) {
                    // Add a 0 just before
                    chargingStationConsumption.values.push({date: currentTimestamp.clone().subtract(meterIntervalSecs, "seconds").toDate(), value: 0 });
                  }
                // Return one value every 'n' time intervals
                } else if (currentTimestamp.diff(chargingStationConsumption.values[numberOfReturnedMeters-1].date, "seconds") < (meterIntervalSecs * 10)) {
                  // Do not add
                  addValue = false;
                }
                // // Current value > 0 and n-1 = 0 and n-2 > 0
                // } else if (numberOfReturnedMeters > 1 && meterValue.value !== 0 &&
                //     chargingStationConsumption.values[numberOfReturnedMeters-1].value == 0 &&
                //     chargingStationConsumption.values[numberOfReturnedMeters-2].value !== 0) {
                //   // Check if in the same timeframe
                //   if (currentTimestamp.diff(chargingStationConsumption.values[numberOfReturnedMeters-2].date, "seconds") <= (meterIntervalSecs * 2)) {
                //       // Remove the last one
                //       chargingStationConsumption.values.length = numberOfReturnedMeters - 1;
                //   }
              }
              // Add it?
              if (addValue) {
                // Don't send empty value
                totalNbrOfMetrics++;
                // Counting
                chargingStationConsumption.totalConsumption += meterValue.value - lastMeterValue.value;
                // Set the consumption
                chargingStationConsumption.values.push({date: meterValue.timestamp, value: currentConsumption });
              }
            }
            // Set Last Value
            lastMeterValue = meterValue;
          }
        }
      });

      if (totalNbrOfMetrics) {
        // Log
        Logging.logDebug({
          source: this.getChargeBoxIdentity(), module: "ChargingStation", method: "getConsumptions",
          message: `Number of metrics retrieved to compute the consumption: ${totalNbrOfMetrics}, invalid ones: ${invalidNbrOfMetrics} (${(invalidNbrOfMetrics?Math.ceil(invalidNbrOfMetrics/totalNbrOfMetrics):0)}%)` });
      }

      // Return the result
      return chargingStationConsumption;
    });
  }
}

module.exports = ChargingStation;
