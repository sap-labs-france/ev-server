var mongoose = require('mongoose');
var MDBConfiguration = require('./model/MDBConfiguration');
var MDBUser = require('./model/MDBUser');
var MDBLog = require('./model/MDBLog');
var MDBFirmwareStatusNotification = require('./model/MDBFirmwareStatusNotification');
var MDBDiagnosticsStatusNotification = require('./model/MDBDiagnosticsStatusNotification');
var MDBChargingStation = require('./model/MDBChargingStation');
var MDBAuthorize = require('./model/MDBAuthorize');
var MDBBootNotification = require('./model/MDBBootNotification');
var MDBStatusNotification = require('./model/MDBStatusNotification');
var MDBMeterValue = require('./model/MDBMeterValue');
var MDBStartTransaction = require('./model/MDBStartTransaction');
var MDBStopTransaction = require('./model/MDBStopTransaction');
var MDBDataTransfer = require('./model/MDBDataTransfer');
var User = require('../../model/User');
var ChargingStation = require('../../model/ChargingStation');
var Utils = require('../../utils/Utils');
var Storage = require('../Storage');
var Logging = require('../../utils/Logging');

class MongoDBStorage extends Storage {
    constructor(dbConfig) {
        super(dbConfig);

        // Keep local
        this.dbConfig = dbConfig;

        // Connect
        mongoose.Promise = global.Promise;
        mongoose.connect(`mongodb://${dbConfig.host}:${dbConfig.port}/${dbConfig.schema}`, function(err, db) {
          if (err) {
            console.log(`MongoDB: Error when connecting: ${err.toString()}`);
            return;
          }
          console.log(`MongoDB: Connected to ${dbConfig.host}:${dbConfig.port}, Schema ${dbConfig.schema}`);
          // Log
          Logging.logInfo({
            source: "Central Server", module: "MongoDBStorage", method: "constructor",
            message: `Connected to ${dbConfig.host}:${dbConfig.port}, Schema ${dbConfig.schema}` });
        });
    }

    getConfigurationParamValue(chargeBoxIdentity, paramName, configDate) {
      // Get one param
      return new Promise((fulfill, reject) => {
        // Get the config
        this.getConfiguration(chargeBoxIdentity, configDate).then((configuration) => {
          var value = null;

          if (configuration) {
            // Get the value
            configuration.configuration.every((param) => {
              // Check
              if (param.key === paramName) {
                // Found!
                value = param.value;
                // Break
                return false;
              } else {
                // Continue
                return true;
              }
            });
          }
          // No config
          fulfill(value);
        }).catch((err) => {
          // Log
          Logging.logError({
            source: "CS", module: "MongoDBStorage", method: "getConfigurationParamValue",
            message: `Error in reading, from the Charge Box ${chargeBoxIdentity}, the Configuration value ${paramName}: ${err.toString()}`,
            detailedMessages: err.stack });
          reject();
        });
      });
    }

    getLogging(numberOfLogging) {
      // Get the Config
      return new Promise((fulfill, reject) => {
        if (!numberOfLogging) {
          numberOfLogging = 100;
        }
        // Exec request
        MDBLog.find({})
            .sort({timestamp: -1}).limit(numberOfLogging)
            .exec((err, loggingsMongoDB) => {

          if (err) {
            // Log
            Logging.logError({
              source: "Central Server", module: "MongoDBStorage", method: "getLogging",
              message: `Error in reading the Logs: ${err.toString()}`,
              detailedMessages: err.stack });
            reject();
          } else {
            var loggings = [];

            loggingsMongoDB.forEach(function(loggingMongoDB) {
              var logging = {};
              // Set
              Utils.updateLoggingObject(loggingMongoDB, logging);

              // Set the model
              loggings.push(logging);
            });

            // Ok
            fulfill(loggings);
          }
        }).catch((err) => {
          // Log
          Logging.logError({
            source: "Central Server", module: "MongoDBStorage", method: "getLogging",
            message: `Error in reading the Logs: ${err.toString()}`,
            detailedMessages: err.stack });
          reject();
        });
      });
    }

    getConfiguration(chargeBoxIdentity, configDate) {
      // Get the Config
      return new Promise((fulfill, reject) => {
        if (!configDate) {
          configDate = new Date();
        }
        // Exec request
        MDBConfiguration.find({"chargeBoxIdentity": chargeBoxIdentity, timestamp: { $lte: configDate } })
            .sort({timestamp: -1}).limit(1)
            .exec((err, configurationMongoDB) => {
          var configuration = {};

          if (err) {
            // Log
            Logging.logError({
              source: chargeBoxIdentity, module: "MongoDBStorage", method: "getConfiguration",
              message: `Error in reading, from the Charge Box ${chargeBoxIdentity}, the Configuration list: ${err.toString()}`,
              detailedMessages: err.stack });
            reject();
          } else {
            if (configurationMongoDB[0]) {
              // Set values
              Utils.updateConfiguration(configurationMongoDB[0], configuration);
            }
            // Ok
            fulfill(configuration);
          }
        }).catch((err) => {
          // Log
          Logging.logError({
            source: chargeBoxIdentity, module: "MongoDBStorage", method: "getConfiguration",
            message: `Error in reading, from the Charge Box ${chargeBoxIdentity}, the Configuration list: ${err.toString()}`,
            detailedMessages: err.stack });
          reject();
        });
      });
    }

