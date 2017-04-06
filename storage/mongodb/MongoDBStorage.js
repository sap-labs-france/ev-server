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
      // Log
      Logging.logInfo({
        source: "Central Server", module: "MongoDBStorage", method: "constructor",
        message: `Connected to MongoDB on '${dbConfig.host}:${dbConfig.port}' and using schema '${dbConfig.schema}'` });
      console.log(`Connected to MongoDB on '${dbConfig.host}:${dbConfig.port}' and using schema '${dbConfig.schema}'`);
    });
  }

  getConfigurationParamValue(chargeBoxIdentity, paramName, configDate) {
    // Get the config
    return this.getConfiguration(chargeBoxIdentity, configDate).then((configuration) => {
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
      return value;
    });
  }

  getLogs(numberOfLogging) {
    if (!numberOfLogging || isNaN(numberOfLogging)) {
      numberOfLogging = 100;
    }
    // Exec request
    return MDBLog.find({}).sort({timestamp: -1}).limit(numberOfLogging).exec().then((loggingsMongoDB) => {
      var loggings = [];
      loggingsMongoDB.forEach(function(loggingMongoDB) {
        var logging = {};
        // Set
        Utils.updateLoggingObject(loggingMongoDB, logging);
        // Set the model
        loggings.push(logging);
      });
      // Ok
      return loggings;
    });
  }

  getConfiguration(chargeBoxIdentity, configDate) {
    if (!configDate) {
      configDate = new Date();
    }
    // Exec request
    return MDBConfiguration.find({"chargeBoxIdentity": chargeBoxIdentity, timestamp: { $lte: configDate } })
        .sort({timestamp: -1}).limit(1).exec().then((configurationMongoDB) => {
      var configuration = {};
      if (configurationMongoDB[0]) {
        // Set values
        Utils.updateConfiguration(configurationMongoDB[0], configuration);
      }
      // Ok
      return configuration;
    });
  }

  getStatusNotifications(chargeBoxIdentity, connectorId) {
    var filter = {};
    if (chargeBoxIdentity) {
      filter.chargeBoxIdentity = chargeBoxIdentity;
    }
    if (connectorId) {
      filter.connectorId = connectorId;
    }
    // Exec request
    return MDBStatusNotification.find(filter).sort({timestamp: 1}).exec().then((statusNotificationsMongoDB) => {
      var statusNotifications = [];
      // Create
      statusNotificationsMongoDB.forEach((statusNotificationMongoDB) => {
        var statusNotification = {};
        // Set values
        Utils.updateStatusNotification(statusNotificationMongoDB, statusNotification);
        // Add
        statusNotifications.push(statusNotification);
      });
      // Ok
      return statusNotifications;
    });
  }

  getLastStatusNotification(chargeBoxIdentity, connectorId) {
    // Get the Status Notification
    var filter = {};
    var statusNotification = {};

    // Must be provided
    if(chargeBoxIdentity && connectorId) {
      filter.chargeBoxIdentity = chargeBoxIdentity;
      filter.connectorId = connectorId;

      // Exec request
      return MDBStatusNotification.find(filter).sort({timestamp: -1}).limit(1).exec().then((statusNotificationsMongoDB) => {
        // At least one
        if (statusNotificationsMongoDB[0]) {
          // Set values
          Utils.updateStatusNotification(statusNotificationsMongoDB[0], statusNotification);
        }
        // Ok
        return statusNotification;
      });
    } else {
      // Ok
      return statusNotification;
    }
  }

  getMeterValues(chargeBoxIdentity, connectorId, transactionId, startDateTime, endDateTime) {
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
    return MDBMeterValue.find(filter).sort( {timestamp: 1} ).exec().then((meterValuesMongoDB) => {
      var meterValues = [];
      // Create
      meterValuesMongoDB.forEach((meterValueMongoDB) => {
        var meterValue = {};
        // Set values
        Utils.updateMeterValue(meterValueMongoDB, meterValue);
        // Add
        meterValues.push(meterValue);
      });
      // Ok
      return meterValues;
    });
  }

  saveBootNotification(bootNotification) {
    // Get
    return this._getChargingStationMongoDB(bootNotification.chargeBoxIdentity, "BootNotification").then((chargingStationMongoDB) => {
      // Create model
      var bootNotificationMongoDB = new MDBBootNotification(bootNotification);
      if (chargingStationMongoDB) {
        // Set the ID
        bootNotificationMongoDB.chargeBoxID = chargingStationMongoDB._id;
      }
      // Create new
      return bootNotificationMongoDB.save();
    });
  }

  saveDataTransfer(dataTransfer) {
    // Get
    return this._getChargingStationMongoDB(dataTransfer.chargeBoxIdentity, "DataTransfer").then((chargingStationMongoDB) => {
      if (chargingStationMongoDB) {
        // Create model
        var dataTransferMongoDB = new MDBDataTransfer(dataTransfer);
        // Set the ID
        dataTransferMongoDB.chargeBoxID = chargingStationMongoDB._id;
        // Create new
        return dataTransferMongoDB.save();
      }
    });
  }

  saveConfiguration(configuration) {
    // Get
    return this._getChargingStationMongoDB(configuration.chargeBoxIdentity, "Configuration").then((chargingStationMongoDB) => {
      // Found?
      if (chargingStationMongoDB) {
        // Create model
        var configurationMongoDB = new MDBConfiguration(configuration);
        // Set the ID
        configurationMongoDB.chargeBoxID = chargingStationMongoDB._id;
        configurationMongoDB.configuration = configuration.configurationKey;
        // Create new
        return configurationMongoDB.save();
      }
    });
  }

  saveStatusNotification(statusNotification) {
    // Get
    return this._getChargingStationMongoDB(statusNotification.chargeBoxIdentity, "StatusNotification").then((chargingStationMongoDB) => {
      // Found?
      if (chargingStationMongoDB) {
        // Create model
        var statusNotificationMongoDB = new MDBStatusNotification(statusNotification);
        // Set the ID
        statusNotificationMongoDB.chargeBoxID = chargingStationMongoDB._id;
        // Create new
        return statusNotificationMongoDB.save();
      }
    });
  }

  saveDiagnosticsStatusNotification(diagnosticsStatusNotification) {
    // Get
    return this._getChargingStationMongoDB(diagnosticsStatusNotification.chargeBoxIdentity, "DiagnosticsStatusNotification").then((chargingStationMongoDB) => {
      // Found?
      if (chargingStationMongoDB) {
        // Create model
        var diagnosticsStatusNotificationMongoDB = new MDBDiagnosticsStatusNotification(diagnosticsStatusNotification);
        // Set the ID
        diagnosticsStatusNotificationMongoDB.chargeBoxID = chargingStationMongoDB._id;
        // Create new
        return diagnosticsStatusNotificationMongoDB.save();
      }
    });
  }

  saveFirmwareStatusNotification(firmwareStatusNotification) {
    // Get
    return this._getChargingStationMongoDB(firmwareStatusNotification.chargeBoxIdentity, "FirmwareStatusNotification").then((chargingStationMongoDB) => {
      // Found?
      if (chargingStationMongoDB) {
        // Create model
        var firmwareStatusNotificationMongoDB = new MDBFirmwareStatusNotification(firmwareStatusNotification);
        // Set the ID
        firmwareStatusNotificationMongoDB.chargeBoxID = chargingStationMongoDB._id;
        // Create new
        return firmwareStatusNotificationMongoDB.save();
      }
    });
  }

  saveLog(log) {
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
    // Create model
    var authorizeMongoDB = new MDBAuthorize(authorize);
    // Create new
    return authorizeMongoDB.save();
  }

  saveStartTransaction(startTransaction) {
    // Get
    return this._getChargingStationMongoDB(startTransaction.chargeBoxIdentity, "StartTransaction").then((chargingStationMongoDB) => {
      // Found?
      if (chargingStationMongoDB) {
        // Get User
        return this._getUserByTagIdMongoDB(startTransaction.idTag, "StartTransaction").then((userMongoDB) => {
          // Found?
          if (userMongoDB) {
            // Create model
            var startTransactionMongoDB = new MDBStartTransaction(startTransaction);
            // Set the IDs
            startTransactionMongoDB.chargeBoxID = chargingStationMongoDB._id;
            startTransactionMongoDB.userID = userMongoDB._id;
            // Create new
            return startTransactionMongoDB.save();
          }
        });
      }
    });
  }

  saveStopTransaction(stopTransaction) {
    // Get
    return this._getChargingStationMongoDB(stopTransaction.chargeBoxIdentity, "StopTransaction").then((chargingStationMongoDB) => {
      // Found?
      if (chargingStationMongoDB) {
        // Get User
        return this._getUserByTagIdMongoDB(stopTransaction.idTag, "StopTransaction").then((userMongoDB) => {
          // Found?
          if (userMongoDB) {
            // Create model
            var stopTransactionMongoDB = new MDBStopTransaction(stopTransaction);
            // Set the ID
            stopTransactionMongoDB.chargeBoxID = chargingStationMongoDB._id;
            // Create new
            return stopTransactionMongoDB.save();
          }
        });
      }
    });
  }

  saveMeterValues(meterValues) {
    // Get
    return this._getChargingStationMongoDB(meterValues.chargeBoxIdentity, "MeterValues").then((chargingStationMongoDB) => {
      // Found?
      if (chargingStationMongoDB) {
        // Save all
        Promise.all(meterValues.values.map(meterValue => {
          // Create
          return new Promise((resolve, reject) => {
            // Create model
            var meterValueMongoDB = new MDBMeterValue(meterValue);
            // Set the ID
            meterValueMongoDB.chargeBoxID = chargingStationMongoDB._id;
            // Save
            return meterValueMongoDB.save();
          });
        }));
      }
    });
  }

  saveChargingStation(chargingStation) {
    // Get
    return this._getChargingStationMongoDB(chargingStation.getChargeBoxIdentity()).then((chargingStationMongoDB) => {
      // Found?
      if (!chargingStationMongoDB) {
        // No: Create it
        var newChargingStationMongoDB = new MDBChargingStation(chargingStation.getModel());
        // Create new
        return newChargingStationMongoDB.save();
      } else {
        // Set data
        Utils.updateChargingStationObject(chargingStation.getModel(), chargingStationMongoDB);
        // No: Update it
        return chargingStationMongoDB.save();
      }
    });
  }

  getChargingStations() {
    // Exec request
    return MDBChargingStation.find({}).sort( {chargeBoxIdentity: 1} ).exec().then((chargingStationsMongoDB) => {
      var chargingStations = [];
      // Create
      chargingStationsMongoDB.forEach((chargingStationMongoDB) => {
        chargingStations.push(new ChargingStation(chargingStationMongoDB));
      });
      // Ok
      return chargingStations;
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
    });
  }

  _getChargingStationMongoDB(chargeBoxIdentity) {
    // Exec request
    return MDBChargingStation.find({"chargeBoxIdentity": chargeBoxIdentity}).then(chargingStationsMongoDB => {
      var chargingStationMongoDB = null;
      // Check
      if (chargingStationsMongoDB.length > 0) {
        chargingStationMongoDB = chargingStationsMongoDB[0];
      }
      // Ok
      return chargingStationMongoDB;
    });
  }

  getUsers() {
    // Exec request
    return MDBUser.find({}).sort( {name: 1} ).exec().then((usersMongoDB) => {
      var users = [];
      // Create
      usersMongoDB.forEach((userMongoDB) => {
        users.push(new User(userMongoDB));
      });
      // Ok
      return users;
    });
  }

  saveUser(user) {
    // Check
    if (!user.getTagID()) {
      return Promise.reject( new Error("Error in saving the User: User has no Tag ID and cannot be created or updated") );
    } else {
      // Get User
      return this._getUserByTagIdMongoDB(user.getTagID()).then((userMongoDB) => {
        // Found?
        if (!userMongoDB) {
          // No: Create it
          var newUserMongoDB = new MDBUser(user.getModel());
          // Create new
          return newUserMongoDB.save();
        } else {
          // Set data
          Utils.updateUser(user.getModel(), userMongoDB);

          // No: Update it
          return userMongoDB.save();
        }
      });
    }
  }

  getTransactions(chargeBoxIdentity, connectorId, startDateTime, endDateTime) {
    // // Get the Charging Station
    // return new Promise((resolve, reject) => {
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
    //             resolve(transactions);
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
    // Get
    return this._getUserByTagIdMongoDB(tagID).then((userMongoDB) => {
      var user = null;
      // Found
      if (userMongoDB != null) {
        user = new User(userMongoDB);
      }
      return user;
    });
  }

  _getUserByTagIdMongoDB(tagID) {
    // Exec request
    return MDBUser.find({"tagID": tagID}).then((usersMongoDB) => {
      var userMongoDB = null;
      // Check
      if (usersMongoDB.length > 0) {
        userMongoDB = usersMongoDB[0];
      }
      // Ok
      return userMongoDB;
    });
  }
}

module.exports = MongoDBStorage;
