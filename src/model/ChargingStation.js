const Utils = require('../utils/Utils');
const SoapChargingStationClient = require('../client/soap/SoapChargingStationClient');
const Logging = require('../utils/Logging');
const User = require('./User');
const Users = require('../utils/Users');
const Database = require('../utils/Database');
const moment = require('moment');
const Configuration = require('../utils/Configuration');
const NotificationHandler = require('../notification/NotificationHandler');

_configAdvanced = Configuration.getAdvancedConfig();

class ChargingStation {
  constructor(chargingStation) {
    // Init model
    this._model = {};
    // Set it
    Database.updateChargingStation(chargingStation, this._model);
  }

  handleAction(action, params) {
    // Handle Client Requests
    switch (action) {
      // Reset
      case "Reset":
        return this.requestReset(params.type);

      // Clear cache
      case "ClearCache":
        return this.requestClearCache();

      // Get Configuration
      case "GetConfiguration":
        return this.requestGetConfiguration(params.keys);

      // Set Configuration
      case "ChangeConfiguration":
        // Change the config
        return this.requestChangeConfiguration(params.key, params.value);
      // Unlock Connector
      case "UnlockConnector":
        return this.requestUnlockConnector(params.connectorId);

      // Stop Transaction
      case "StopTransaction":
        return this.requestStopTransaction(params.transactionId);

      // Not Exists!
      default:
        // Log
        Logging.logError({
          userFullName: "System", source: "Central Server", module: "ChargingStation", method: "handleAction",
          message: `Action does not exist: ${action}` });
        throw new Error(`Action does not exist: ${action}`);
    }
  }