    getStatusNotifications(chargeBoxIdentity, connectorId) {
      // Get the Status Notification
      return new Promise((fulfill, reject) => {
        var filter = {};
        if (chargeBoxIdentity) {
          filter.chargeBoxIdentity = chargeBoxIdentity;
        }
        if (connectorId) {
          filter.connectorId = connectorId;
        }
        // Exec request
        MDBStatusNotification.find(filter)
            .sort({timestamp: 1}).exec((err, statusNotificationsMongoDB) => {
          var statusNotifications = [];

          if (err) {
            // Log
            Logging.logError({
              source: chargeBoxIdentity, module: "MongoDBStorage", method: "getStatusNotifications",
              message: `Error in getting, from the Charge Box ${chargeBoxIdentity} Connector ID ${connectorId}, the Status Notification: ${err.toString()}`,
              detailedMessages: err.stack });
            reject();
          } else {
            // Create
            statusNotificationsMongoDB.forEach((statusNotificationMongoDB) => {
              var statusNotification = {};
              // Set values
              Utils.updateStatusNotification(statusNotificationMongoDB, statusNotification);
              // Add
              statusNotifications.push(statusNotification);
            });
            // Ok
            fulfill(statusNotifications);
          }
        }).catch((err) => {
          // Log
          Logging.logError({
            source: chargeBoxIdentity, module: "MongoDBStorage", method: "getStatusNotifications",
            message: `Error in getting, from the Charge Box ${chargeBoxIdentity} Connector ID ${connectorId}, the Status Notification: ${err.toString()}`,
            detailedMessages: err.stack });
          reject();
        });
      });
    }

    getLastStatusNotification(chargeBoxIdentity, connectorId) {
      // Get the Status Notification
      return new Promise((fulfill, reject) => {
        var filter = {};
        var statusNotification = {};

        // Must be provided
        if(chargeBoxIdentity && connectorId) {
          filter.chargeBoxIdentity = chargeBoxIdentity;
          filter.connectorId = connectorId;

          // Exec request
          MDBStatusNotification.find(filter)
            .sort({timestamp: -1}).limit(1)
            .exec((err, statusNotificationsMongoDB) => {
              if (err) {
                // Log
                Logging.logError({
                  source: `${chargeBoxIdentity} - ${connectorId}`, module: "MongoDBStorage", method: "getLastStatusNotification",
                  message: `Error in getting, from the Charge Box ${chargeBoxIdentity} Connector ID ${connectorId}, the Last Status Notification: ${err.toString()}`,
                  detailedMessages: err.stack });
                reject();
              } else {
                // At least one
                if (statusNotificationsMongoDB[0]) {
                  // Set values
                  Utils.updateStatusNotification(statusNotificationsMongoDB[0], statusNotification);
                }
                // Ok
                fulfill(statusNotification);
              }
          }).catch((err) => {
            // Log
            Logging.logError({
              source: `${chargeBoxIdentity} - ${connectorId}`, module: "MongoDBStorage", method: "getLastStatusNotification",
              message: `Error in getting, from the Charge Box ${chargeBoxIdentity} Connector ID ${connectorId}, the Last Status Notification: ${err.toString()}`,
              detailedMessages: err.stack });
            reject();
          });
        } else {
          // Ok
          fulfill(statusNotification);
        }
      });
    }

    getMeterValues(chargeBoxIdentity, connectorId, transactionId, startDateTime, endDateTime) {
      // Get the Status Notification
      return new Promise((fulfill, reject) => {
        // Build filter
        var filter = {};
        // Mandatory filters
        filter.chargeBoxIdentity = chargeBoxIdentity;
        filter.connectorId = connectorId;

        if (transactionId) {
          filter.transactionId = transactionId;
        }
        if (startDateTime || endDateTime) {
          filter.timestamp = {};
        }
        if (startDateTime) {
          filter.timestamp["$gte"] = new Date(startDateTime);
        }
        if (endDateTime) {
          filter.timestamp["$lte"] = new Date(endDateTime);
        }

        // Exec request
        MDBMeterValue.find(filter).sort( {timestamp: 1} ).exec((err, meterValuesMongoDB) => {
          var meterValues = [];

          if (err) {
            // Log
            Logging.logError({
              source: `${chargeBoxIdentity} - ${connectorId}`, module: "MongoDBStorage", method: "getMeterValues",
              message: `Error in getting, from the Charge Box ${chargeBoxIdentity} Connector ID ${connectorId}, the Meter Values: ${err.toString()}`,
              detailedMessages: err.stack });
            reject();
          } else {
            // Create
            meterValuesMongoDB.forEach((meterValueMongoDB) => {
              var meterValue = {};
              // Set values
              Utils.updateMeterValue(meterValueMongoDB, meterValue);
              // Add
              meterValues.push(meterValue);
            });
            // Ok
            fulfill(meterValues);
          }
        }).catch((err) => {
          // Log
          Logging.logError({
            source: `${chargeBoxIdentity} - ${connectorId}`, module: "MongoDBStorage", method: "getMeterValues",
            message: `Error in getting, from the Charge Box ${chargeBoxIdentity} Connector ID ${connectorId}, the Meter Values: ${err.toString()}`,
            detailedMessages: err.stack });
          reject();
        });
      });
    }

    saveBootNotification(bootNotification) {
      // Save
      return new Promise((fulfill, reject) => {
        // Get
        this._getChargingStationMongoDB(bootNotification.chargeBoxIdentity).then((chargingStationMongoDB) => {
          // Create model
          var bootNotificationMongoDB = new MDBBootNotification(bootNotification);

          if (chargingStationMongoDB) {
            // Set the ID
            bootNotificationMongoDB.chargeBoxID = chargingStationMongoDB._id;
          }

          // Create new
          return bootNotificationMongoDB.save((err, results) => {
            if (err) {
              // Log
              Logging.logError({
                source: bootNotification.chargeBoxIdentity, module: "MongoDBStorage", method: "saveBootNotification",
                message: `Error when creating Boot Notification of ${bootNotification.chargeBoxIdentity}: ${err.toString()}`,
                detailedMessages: err.stack });
              reject();
            } else {
              // Log
              Logging.logInfo({
                source: bootNotification.chargeBoxIdentity, module: "MongoDBStorage", method: "saveBootNotification",
                message: `Boot Notification of ${bootNotification.chargeBoxIdentity} created with success`,
                detailedMessages: JSON.stringify(bootNotification) });
              fulfill();
            }
          });
        }).catch((err) => {
          // Log
          Logging.logError({
            source: bootNotification.chargeBoxIdentity, module: "MongoDBStorage", method: "saveBootNotification",
            message: `Error when creating Boot Notication of ${bootNotification.chargeBoxIdentity}: ${err.toString()}`,
            detailedMessages: err.stack });
          reject();
        });
      });
    }

