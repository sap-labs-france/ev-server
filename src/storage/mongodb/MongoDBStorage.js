var mongoose = require('mongoose');
var MDBConfiguration = require('./model/MDBConfiguration');
var MDBUser = require('./model/MDBUser');
var MDBTag = require('./model/MDBTag');
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
var crypto = require('crypto');
var moment = require('moment');

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
    return MDBConfiguration.find({"chargeBoxID": chargeBoxIdentity, timestamp: { $lte: configDate } })
        .sort({timestamp: -1}).limit(1).exec().then((configurationMongoDB) => {
      var configuration = null;
      if (configurationMongoDB && configurationMongoDB[0]) {
        // Set values
        configuration = {};
        Utils.updateConfiguration(configurationMongoDB[0], configuration);
      }
      // Ok
      return configuration;
    });
  }

  getStatusNotifications(chargeBoxIdentity, connectorId) {
    var filter = {};
    if (chargeBoxIdentity) {
      filter.chargeBoxID = chargeBoxIdentity;
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
    filter.chargeBoxID = chargeBoxIdentity;
    filter.connectorId = connectorId;
    // Exec request
    return MDBStatusNotification.find(filter).sort({timestamp: -1}).limit(1).exec().then((statusNotificationsMongoDB) => {
      var statusNotification = null;
      // At least one
      if (statusNotificationsMongoDB[0]) {
        statusNotification = {};
        // Set values
        Utils.updateStatusNotification(statusNotificationsMongoDB[0], statusNotification);
      }
      // Ok
      return statusNotification;
    });
  }

  getMeterValues(chargeBoxIdentity, connectorId, startDateTime, endDateTime) {
    // Build filter
    var filter = {};
    // Mandatory filters
    filter.chargeBoxID = chargeBoxIdentity;
    filter.connectorId = connectorId;
    if (startDateTime || endDateTime) {
      filter.timestamp = {};
    }
    if (startDateTime) {
      filter.timestamp.$gte = new Date(startDateTime);
    }
    if (endDateTime) {
      filter.timestamp.$lte = new Date(endDateTime);
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

  getLastMeterValuesFromTransaction(chargeBoxIdentity, connectorId, transactionId, limit) {
    // Build filter
    var filter = {};
    // Mandatory filters
    filter.chargeBoxID = chargeBoxIdentity;
    filter.connectorId = connectorId;
    filter.transactionId = transactionId;
    if (!limit) {
      limit = 0; // Get them all
    }

    // Exec request
    return MDBMeterValue.find(filter).sort( {timestamp: -1} ).limit(limit).exec().then((meterValuesMongoDB) => {
      var meterValues = [];
      // Create
      meterValuesMongoDB.forEach((meterValueMongoDB) => {
        var meterValue = {};
        // Set values
        Utils.updateMeterValue(meterValueMongoDB, meterValue);
        // Add
        meterValues.push(meterValue);
      });
      // Resort them back
      meterValues.sort((val1, val2) => {
        var date1 = moment(val1.timestamp);
        var date2 = moment(val2.timestamp);
        // Check
        if (date1.isBefore(date2)) {
          return -1;
        } else if (date1.isAfter(date2)) {
          return 1;
        } else {
          return 0;
        }
      });
      // Ok
      return meterValues;
    });
  }

  saveBootNotification(bootNotification) {
    // Create model
    var bootNotificationMongoDB = new MDBBootNotification(bootNotification);
    // Set the ID
    bootNotificationMongoDB._id = crypto.createHash('md5')
      .update(`${bootNotification.chargeBoxIdentity}~${bootNotification.timestamp}`)
      .digest("hex");
    bootNotificationMongoDB.chargeBoxID = bootNotification.chargeBoxIdentity;
    // Create new
    return bootNotificationMongoDB.save();
  }

  saveDataTransfer(dataTransfer) {
    // Create model
    var dataTransferMongoDB = new MDBDataTransfer(dataTransfer);
    // Set the ID
    dataTransferMongoDB._id = crypto.createHash('md5')
      .update(`${dataTransfer.chargeBoxIdentity}~${dataTransfer.data}~${dataTransfer.timestamp}`)
      .digest("hex");
    // Set the ID
    dataTransferMongoDB.chargeBoxID = dataTransfer.chargeBoxIdentity;
    // Create new
    return dataTransferMongoDB.save();
  }

  saveConfiguration(configuration) {
    // Create model
    var configurationMongoDB = new MDBConfiguration(configuration);
    // Set the ID
    configurationMongoDB._id = crypto.createHash('md5')
      .update(`${configuration.chargeBoxIdentity}~${configuration.timestamp}`)
      .digest("hex");
    configurationMongoDB.chargeBoxID = configuration.chargeBoxIdentity;
    configurationMongoDB.configuration = configuration.configurationKey;
    // Create new
    return configurationMongoDB.save();
  }

  saveStatusNotification(statusNotification) {
    // Create model
    var statusNotificationMongoDB = new MDBStatusNotification(statusNotification);
    // Set the ID
    statusNotificationMongoDB._id = crypto.createHash('md5')
      .update(`${statusNotification.chargeBoxIdentity}~${statusNotification.connectorId}~${statusNotification.status}~${statusNotification.timestamp}`)
      .digest("hex");
    statusNotificationMongoDB.chargeBoxID = statusNotification.chargeBoxIdentity;
    // Create new
    return statusNotificationMongoDB.save();
  }

  saveDiagnosticsStatusNotification(diagnosticsStatusNotification) {
    // Create model
    var diagnosticsStatusNotificationMongoDB = new MDBDiagnosticsStatusNotification(diagnosticsStatusNotification);
    // Set the ID
    diagnosticsStatusNotificationMongoDB._id = crypto.createHash('md5')
      .update(`${diagnosticsStatusNotification.chargeBoxIdentity}~${diagnosticsStatusNotification.timestamp.toISOString()}`)
      .digest("hex");
    diagnosticsStatusNotificationMongoDB.chargeBoxID = diagnosticsStatusNotification.chargeBoxIdentity;
    // Create new
    return diagnosticsStatusNotificationMongoDB.save();
  }

  saveFirmwareStatusNotification(firmwareStatusNotification) {
    // Create model
    var firmwareStatusNotificationMongoDB = new MDBFirmwareStatusNotification(firmwareStatusNotification);
    // Set the ID
    firmwareStatusNotificationMongoDB._id = crypto.createHash('md5')
      .update(`${firmwareStatusNotification.chargeBoxIdentity}~${firmwareStatusNotification.timestamp.toISOString()}`)
      .digest("hex");
    // Set the ID
    firmwareStatusNotificationMongoDB.chargeBoxID = firmwareStatusNotification.chargeBoxIdentity;
    // Create new
    return firmwareStatusNotificationMongoDB.save();
  }

  saveLog(log) {
    // Create model
    var logMongoDB = new MDBLog(log);

    // Save
    return logMongoDB.save();
  }

  saveAuthorize(authorize) {
    // Create model
    var authorizeMongoDB = new MDBAuthorize(authorize);
    // Set the ID
    authorizeMongoDB._id = crypto.createHash('md5')
      .update(`${authorize.chargeBoxIdentity}~${authorize.timestamp.toISOString()}`)
      .digest("hex");
    authorizeMongoDB.userID = authorize.user.getID();
    authorizeMongoDB.chargeBoxID = authorize.chargeBoxIdentity;
    authorizeMongoDB.tagID = authorize.idTag;
    // Create new
    return authorizeMongoDB.save();
  }

  saveStartTransaction(startTransaction) {
    // Create model
    var startTransactionMongoDB = new MDBStartTransaction(startTransaction);
    // Set the ID
    startTransactionMongoDB._id = crypto.createHash('md5')
      .update(`${startTransaction.chargeBoxIdentity}~${startTransaction.connectorId}~${startTransaction.timestamp}`)
      .digest("hex");
    startTransactionMongoDB.userID = startTransaction.user.getID();
    startTransactionMongoDB.tagID = startTransaction.idTag;
    startTransactionMongoDB.chargeBoxID = startTransaction.chargeBoxIdentity;
    // Create new
    return startTransactionMongoDB.save();
  }

  saveStopTransaction(stopTransaction) {
    // Create model
    var stopTransactionMongoDB = new MDBStopTransaction(stopTransaction);
    // Set the ID
    stopTransactionMongoDB._id = crypto.createHash('md5')
      .update(`${stopTransaction.chargeBoxIdentity}~${stopTransaction.connectorId}~${stopTransaction.timestamp}`)
      .digest("hex");
    // Set the ID
    stopTransactionMongoDB.chargeBoxID = stopTransaction.chargeBoxIdentity;
    if(stopTransaction.idTag) {
      stopTransactionMongoDB.tagID = stopTransaction.idTag;
    }
    if(stopTransaction.idTag) {
      stopTransactionMongoDB.userID = stopTransaction.user.getID();
    }
    // Create new
    return stopTransactionMongoDB.save();
  }

  saveMeterValues(meterValues) {
    // Save all
    return Promise.all(meterValues.values.map(meterValue => {
      // Create model
      var meterValueMongoDB = new MDBMeterValue(meterValue);
      // Set the ID
      var attribute = JSON.stringify(meterValue.attribute);
      meterValueMongoDB._id = crypto.createHash('md5')
        .update(`${meterValue.chargeBoxIdentity}~${meterValue.connectorId}~${meterValue.timestamp}~${meterValue.value}~${attribute}`)
        .digest("hex");
      meterValueMongoDB.chargeBoxID = meterValues.chargeBoxIdentity;
      // Save
      return meterValueMongoDB.save();
    }));
  }

  getTransactions(chargeBoxIdentity, connectorId, startDateTime, endDateTime) {
    // Build filter
    var filter = {};
    if (chargeBoxIdentity) {
      filter.chargeBoxID = chargeBoxIdentity;
    }
    if (connectorId) {
      filter.connectorId = parseInt(connectorId);
    }
    if (startDateTime || endDateTime) {
      filter.timestamp = {};
    }
    if (startDateTime) {
      filter.timestamp.$gte = new Date(startDateTime);
    }
    if (endDateTime) {
      filter.timestamp.$lte = new Date(endDateTime);
    }

    // Get the Start Transaction
    return MDBStartTransaction.find(filter).populate("userID").sort( {timestamp: -1} ).exec().then((startTransactionsMongoDB) => {
      var transactions = [];
      // Create
      startTransactionsMongoDB.forEach((startTransactionMongoDB) => {
        // Set
        var transaction = {};
        transaction.start = {};
        Utils.updateStartTransaction(startTransactionMongoDB, transaction.start);
        // Add
        transactions.push(transaction);
      });
      // Ok
      return transactions;
      // Get the Stop Transaction
    }).then((transactions) => {
      // Wait
      return Promise.all(transactions.map(transaction => {
        // Get stop transaction
        return MDBStopTransaction.findOne({"transactionId" : transaction.start.transactionId}).populate("userID").exec().then((stopTransactionMongoDB) => {
          // Found?
          if (stopTransactionMongoDB) {
            // Set
            transaction.stop = {};
            Utils.updateStopTransaction(stopTransactionMongoDB, transaction.stop);
          }
          // Ok
          return transaction;
        });
      }));
    });
  }

  getLastTransaction(chargeBoxIdentity, connectorId) {
    // Build filter
    var filter = {};
    if (chargeBoxIdentity) {
      filter.chargeBoxID = chargeBoxIdentity;
    }
    if (connectorId) {
      filter.connectorId = parseInt(connectorId);
    }

    // Get the Start Transaction
    return MDBStartTransaction.findOne(filter).populate("userID").sort( {timestamp: -1} ).exec().then((startTransactionMongoDB) => {
      var transaction = null;
      if (startTransactionMongoDB) {
        // Set
        transaction = {};
        transaction.start = {};
        Utils.updateStartTransaction(startTransactionMongoDB, transaction.start);
      }
      // Ok
      return transaction;
      // Get the Stop Transaction
    }).then((transaction) => {
      // Found?
      if (transaction) {
        // Get stop transaction
        return MDBStopTransaction.findOne({"transactionId" : transaction.start.transactionId}).then((stopTransactionMongoDB) => {
          // Found?
          if (stopTransactionMongoDB) {
            // Set
            transaction.stop = {};
            Utils.updateStopTransaction(stopTransactionMongoDB, transaction.stop);
          }
          // Ok
          return transaction;
        });
      } else {
        // Ok
        return transaction;
      }
    });
  }

  saveChargingStation(chargingStation) {
    // Get
    return MDBChargingStation.findOneAndUpdate(
      {"_id": chargingStation.getChargeBoxIdentity()},
      chargingStation.getModel(),
      {new: true, upsert: true});
  }

  getChargingStations() {
    // Exec request
    return MDBChargingStation.find({}).sort( {_id: 1} ).exec().then((chargingStationsMongoDB) => {
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
    // Exec request
    return MDBChargingStation.findById({"_id": chargeBoxIdentity}).then(chargingStationMongoDB => {
      var chargingStation = null;
      // Found
      if (chargingStationMongoDB) {
        // Create
        chargingStation = new ChargingStation(chargingStationMongoDB);
      }
      return chargingStation;
    });
  }

  getUsers() {
    // Exec request
    return MDBTag.find({}).exec().then((tagsMongoDB) => {
      // Exec request
      return MDBUser.find({}).sort( {status: -1, name: 1, firstName: 1} ).exec().then((usersMongoDB) => {
        var users = [];
        // Create
        usersMongoDB.forEach((userMongoDB) => {
          // Create
          var user = new User(userMongoDB);
          // Get TagIDs
          var tags = tagsMongoDB.filter((tag) => {
            // Find a match
            return tag.userID.equals(userMongoDB._id);
          }).map((tag) => {
            return tag._id;
          });
          // Set
          user.setTagIDs(tags);
          // Add
          users.push(user);
        });
        // Ok
        return users;
      });
    });
  }

  saveUser(user) {
    // Check if ID or email is provided
    if (!user.getID() && !user.getEMail()) {
      // ID ,ust be provided!
      return Promise.reject( new Error("Error in saving the User: User has no ID or Email and cannot be created or updated") );
    } else {
      var userFilter = {};
      // Build Request
      if (user.getID()) {
        userFilter._id = user.getID();
      } else {
        userFilter.email = user.getEMail();
      }
      // Get
      return MDBUser.findOneAndUpdate(userFilter, user.getModel(), {
          new: true,
          upsert: true
        }).then((userMongoDB) => {
          // Update the badges
          // First delete them
          return MDBTag.remove({ "userID" : userMongoDB._id }).then(() => {
            // Add tags
            user.getTagIDs().forEach((tag) => {
              // Update/Insert Tag
              return MDBTag.findOneAndUpdate({
                  "_id": tag
                },{
                  "_id": tag,
                  "userID": userMongoDB._id
                },{
                  new: true,
                  upsert: true
                }).then((newTag) => {
                  // Create with success
                });                // Add TagIds
            });
          });
        });
    }
  }

  getUser(id) {
    // Check
    if (!this.checkIfMongoDBIDIsValid(id)) {
      // Return empty user
      return Promise.resolve();
    }

    // Exec request
    return MDBUser.findById(id).exec().then((userMongoDB) => {
      return this.createUser(userMongoDB);
    });
  }

  getUserByEmailPassword(email, password) {
    // Exec request
    return MDBUser.findOne({"email": email, "password": password}).then((userMongoDB) => {
      return this.createUser(userMongoDB);
    });
  }

  getUserByEmail(email) {
    // Exec request
    return MDBUser.findOne({"email": email}).then((userMongoDB) => {
      return this.createUser(userMongoDB);
    });
  }

  getUserByTagId(tagID) {
    // Exec request
    return MDBTag.findById(tagID).populate("userID").exec().then((tagMongoDB) => {
      var user = null;
      // Check
      if (tagMongoDB && tagMongoDB.userID) {
        user = new User(tagMongoDB.userID);
      }
      // Ok
      return user;
    });
  }

  createUser(userMongoDB) {
    var user = null;
    // Check
    if (userMongoDB) {
      // Create
      user = new User(userMongoDB);
      // Get the Tags
      return MDBTag.find({"userID": userMongoDB.id}).exec().then((tagsMongoDB) => {
        // Check
        if (tagsMongoDB) {
          // Get the Tags
          var tags = tagsMongoDB.map((tagMongoDB) => { return tagMongoDB.id; });
          // Get IDs`
          user.setTagIDs(tags);
        }
        return user;
      });
    } else {
      // Ok
      return user;
    }
  }

  deleteUser(id) {
    return MDBUser.remove({ "_id" : id });
  }

  checkIfMongoDBIDIsValid(id) {
      // Check ID
    if (/^[0-9a-fA-F]{24}$/.test(id)) {
      // Valid
      return true;
    }
    return false;
  }
}

module.exports = MongoDBStorage;