  getID() {
    return this._model.id;
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
    statusNotification.chargeBoxID = this.getChargeBoxIdentity();

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
      return this.getConfiguration().then((configuration) => {
        var voltageRerefence = 0;
        var current = 0;
        var chargerConsumption = 0;
        var nbPhase = 0;

        if (configuration && configuration.configuration) {
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
              case "currentpb1":
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
    bootNotification.chargeBoxID = this.getChargeBoxIdentity();

    // Save Boot Notification
    return global.storage.saveBootNotification(bootNotification);
  }

  updateChargingStationConsumption(transactionId) {
    console.log("updateChargingStationConsumption");
    // Get the last tranasction first
    return this.getTransaction(transactionId).then((transaction) => {
      console.log(transaction);
      // Get connectorId
      let connector = this.getConnectors()[transaction.connectorId-1];
      console.log(connector);
      // Found?
      if (transaction && !transaction.stop) {
        // Get the consumption
        this.getConsumptionsFromTransaction(transaction, true).then((consumption) => {
          console.log(consumption);
          let currentConsumption = 0;
          let totalConsumption = 0;
          // Check
          if (consumption) {
            currentConsumption = (consumption.values.length > 0?consumption.values[consumption.values.length-1].value:0);
            totalConsumption = consumption.totalConsumption;
          }
          // Changed?
          if (connector.currentConsumption !== currentConsumption || connector.totalConsumption !== totalConsumption) {
            // Set consumption
            connector.currentConsumption = currentConsumption;
            connector.totalConsumption = totalConsumption;
            console.log(`${this.getChargeBoxIdentity()}-${connector.connectorId}-${currentConsumption}-${totalConsumption}` );
            // Log
            Logging.logInfo({
              userFullName: "System", source: "Central Server", module: "ChargingStationConsumptionTask",
              method: "run", action: "ChargingStationConsumption",
              message: `${this.getChargeBoxIdentity()} - ${connector.connectorId} - Consumption changed: ${connector.currentConsumption}, Total: ${connector.totalConsumption}` });              // console.log(`${chargingStation.getChargeBoxIdentity()}-${connector.connectorId}-No Transaction` );
            // Save
            this.save();
          }
        });
      } else {
        // Check
        if (connector.currentConsumption !== 0 || connector.totalConsumption !== 0) {
          // Set consumption
          connector.currentConsumption = 0;
          connector.totalConsumption = 0;
          console.log(`${this.getChargeBoxIdentity()}-${connector.connectorId}-${currentConsumption}-${totalConsumption}` );
          // Log
          Logging.logInfo({
            userFullName: "System", source: "Central Server", module: "ChargingStationConsumptionTask",
            method: "run", action: "ChargingStationConsumption",
            message: `${this.getChargeBoxIdentity()} - ${connector.connectorId} - Consumption changed: ${connector.currentConsumption}, Total: ${connector.totalConsumption}` });              // console.log(`${chargingStation.getChargeBoxIdentity()}-${connector.connectorId}-No Transaction` );
          // Save
          this.save();
        }
      }
    });
  }

  saveMeterValues(meterValues) {
    // Create model
    var newMeterValues = {};
    // Init
    newMeterValues.values = [];
    // Set the charger ID
    newMeterValues.chargeBoxID = this.getChargeBoxIdentity();
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
      newMeterValue.chargeBoxID = newMeterValues.chargeBoxID;
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
      console.log(newMeterValues);
      // Log
      Logging.logInfo({
        userFullName: "System", source: this.getChargeBoxIdentity(), module: "ChargingStation", method: "saveMeterValues",
        action: "MeterValues", message: `Meter Values saved successfully`,
        detailedMessages: newMeterValues });

      // Update Charging Station Consumption
      this.updateChargingStationConsumption(meterValues.transactionId);
    });
  }

  saveConfiguration(configuration) {
    // Set the charger ID
    configuration.chargeBoxID = this.getChargeBoxIdentity();
    configuration.timestamp = new Date();

    // Save config
    return global.storage.saveConfiguration(configuration);
  }

  saveStartTransaction(transaction) {
    // Set the charger ID
    transaction.chargeBoxID = this.getChargeBoxIdentity();
    // Check if already exists
    if (!transaction.id) {
      // No: Check user and save
      return this.checkIfUserIsAuthorized(transaction, global.storage.saveStartTransaction);
    } else {
      // Yes: save it
      return global.storage.saveStartTransaction(transaction);
    }
  }

  saveDataTransfer(dataTransfer) {
    // Set the charger ID
    dataTransfer.chargeBoxID = this.getChargeBoxIdentity();
    dataTransfer.timestamp = new Date();

    // Save it
    return global.storage.saveDataTransfer(dataTransfer);
  }

  saveDiagnosticsStatusNotification(diagnosticsStatusNotification) {
    // Set the charger ID
    diagnosticsStatusNotification.chargeBoxID = this.getChargeBoxIdentity();
    diagnosticsStatusNotification.timestamp = new Date();

    // Save it
    return global.storage.saveDiagnosticsStatusNotification(diagnosticsStatusNotification);
  }

  saveFirmwareStatusNotification(firmwareStatusNotification) {
    // Set the charger ID
    firmwareStatusNotification.chargeBoxID = this.getChargeBoxIdentity();
    firmwareStatusNotification.timestamp = new Date();

    // Save it
    return global.storage.saveFirmwareStatusNotification(firmwareStatusNotification);
  }

  saveAuthorize(authorize) {
    // Set the charger ID
    authorize.chargeBoxID = this.getChargeBoxIdentity();
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
        if (user.getStatus() !== Users.USER_STATUS_ACTIVE) {
          // Reject but save ok
          return Promise.reject( new Error(`User ${user.getFullName()} with TagID ${request.idTag} is not Active`) );
        } else {
          // Save it
          request.user = user;
          // Check function
          if (saveFunction.name === "saveStartTransaction") {
            // Notify user
            NotificationHandler.sendTransactionStarted(
              request.transactionId,
              user.getModel(),
              this.getModel(),
              {
                "user": user.getModel(),
                "chargingStationId": this.getChargeBoxIdentity(),
                "connectorId": request.connectorId,
                "evseDashboardChargingStationURL" : Utils.buildEvseChargingStationURL(this, request.connectorId)
              },
              user.getLocale()
            );
          }

          // Execute the function
          return saveFunction(request);
        }
      } else {
        // Create an empty user
        var newUser = new User({
          name: "Unknown",
          firstName: "User",
          status: Users.USER_STATUS_PENDING,
          email: request.idTag + "@sap.com",
          tagIDs: [request.idTag]
        });

        // Save the user
        return newUser.save().then((user) => {
          // Send Notification
          NotificationHandler.sendUnknownUserBadged(
            Utils.generateID(),
            this.getModel(),
            {
              "chargingStationId": this.getChargeBoxIdentity(),
              "badgeId": request.idTag,
              "evseDashboardUserURL" : Utils.buildEvseUserURL(user)
            }
          );
          // Reject but save ok
          return Promise.reject( new Error(`User with Tag ID ${request.idTag} not found but saved as inactive user (John DOE)`) );
        }, (err) => {
          // Reject, cannot save
          return Promise.reject( new Error(`User with Tag ID ${request.idTag} not found and cannot be created: ${err.toString()}`) );
        });
      }
    });
  }

  getTransaction(transactionId) {
    // Get the tranasction first (to get the connector id)
    return global.storage.getTransaction(transactionId);
  }

  saveStopTransaction(stopTransaction) {
    // Set the charger ID
    stopTransaction.chargeBoxID = this.getChargeBoxIdentity();
    // Get the tranasction first (to get the connector id)
    return this.getTransaction(stopTransaction.transactionId).then((transaction) => {
      if (transaction) {
        // Init the charging station
        this.getConnectors()[transaction.connectorId-1].currentConsumption = 0;
        this.getConnectors()[transaction.connectorId-1].totalConsumption = 0;
        // Save it
        this.save();
        // Compute total consumption (optimization)
        return this.getConsumptionsFromTransaction(transaction, true);
      } else {
        throw new Error(`The Transaction ID '${stopTransaction.transactionId}' does not exist`);
      }
    }).then((consumption) => {
      // Set the total consumption (optimization)
      stopTransaction.totalConsumption = consumption.totalConsumption;
      // User Provided?
      if (stopTransaction.idTag) {
        // Save it with the user
        return this.checkIfUserIsAuthorized(stopTransaction, global.storage.saveStopTransaction);
      } else {
        // Save it without the User
        return global.storage.saveStopTransaction(stopTransaction);
      }
    });
  }

  // Restart the charger
  requestReset(type) {
    // Get the client
    return this.getChargingStationClient().then((chargingStationClient) => {
      // Restart
      return chargingStationClient.reset(type);
    });
  }

  // Stop Transaction
  requestStopTransaction(params) {
    // Get the client
    return this.getChargingStationClient().then((chargingStationClient) => {
      // Restart
      return chargingStationClient.stopTransaction(params);
    });
  }

  // Clear the cache
  requestClearCache() {
    // Get the client
    return this.getChargingStationClient().then((chargingStationClient) => {
      // Restart
      return chargingStationClient.clearCache();
    });
  }

  // Get the configuration for the EVSE
  requestGetConfiguration(configParamNames) {
    // Get the client
    return this.getChargingStationClient().then((chargingStationClient) => {
      // Get config
      return chargingStationClient.getConfiguration(configParamNames);
    });
  }

  // Get the configuration for the EVSE
  requestChangeConfiguration(key, value) {
    // Get the client
    return this.getChargingStationClient().then((chargingStationClient) => {
      // Get config
      return chargingStationClient.changeConfiguration(key, value);
    // Result
    }).then((result) => {
      // Request the new Configuration?
      if (result.status === "Accepted") {
        // Get the Charging Station Config
        return this.requestGetConfiguration();
      } else {
        // Log
        return Promise.reject(new Error(`Cannot set the configuration param ${key} with value ${value} to ${this.getChargeBoxIdentity()}`));
      }
    }).then((configuration) => {
      // Save it
      if (configuration) {
        // Save
        return this.saveConfiguration(configuration).then((config) => {
          // Ok ?
          if (config) {
            // Return the first result
            return {"status": "Accepted"};
          }
        });
      } else {
        // Log
        return Promise.reject(new Error(`Cannot retrieve the Configuration of ${this.getChargeBoxIdentity()}`));
      }
    });
  }

  // Unlock connector
  requestUnlockConnector(params) {
    // Get the client
    return this.getChargingStationClient().then((chargingStationClient) => {
      // Get config
      return chargingStationClient.unlockConnector(params);
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

  getTransactions(connectorId, startDateTime, endDateTime) {
    // Get the consumption
    return global.storage.getTransactions(
      {"chargeBoxIdentity" : this.getChargeBoxIdentity(),
       "connectorId": connectorId,
       "startDateTime": startDateTime,
       "endDateTime" : endDateTime});
  }

  getLastTransaction(connectorId) {
    // Get the consumption
    return global.storage.getLastTransaction(this.getChargeBoxIdentity(), connectorId);
  }

  getLastAverageConsumption(connectorId, numberOfMeters=1) {
    var avgConsumption = 0;
    // Get the last tranasction first
    return this.getLastTransaction(connectorId).then((transaction) => {
      // Found?
      if (transaction && !transaction.stop) {
        // Get the last 5 meter values
        return global.storage.getLastMeterValuesFromTransaction(
            this.getChargeBoxIdentity(), connectorId,
            transaction.transactionId, numberOfMeters+1).then((meterValues) => {
          // Build the header
          var chargingStationConsumption = {};
          chargingStationConsumption.values = [];
          chargingStationConsumption.totalConsumption = 0;
          chargingStationConsumption.chargeBoxID = this.getChargeBoxIdentity();
          chargingStationConsumption.connectorId = connectorId;
          chargingStationConsumption.transactionId = transaction.transactionId;
          // Compute consumption
          var consumptions = this.buildConsumption(chargingStationConsumption, meterValues, null, false);
          // Check
          if (consumptions && consumptions.values) {
            // Compute the averages
            for (var i = 0; i < consumptions.values.length; i++) {
              avgConsumption += consumptions.values[i].value;
            }
            // Avg
            avgConsumption /= consumptions.values.length;
          }
          // Round
          avgConsumption = Math.round(avgConsumption);
          // Debug
          Logging.logDebug({
            userFullName: "System", source: chargingStationConsumption.chargeBoxID,
            module: "ChargingStation", method: "getLastAverageConsumption", action: "AverageConsumption",
            message: `${chargingStationConsumption.chargeBoxID} - ${chargingStationConsumption.connectorId} - values: ${(consumptions.values?JSON.stringify(consumptions.values):"")} - avg: ${avgConsumption}` });
          return avgConsumption;
        });
      } else {
        // None
        return avgConsumption;
      }
    });
  }

  getConsumptionsFromTransaction(transaction, optimizeNbrOfValues) {
    // Get the last 5 meter values
    return global.storage.getMeterValuesFromTransaction(
        this.getChargeBoxIdentity(), transaction.connectorId,
        transaction.transactionId).then((meterValues) => {
      // Build the header
      var chargingStationConsumption = {};
      chargingStationConsumption.values = [];
      chargingStationConsumption.totalConsumption = 0;
      chargingStationConsumption.chargeBoxID = this.getChargeBoxIdentity();
      chargingStationConsumption.connectorId = transaction.connectorId;
      chargingStationConsumption.transactionId = transaction.transactionId;

      // Compute consumption
      return this.buildConsumption(chargingStationConsumption, meterValues, transaction, optimizeNbrOfValues);
    });
  }

  getConsumptionsFromDateTimeRange(connectorId, startDateTime, endDateTime, optimizeNbrOfValues) {
    // Define end date default
    if (!endDateTime) {
      endDateTime = new Date().toISOString(); // Current day
    }
    // Build the request
    return global.storage.getMeterValuesFromDateTimeRange(
        this.getChargeBoxIdentity(),
        connectorId,
        startDateTime,
        endDateTime).then((meterValues) => {
      // Build the header
      var chargingStationConsumption = {};
      chargingStationConsumption.values = [];
      chargingStationConsumption.totalConsumption = 0;
      chargingStationConsumption.chargeBoxID = this.getChargeBoxIdentity();
      chargingStationConsumption.connectorId = connectorId;
      if (startDateTime) {
        chargingStationConsumption.startDateTime = startDateTime;
      }
      if (endDateTime) {
        chargingStationConsumption.endDateTime = endDateTime;
      }

      // Compute consumption
      return this.buildConsumption(chargingStationConsumption, meterValues, null, optimizeNbrOfValues);
    });
  }

  // Method to build the consumption
  buildConsumption(chargingStationConsumption, meterValues, transaction, optimizeNbrOfValues) {
    // Init
    let totalNbrOfMetrics = 0;
    let lastMeterValue;
    let firstMeterValueSet = false;
    // Set first value from transaction
    if (meterValues && meterValues.length > 0 && transaction) {
      // Set last meter value
      let meterValueFromTransaction = {
        id: '666',
        connectorId: transaction.connectorId,
        transactionId: transaction.transactionId,
        timestamp: transaction.timestamp,
        value: transaction.meterStart,
        attribute: {
          unit: 'Wh',
          location: 'Outlet',
          measurand: 'Energy.Active.Import.Register',
          format: 'Raw',
          context: 'Sample.Periodic'
        }
      };
      // Append
      meterValues.splice(0, 0, meterValueFromTransaction);

      // Set last value from transaction
      if (transaction.stop) {
        // Set last meter value
        meterValueFromTransaction.timestamp = transaction.stop.timestamp;
        meterValueFromTransaction.value = transaction.stop.meterStop;
        // Append
        meterValues.push(meterValueFromTransaction);
      }
    }
    // Build the model
    meterValues.forEach((meterValue, meterValueIndex) => {
      // Get the stored values
      let numberOfReturnedMeters = chargingStationConsumption.values.length;

      // Filter on consumption value
      if (meterValue.attribute && meterValue.attribute.measurand &&
          meterValue.attribute.measurand === "Energy.Active.Import.Register") {
        // Get the moment
        let currentTimestamp = moment(meterValue.timestamp);
        // First value?
        if (!firstMeterValueSet) {
          // No: Keep the first value
          lastMeterValue = meterValue;
          // Ok
          firstMeterValueSet = true;

        // Calculate the consumption with the last value provided
        } else {
          // Last value is > ?
          if (lastMeterValue.value > meterValue.value) {
            // Yes: reinit it (the value has started over from 0)
            lastMeterValue.value = 0;
          }

          // Value provided?
          if (meterValue.value > 0) {
            // Get the moment
            let currentTimestamp = moment(meterValue.timestamp);
            // Check if it will be added
            let addValue = false;
            // Start to return the value after the requested date
            if (!chargingStationConsumption.startDateTime ||
                currentTimestamp.isAfter(chargingStationConsumption.startDateTime) ) {
              // Set default
              addValue = true;
              // Count
              totalNbrOfMetrics++;
              // Get the diff
              var diffSecs = currentTimestamp.diff(lastMeterValue.timestamp, "seconds");
              // Sample multiplier
              let sampleMultiplier = 3600 / diffSecs;
              // compute
              let currentConsumption = (meterValue.value - lastMeterValue.value) * sampleMultiplier;
              // At least one value returned
              if (numberOfReturnedMeters > 0) {
                // Consumption?
                if (currentConsumption > 0) {
                  // 0..123 -> Current value is positive and n-1 is 0: add 0 before the end graph is drawn
                  if (chargingStationConsumption.values[numberOfReturnedMeters-1].value === 0) {
                    // Check the timeframe: should be just before: if not add one
                    if (currentTimestamp.diff(chargingStationConsumption.values[numberOfReturnedMeters-1].date, "seconds") > diffSecs) {
                      // Add a 0 just before
                      chargingStationConsumption.values.push({date: currentTimestamp.clone().subtract(diffSecs, "seconds").toDate(), value: 0 });
                    }
                  // Return one value every 'n' time intervals
                  } else if (optimizeNbrOfValues && currentTimestamp.diff(chargingStationConsumption.values[numberOfReturnedMeters-1].date, "seconds") < _configAdvanced.chargeCurveTimeFrameSecsPoint) {
                    // Do not add
                    addValue = false;
                  }
                } else {
                  // Check if last but one consumption was 0 and not the last meter value
                  if ((chargingStationConsumption.values[numberOfReturnedMeters-1].value === 0) &&
                      (meterValueIndex !== meterValues.length-1)) {
                    // Do not add
                    addValue = false;
                  }
                }
              }
              // Counting
              chargingStationConsumption.totalConsumption += meterValue.value - lastMeterValue.value;
              // Add it?
              if (addValue) {
                // Set the consumption
                chargingStationConsumption.values.push({date: meterValue.timestamp, value: currentConsumption });
              }
              // Debug
              //console.log(`Date: ${meterValue.timestamp.toISOString()}, Last Meter: ${lastMeterValue.value}, Meter: ${meterValue.value}, Conso: ${currentConsumption}, Cumulated: ${chargingStationConsumption.totalConsumption}`);
            }
          } else {
            // Last one is 0, set it to 0
            if (meterValueIndex === meterValues.length-1) {
              // Add a 0 just before
              chargingStationConsumption.values.push({date: currentTimestamp.toDate(), value: 0 });
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
        userFullName: "System", source: this.getChargeBoxIdentity(), module: "ChargingStation",
        method: "buildConsumption", action:"BuildConsumption",
        message: `Consumption - ${meterValues.length} metrics, ${totalNbrOfMetrics} relevant, ${chargingStationConsumption.values.length} returned` });
    }
    // Return the result
    return chargingStationConsumption;
  }
}


module.exports = ChargingStation;