    saveDataTransfer(dataTransfer) {
      // Save
      return new Promise((fulfill, reject) => {
        // Get
        this._getChargingStationMongoDB(dataTransfer.chargeBoxIdentity).then((chargingStationMongoDB) => {
          if (chargingStationMongoDB) {
            // Create model
            var dataTransferMongoDB = new MDBDataTransfer(dataTransfer);

            // Set the ID
            dataTransferMongoDB.chargeBoxID = chargingStationMongoDB._id;

            // Create new
            dataTransferMongoDB.save((err, results) => {
              if (err) {
                // Log
                Logging.logError({
                  source: dataTransfer.chargeBoxIdentity, module: "MongoDBStorage", method: "saveDataTransfer",
                  message: `Error when creating Data Transfer of ${dataTransfer.chargeBoxIdentity}: ${err.toString()}`,
                  detailedMessages: err.stack });
                reject();
              } else {
                // Log
                Logging.logInfo({
                  source: dataTransfer.chargeBoxIdentity, module: "MongoDBStorage", method: "saveDataTransfer",
                  message: `Data Transfer of ${dataTransfer.chargeBoxIdentity} created with success`,
                  detailedMessages: JSON.stringify(dataTransfer) });
                fulfill();
              }
            });
          } else {
            // Log
            Logging.logError({
              source: dataTransfer.chargeBoxIdentity, module: "MongoDBStorage", method: "saveDataTransfer",
              message: `Charging Station ${dataTransfer.chargeBoxIdentity} not found: Cannot add Data Transfer` });
            reject();
          }
        }).catch((err) => {
          // Log
          Logging.logError({
            source: dataTransfer.chargeBoxIdentity, module: "MongoDBStorage", method: "saveDataTransfer",
            message: `Error when creating Data Transfer of ${dataTransfer.chargeBoxIdentity}: ${err.toString()}`,
            detailedMessages: err.stack });
        });
      });
    }

    saveConfiguration(configuration) {
      // Save
      return new Promise((fulfill, reject) => {
        // Get
        this._getChargingStationMongoDB(configuration.chargeBoxIdentity).then((chargingStationMongoDB) => {
          // Found?
          if (chargingStationMongoDB) {
            // Create model
            var configurationMongoDB = new MDBConfiguration(configuration);

            // Set the ID
            configurationMongoDB.chargeBoxID = chargingStationMongoDB._id;
            configurationMongoDB.configuration = configuration.configurationKey;

            // Create new
            configurationMongoDB.save((err, results) => {
              if (err) {
                // Log
                Logging.logError({
                  source: configuration.chargeBoxIdentity, module: "MongoDBStorage", method: "saveConfiguration",
                  message: `Error when creating the Configuration of ${configurationMongoDB.chargeBoxIdentity}: ${err.toString()}`,
                  detailedMessages: err.stack });
                reject();
              } else {
                // Log
                Logging.logInfo({
                  source: configuration.chargeBoxIdentity, module: "MongoDBStorage", method: "saveConfiguration",
                  message: `Configuration of ${configurationMongoDB.chargeBoxIdentity} created with success`,
                  detailedMessages: JSON.stringify(configuration) });
                fulfill();
              }
            });
          } else {
            // Log
            Logging.logError({
              source: configuration.chargeBoxIdentity, module: "MongoDBStorage", method: "saveConfiguration",
              message: `Charging Station ${configurationMongoDB.chargeBoxIdentity} not found: Cannot save Configuration` });
            reject();
          }
        }).catch((err) => {
          // Log
          Logging.logError({
            source: configuration.chargeBoxIdentity, module: "MongoDBStorage", method: "saveConfiguration",
            message: `Error when creating the Configuration of ${configurationMongoDB.chargeBoxIdentity}: ${err.toString()}`,
            detailedMessages: err.stack });
          reject();
        });
      });
    }

    saveStatusNotification(statusNotification) {
      // Save
      return new Promise((fulfill, reject) => {
        // Get
        this._getChargingStationMongoDB(statusNotification.chargeBoxIdentity).then((chargingStationMongoDB) => {
          // Found?
          if (chargingStationMongoDB) {
            // Create model
            var statusNotificationMongoDB = new MDBStatusNotification(statusNotification);

            // Set the ID
            statusNotificationMongoDB.chargeBoxID = chargingStationMongoDB._id;

            // Create new
            statusNotificationMongoDB.save((err, results) => {
              if (err) {
                // Log
                Logging.logError({
                  source: statusNotification.chargeBoxIdentity, module: "MongoDBStorage", method: "saveStatusNotification",
                  message: `Error when creating Status Notification of ${statusNotification.chargeBoxIdentity}: ${err.toString()}`,
                  detailedMessages: err.stack });
                reject();
              } else {
                // Log
                Logging.logInfo({
                  source: statusNotification.chargeBoxIdentity, module: "MongoDBStorage", method: "saveStatusNotification",
                  message: `Status Notification of ${statusNotification.chargeBoxIdentity} created with success`,
                  detailedMessages: JSON.stringify(statusNotification) });
                fulfill();
              }
            });
          } else {
            // Log
            Logging.logError({
              source: statusNotification.chargeBoxIdentity, module: "MongoDBStorage", method: "saveStatusNotification",
              message: `Charging Station ${statusNotification.chargeBoxIdentity} not found: Cannot add Status Notification` });
            reject();
          }
        }).catch((err) => {
          // Log
          Logging.logError({
            source: statusNotification.chargeBoxIdentity, module: "MongoDBStorage", method: "saveStatusNotification",
            message: `Error when creating the Status Notification of ${statusNotification.chargeBoxIdentity}: ${err.toString()}`,
            detailedMessages: err.stack });
          reject();
        });
      });
    }

    saveDiagnosticsStatusNotification(diagnosticsStatusNotification) {
      // Save
      return new Promise((fulfill, reject) => {
        // Get
        this._getChargingStationMongoDB(diagnosticsStatusNotification.chargeBoxIdentity).then((chargingStationMongoDB) => {
          // Found?
          if (chargingStationMongoDB) {
            // Create model
            var diagnosticsStatusNotificationMongoDB = new MDBDiagnosticsStatusNotification(diagnosticsStatusNotification);

            // Set the ID
            diagnosticsStatusNotificationMongoDB.chargeBoxID = chargingStationMongoDB._id;

            // Create new
            diagnosticsStatusNotificationMongoDB.save((err, results) => {
              if (err) {
                // Log
                Logging.logError({
                  source: diagnosticsStatusNotification.chargeBoxIdentity, module: "MongoDBStorage", method: "saveDiagnosticsStatusNotification",
                  message: `Error when creating an Diagnostics Status Notification request of ${diagnosticsStatusNotification.chargeBoxIdentity}: ${err.toString()}`,
                  detailedMessages: err.stack });
                reject();
              } else {
                // Log
                Logging.logInfo({
                  source: diagnosticsStatusNotification.chargeBoxIdentity, module: "MongoDBStorage", method: "saveDiagnosticsStatusNotification",
                  message: `Diagnostics Status Notification request of ${diagnosticsStatusNotification.chargeBoxIdentity} created with success`,
                  detailedMessages: JSON.stringify(diagnosticsStatusNotification) });
                fulfill();
              }
            });
          } else {
            // Log
            Logging.logError({
              source: diagnosticsStatusNotification.chargeBoxIdentity, module: "MongoDBStorage", method: "saveDiagnosticsStatusNotification",
              message: `Charging Station ${diagnosticsStatusNotification.chargeBoxIdentity} not found: Cannot create Diagnostics Status Notification request` });
            reject();
          }
        }).catch((err) => {
          // Log
          Logging.logError({
            source: diagnosticsStatusNotification.chargeBoxIdentity, module: "MongoDBStorage", method: "saveDiagnosticsStatusNotification",
            message: `Error when creating an Diagnostics Status Notification request of ${diagnosticsStatusNotification.chargeBoxIdentity}: ${err.toString()}`,
            detailedMessages: err.stack });
          reject();
        });
      });
    }

    saveFirmwareStatusNotification(firmwareStatusNotification) {
      // Save
      return new Promise((fulfill, reject) => {
        // Get
        this._getChargingStationMongoDB(firmwareStatusNotification.chargeBoxIdentity).then((chargingStationMongoDB) => {
          // Found?
          if (chargingStationMongoDB) {
            // Create model
            var firmwareStatusNotificationMongoDB = new MDBFirmwareStatusNotification(firmwareStatusNotification);

            // Set the ID
            firmwareStatusNotificationMongoDB.chargeBoxID = chargingStationMongoDB._id;

            // Create new
            return firmwareStatusNotificationMongoDB.save((err, results) => {
              if (err) {
                // Log
                Logging.logError({
                  source: firmwareStatusNotification.chargeBoxIdentity, module: "MongoDBStorage", method: "saveFirmwareStatusNotification",
                  message: `Error when creating an Firmware Status Notification request of ${firmwareStatusNotification.chargeBoxIdentity}: ${err.toString()}`,
                  detailedMessages: err.stack });
                reject();
              } else {
                // Log
                Logging.logInfo({
                  source: firmwareStatusNotification.chargeBoxIdentity, module: "MongoDBStorage", method: "saveFirmwareStatusNotification",
                  message: `Firmware Status Notification request of ${firmwareStatusNotification.chargeBoxIdentity} created with success`,
                  detailedMessages: JSON.stringify(firmwareStatusNotification) });
                fulfill();
              }
            });
          } else {
            // Log
            Logging.logError({
              source: firmwareStatusNotification.chargeBoxIdentity, module: "MongoDBStorage", method: "saveFirmwareStatusNotification",
              message: `Charging Station ${firmwareStatusNotification.chargeBoxIdentity} not found: Cannot create Firmware Status Notification request` });
            reject();
          }
        }).catch((err) => {
          // Log
          Logging.logError({
            source: firmwareStatusNotification.chargeBoxIdentity, module: "MongoDBStorage", method: "saveFirmwareStatusNotification",
            message: `Error when creating an Firmware Status Notification request of ${firmwareStatusNotification.chargeBoxIdentity}: ${err.toString()}`,
            detailedMessages: err.stack });
          reject();
        });
      });
    }

    log(log) {
      // Check Array
      if (log.detailedMessages && !Array.isArray(log.detailedMessages)){
        log.detailedMessages = [log.detailedMessages];
      }

      // Create model
      var logMongoDB = new MDBLog(log);

      // Save
      return logMongoDB.save((err, results) => {
        if (err) {
          console.log(`MongoDB: Error when creating a Log: ${err.toString()}`);
        }
      });
    }

    saveAuthorize(authorize) {
      // Save
      return new Promise((fulfill, reject) => {
        // Get
        this._getChargingStationMongoDB(authorize.chargeBoxIdentity).then((chargingStationMongoDB) => {
          if (chargingStationMongoDB) {
            // Get User
            this._getUserByTagIdMongoDB(authorize.idTag).then((userMongoDB) => {
              // Found?
              if (userMongoDB) {
                // Create model
                var authorizeMongoDB = new MDBAuthorize(authorize);

                // Set the ID
                authorizeMongoDB.chargeBoxID = chargingStationMongoDB._id;

                // Create new
                return authorizeMongoDB.save((err, results) => {
                  if (err) {
                    // Log
                    Logging.logError({
                      source: `${authorize.chargeBoxIdentity} - ${authorize.idTag}`, module: "MongoDBStorage", method: "saveAuthorize",
                      message: `Error when creating an Authorize request of ${authorize.chargeBoxIdentity} for ID Tag ${authorize.idTag}: ${err.toString()}`,
                      detailedMessages: err.stack });
                    reject();
                  } else {
                    // Log
                    Logging.logInfo({
                      source: `${authorize.chargeBoxIdentity} - ${authorize.idTag}`, module: "MongoDBStorage", method: "saveAuthorize",
                      message: `Authorize request of ${authorize.chargeBoxIdentity} created with success for User ${userMongoDB.name} with ID Tad ${authorize.idTag}`,
                      detailedMessages: JSON.stringify(authorize) });
                    fulfill();
                  }
                });
              } else {
                // Log
                Logging.logError({
                  source: `${authorize.chargeBoxIdentity} - ${authorize.idTag}`, module: "MongoDBStorage", method: "saveAuthorize",
                  message: `User with Tag ID ${authorize.idTag} not found: Cannot create Authorize request` });
                reject();
              }
            });
          } else {
            // Log
            Logging.logError({
              source: `${authorize.chargeBoxIdentity} - ${authorize.idTag}`, module: "MongoDBStorage", method: "saveAuthorize",
              message: `Charging Station ${authorize.chargeBoxIdentity} not found: Cannot create Authorize request` });
            reject();
          }
        }).catch((err) => {
          // Log
          Logging.logError({
            source: `${authorize.chargeBoxIdentity} - ${authorize.idTag}`, module: "MongoDBStorage", method: "saveAuthorize",
            message: `Error when creating an Authorize request for ${authorize.chargeBoxIdentity}: ${err.toString()}`,
            detailedMessages: err.stack });
          reject();
        });
      });
    }

    saveStartTransaction(startTransaction) {
      // Save
      return new Promise((fulfill, reject) => {
        // Get
        this._getChargingStationMongoDB(startTransaction.chargeBoxIdentity).then((chargingStationMongoDB) => {
          // Found?
          if (chargingStationMongoDB) {
            // Get User
            this._getUserByTagIdMongoDB(startTransaction.idTag).then((userMongoDB) => {
              // Found?
              if (userMongoDB) {
                // Create model
                var startTransactionMongoDB = new MDBStartTransaction(startTransaction);

                // Set the IDs
                startTransactionMongoDB.chargeBoxID = chargingStationMongoDB._id;
                startTransactionMongoDB.userID = userMongoDB._id;

                // Create new
                startTransactionMongoDB.save((err, results) => {
                  if (err) {
                    // Log
                    Logging.logError({
                      source: `${startTransaction.chargeBoxIdentity} - ${startTransaction.idTag}`, module: "MongoDBStorage", method: "saveStartTransaction",
                      message: `Error when creating Start Transaction of ${startTransaction.chargeBoxIdentity}: ${err.toString()}`,
                      detailedMessages: err.stack });
                    reject();
                  } else {
                    // Log
                    Logging.logInfo({
                      source: `${startTransaction.chargeBoxIdentity} - ${startTransaction.idTag}`, module: "MongoDBStorage", method: "saveStartTransaction",
                      message: `Start Transaction of ${startTransaction.chargeBoxIdentity} created with success`,
                      detailedMessages: JSON.stringify(startTransaction) });
                    fulfill();
                  }
                });
              } else {
                // Log
                Logging.logError({
                  source: `${startTransaction.chargeBoxIdentity} - ${startTransaction.idTag}`, module: "MongoDBStorage", method: "saveStartTransaction",
                  message: `User with Tag ID ${startTransaction.idTag} not found: Cannot create Start Transaction` });
                reject();
              }
            });
          } else {
            // Log
            Logging.logError({
              source: `${startTransaction.chargeBoxIdentity} - ${startTransaction.idTag}`, module: "MongoDBStorage", method: "saveStartTransaction",
              message: `Charging Station ${startTransaction.chargeBoxIdentity} not found: Cannot create Start Transaction` });
            reject();
          }
        }).catch((err) => {
          // Log
          Logging.logError({
            source: `${startTransaction.chargeBoxIdentity} - ${startTransaction.idTag}`, module: "MongoDBStorage", method: "saveStartTransaction",
            message: `Error when creating Start Transaction of ${startTransaction.chargeBoxIdentity}: ${err.toString()}`,
            detailedMessages: err.stack });
          reject();
        });
      });
    }

    saveStopTransaction(stopTransaction) {
      // Save
      return new Promise((fulfill, reject) => {
        // Get
        this._getChargingStationMongoDB(stopTransaction.chargeBoxIdentity).then((chargingStationMongoDB) => {
          // Found?
          if (chargingStationMongoDB) {
            // Get User
            this._getUserByTagIdMongoDB(stopTransaction.idTag).then((userMongoDB) => {
              // Found?
              if (userMongoDB) {
                // Create model
                var stopTransactionMongoDB = new MDBStopTransaction(stopTransaction);

                // Set the ID
                stopTransactionMongoDB.chargeBoxID = chargingStationMongoDB._id;

                // Create new
                stopTransactionMongoDB.save((err, results) => {
                  if (err) {
                    // Log
                    Logging.logError({
                      source: `${stopTransaction.chargeBoxIdentity} - ${stopTransaction.idTag}`, module: "MongoDBStorage", method: "saveStopTransaction",
                      message: `Error when creating Stop Transaction of ${stopTransaction.chargeBoxIdentity}: ${err.toString()}`,
                      detailedMessages: err.stack });
                    reject();
                  } else {
                    // Log
                    Logging.logInfo({
                      source: `${stopTransaction.chargeBoxIdentity} - ${stopTransaction.idTag}`, module: "MongoDBStorage", method: "saveStartTransaction",
                      message: `Stop Transaction of ${stopTransaction.chargeBoxIdentity} created with success`,
                      detailedMessages: JSON.stringify(stopTransaction) });
                    fulfill();
                  }
                });
              } else {
                // Log
                Logging.logError({
                  source: `${stopTransaction.chargeBoxIdentity} - ${stopTransaction.idTag}`, module: "MongoDBStorage", method: "saveStartTransaction",
                  message: `User ${stopTransaction.idTag} not found: Cannot create Stop Transaction` });
                reject();
              }
            });
          } else {
            // Log
            Logging.logError({
              source: `${stopTransaction.chargeBoxIdentity} - ${stopTransaction.idTag}`, module: "MongoDBStorage", method: "saveStartTransaction",
              message: `Charging Station ${stopTransaction.chargeBoxIdentity} not found: Cannot create Stop Transaction` });
            reject();
          }
        }).catch((err) => {
          // Log
          Logging.logError({
            source: `${stopTransaction.chargeBoxIdentity} - ${stopTransaction.idTag}`, module: "MongoDBStorage", method: "saveStopTransaction",
            message: `Error when creating Stop Transaction of ${stopTransaction.chargeBoxIdentity}: ${err.toString()}`,
            detailedMessages: err.stack });
          reject();
        });
      });
    }

    saveMeterValues(meterValues) {
      // Save
      return new Promise((fulfillSave, rejectSave) => {
        // Get
        this._getChargingStationMongoDB(meterValues.chargeBoxIdentity).then((chargingStationMongoDB) => {
          // Found?
          if (chargingStationMongoDB) {
            var promises = [];

            // For each value
            meterValues.values.forEach((meterValue) => {
              // Create model
              var meterValueMongoDB = new MDBMeterValue(meterValue);

              // Set the ID
              meterValueMongoDB.chargeBoxID = chargingStationMongoDB._id;

              // Create new
              promises.push(
                // Create promise
                new Promise((fulfill, reject) => {
                  // Save
                  meterValueMongoDB.save((err, results) => {
                    if (err) {
                      // Log
                      Logging.logError({
                        source: meterValues.chargeBoxIdentity, module: "MongoDBStorage", method: "saveMeterValues",
                        message: `Error when saving Meter Value of ${meterValues.chargeBoxIdentity}: ${err.toString()}`,
                        detailedMessages: err.stack });
                      reject();
                    } else {
                      // Log
                      Logging.logInfo({
                        source: meterValues.chargeBoxIdentity, module: "MongoDBStorage", method: "saveMeterValues",
                        message: `Save Meter of ${stopTransaction.chargeBoxIdentity} created with success`,
                        detailedMessages: JSON.stringify(meterValue) });
                      fulfill();
                    }
                  });
                })
              );
            });

            // Wait for all promises
            Promise.all(promises).then(() => {
              // Nothing to do
              fulfillSave();
            }, then((err) => {
              // Log
              Logging.logError({
                source: meterValues.chargeBoxIdentity, module: "MongoDBStorage", method: "saveMeterValues",
                message: `Error in reading the Charging Station ${meterValues.chargeBoxIdentity}: ${err.toString()}`,
                detailedMessages: err.stack });
              // Err
              rejectSave();
            }));
          } else {
            // Log
            Logging.logError({
              source: meterValues.chargeBoxIdentity, module: "MongoDBStorage", method: "saveMeterValues",
              message: `Charging Station ${meterValues.chargeBoxIdentity} not found: Cannot add Meter Value`});
            rejectSave();
          }
        }).catch((err) => {
          // Log
          Logging.logError({
            source: meterValues.chargeBoxIdentity, module: "MongoDBStorage", method: "saveMeterValues",
            message: `Error when saving Meter Value of ${meterValues.chargeBoxIdentity}: ${err.toString()}`,
            detailedMessages: err.stack });
          rejectSave();
        });
      });
    }

    saveChargingStation(chargingStation) {
      // Save
      return new Promise((fulfill, reject) => {
        // Get
        this._getChargingStationMongoDB(chargingStation.getChargeBoxIdentity()).then((chargingStationMongoDB) => {
          // Found?
          if (!chargingStationMongoDB) {
            // No: Create it
            var newChargingStationMongoDB = new MDBChargingStation(chargingStation.getModel());

            // Create new
            newChargingStationMongoDB.save((err, results) => {
              if (err) {
                // Log
                Logging.logError({
                  source: chargingStation.getChargeBoxIdentity(), module: "MongoDBStorage", method: "saveChargingStation",
                  message: `Error when creating Charging Station ${chargingStation.getChargeBoxIdentity()}: ${err.toString()}`,
                  detailedMessages: err.stack });
                reject();
              } else {
                // Log
                Logging.logInfo({
                  source: chargingStation.getChargeBoxIdentity(), module: "MongoDBStorage", method: "saveChargingStation",
                  message: `Charging Station ${chargingStation.getChargeBoxIdentity()} created with success`,
                  detailedMessages: JSON.stringify(chargingStation) });
                fulfill();
              }
            });
          } else {
            // Set data
            Utils.updateChargingStationObject(chargingStation.getModel(), chargingStationMongoDB);

            // No: Update it
            chargingStationMongoDB.save((err, results) => {
              if (err) {
                // Log
                Logging.logError({
                  source: chargingStation.getChargeBoxIdentity(), module: "MongoDBStorage", method: "saveChargingStation",
                  message: `Error when updating Charging Station ${chargingStation.getChargeBoxIdentity()}: ${err.toString()}`,
                  detailedMessages: err.stack });
                reject();
              } else {
                // Log
                Logging.logInfo({
                  source: chargingStation.getChargeBoxIdentity(), module: "MongoDBStorage", method: "saveChargingStation",
                  message: `Charging Station ${chargingStation.getChargeBoxIdentity()} updated with success`,
                  detailedMessages: JSON.stringify(chargingStation)});
                fulfill();
              }
            });
          }
        }).catch((err) => {
          // Log
          Logging.logError({
            source: chargingStation.getChargeBoxIdentity(), module: "MongoDBStorage", method: "saveChargingStation",
            message: `Error when updating Charging Station ${chargingStation.getChargeBoxIdentity()}: ${err.toString()}`,
            detailedMessages: err.stack });
          reject();
        });
      });
    }

    getChargingStations() {
      // Get the Charging Stations
      return new Promise((fulfill, reject) => {
        // Exec request
        MDBChargingStation.find({}).sort( {chargeBoxIdentity: 1} ).exec((err, chargingStationsMongoDB) => {
          var chargingStations = [];

          if (err) {
            // Log
            Logging.logError({
              source: "Central Server", module: "MongoDBStorage", method: "getChargingStations",
              message: `Error when reading the Charging Stations: ${err.toString()}`,
              detailedMessages: err.stack });
            reject();
          } else {
            // Create
            chargingStationsMongoDB.forEach((chargingStationMongoDB) => {
              chargingStations.push(new ChargingStation(chargingStationMongoDB));
            });
            // Ok
            fulfill(chargingStations);
          }
        }).catch((err) => {
          // Log
          Logging.logError({
            source: "Central Server", module: "MongoDBStorage", method: "getChargingStations",
            message: `Error when reading the Charging Stations: ${err.toString()}`,
            detailedMessages: err.stack });
          reject();
        });
      });
    }

    getChargingStation(chargeBoxIdentity) {
      // Get
      return this._getChargingStationMongoDB(chargeBoxIdentity).then((chargingStationMongoDB) => {
        var chargingStation = null;

        // Found
        if (chargingStationMongoDB != null) {
          // Create
          chargingStation = new ChargingStation(chargingStationMongoDB);
        }

        return chargingStation;
      }).catch((err) => {
        // Log
        Logging.logError({
          source: chargeBoxIdentity, module: "MongoDBStorage", method: "getChargingStations",
          message: `Error in reading the Charging Station ${chargeBoxIdentity}: ${err.toString()}`,
          detailedMessages: err.stack });
        reject();
      });
    }

    _getChargingStationMongoDB(chargeBoxIdentity) {
      // Get the Charging Station
      return new Promise((fulfill, reject) => {
        // Exec request
        MDBChargingStation.find({"chargeBoxIdentity": chargeBoxIdentity}, (err, chargingStationsMongoDB) => {
          var chargingStationMongoDB = null;
          if (err) {
            // Log
            Logging.logError({
              source: chargeBoxIdentity, module: "MongoDBStorage", method: "_getChargingStationMongoDB",
              message: `Error in reading the Charging Station ${chargeBoxIdentity}: ${err.toString()}`,
              detailedMessages: err.stack });
            reject();
          } else {
            // Check
            if (chargingStationsMongoDB.length > 0) {
              chargingStationMongoDB = chargingStationsMongoDB[0];
            } else {
              // Log
              Logging.logWarning({
                source: chargeBoxIdentity, module: "MongoDBStorage", method: "_getChargingStationMongoDB",
                message: `Charging Station ${chargeBoxIdentity} does not exist` });
            }
            // Ok
            fulfill(chargingStationMongoDB);
          }
        }).catch((err) => {
          // Log
          Logging.logError({
            source: chargeBoxIdentity, module: "MongoDBStorage", method: "_getChargingStationMongoDB",
            message: `Error in reading the Charging Station ${chargeBoxIdentity}: ${err.toString()}`,
            detailedMessages: err.stack });
          reject();
        });
      });
    }

    getUsers() {
      // Get the Users
      return new Promise((fulfill, reject) => {
        // Exec request
        MDBUser.find({}).sort( {name: 1} ).exec((err, usersMongoDB) => {
          var users = [];

          if (err) {
            reject(err);
          } else {
            // Create
            usersMongoDB.forEach((userMongoDB) => {
              users.push(new User(userMongoDB));
            });
            // Ok
            fulfill(users);
          }
        }).catch((err) => {
          // Log
          Logging.logError({
            source: "Central Server", module: "MongoDBStorage", method: "getUsers",
            message: `Error in reading the Users: ${err.toString()}`,
            detailedMessages: err.stack });
          reject();
        });
      });
    }

    saveUser(user) {
      return new Promise((fulfill, reject) => {
        // Check
        if (!user.getTagID()) {
          // Log
          Logging.logError({
            source: `NoTagID - ${user.getName()}`, module: "MongoDBStorage", method: "saveUser",
            message: `Error in saving the User: User has no Tag ID and cannot be created or updated` });
          reject();
        } else {
          // Get
          this._getUserByTagIdMongoDB(user.getTagID()).then((userMongoDB) => {
            // Found?
            if (!userMongoDB) {
              // No: Create it
              var newUserMongoDB = new MDBUser(user.getModel());

              // Create new
              newUserMongoDB.save((err, results) => {
                if (err) {
                  // Log
                  Logging.logError({
                    source: `${user.getTagID()} - ${user.getName()}`, module: "MongoDBStorage", method: "saveUser",
                    message: `Error when creating User  ${user.getName()}: ${err.toString()}`,
                    detailedMessages: err.stack });
                  reject();
                } else {
                  // Log
                  Logging.logInfo({
                    source: `${user.getTagID()} - ${user.getName()}`, module: "MongoDBStorage", method: "saveUser",
                    message: `User ${user.getName()} created with success`,
                    detailedMessages: JSON.stringify(user) });
                  fulfill();
                }
              });
            } else {
              // Set data
              Utils.updateUser(user.getModel(), userMongoDB);

              // No: Update it
              userMongoDB.save((err, results) => {
                if (err) {
                  // Log
                  Logging.logError({
                    source: `${user.getTagID()} - ${user.getName()}`, module: "MongoDBStorage", method: "saveUser",
                    message: `Error when updating User ${user.getName()}: ${err.toString()}`,
                    detailedMessages: err.stack });
                  reject();
                } else {
                  // Log
                  Logging.logInfo({
                    source: `${user.getTagID()} - ${user.getName()}`, module: "MongoDBStorage", method: "saveUser",
                    message: `User ${user.getName()} updated with success`,
                    detailedMessages: JSON.stringify(user) });
                  fulfill();
                }
              });
            }
          }).catch((err) => {
            // Log
            Logging.logError({
              source: `${user.getTagID()} - ${user.getName()}`, module: "MongoDBStorage", method: "saveUser",
              message: `Error when creating User  ${user.getName()}: ${err.toString()}`,
              detailedMessages: err.stack });
            reject();
          });
        }
      });
    }

    getTransactions(chargeBoxIdentity, connectorId, startDateTime, endDateTime) {
      // // Get the Charging Station
      // return new Promise((fulfill, reject) => {
      //     // Build filter
      //     var filter = {};
      //     if (chargeBoxIdentity) {
      //       filter.chargeBoxIdentity = chargeBoxIdentity;
      //     }
      //     if (connectorId) {
      //       filter.connectorId = connectorId;
      //     }
      //     if (startDateTime || endDateTime) {
      //       filter.timestamp = {};
      //     }
      //     if (startDateTime) {
      //       filter.timestamp["$gte"] = new Date(startDateTime);
      //     }
      //     if (endDateTime) {
      //       filter.timestamp["$lte"] = new Date(endDateTime);
      //     }
      //
      //     // Get the Start Transaction
      //     MDBStartTransaction.find(filter).sort( {timestamp: -1} ).exec((err, transactionsMongoDB) => {
      //         var transactions = [];
      //
      //         if (err) {
      //             reject(err);
      //         } else {
      //             // Create
      //             transactionsMongoDB.forEach((transactionMongoDB) => {
      //               var transaction = {};
      //               // Set
      //               Utils.updateStartTransaction(transactionMongoDB, transaction);
      //               // Add
      //               transactions.push(transaction);
      //             });
      //             // Ok
      //             fulfill(transactions);
      //         }
      //     // Get the Users
      //   }).then((transactions) => {
      //       var userPromises = [];
      //
      //       // Get the user for each transaction
      //       for (var i = 0; i < transactions.length; i++) {
      //         // Call in a function to pass the index in the Promise
      //         ((transaction) => {
      //           // Get the user
      //           userPromises.push(
      //             // Get the user
      //             this.getUserByTagId(transaction.idTag).then((user) => {
      //               // Set
      //               if(user) {
      //                 // Set the User
      //                 transaction.user = user.getModel();
      //               }
      //               return transaction;
      //             })
      //           );
      //         })(transactions[i]);
      //       }
      //
      //       Promise.all(userPromises).then((transactions) => {
      //         fullfill(transactions);
      //       });
      //     });
      // });
    }

    getUserByTagId(tagID) {
      return new Promise((fulfill, reject) => {
        // Get
        this._getUserByTagIdMongoDB(tagID).then((userMongoDB) => {
          var user = null;

          // Found
          if (userMongoDB != null) {
            user = new User(userMongoDB);
          }

          fulfill(user);
        }).catch((err) => {
          // Log
          Logging.logError({
            source: tagID, module: "MongoDBStorage", method: "getUserByTagId",
            message: `Error in reading the User with Tag ID ${tagID}: ${err.toString()}`,
            detailedMessages: err.stack });
          reject();
        });
      });
    }

    _getUserByTagIdMongoDB(tagID) {
      // Get the Charging Station
      return new Promise((fulfill, reject) => {
        // Exec request
        MDBUser.find({"tagID": tagID}, (err, usersMongoDB) => {
          var userMongoDB = null;
          if (err) {
            // Log
            Logging.logError({
              source: tagID, module: "MongoDBStorage", method: "_getUserByTagIdMongoDB",
              message: `Error in getting the User with Tag ID ${tagID}: ${err.toString()}`,
              detailedMessages: err.stack });
            reject(err);
          } else {
            // Check
            if (usersMongoDB.length > 0) {
              userMongoDB = usersMongoDB[0];
            } else {
              Logging.logWarning({
                source: tagID, module: "MongoDBStorage", method: "getUserByTagId",
                message: `User with Tag ID ${tagID} does not exist!` });
              console.log();
            }
            // Ok
            fulfill(userMongoDB);
          }
        }).catch((err) => {
          // Log
          Logging.logError({
            source: tagID, module: "MongoDBStorage", method: "_getUserByTagIdMongoDB",
            message: `Error in getting the User with Tag ID ${tagID}: ${err.toString()}`,
            detailedMessages: err.stack });
          reject();
        });
      });
    }
}

module.exports = MongoDBStorage;
