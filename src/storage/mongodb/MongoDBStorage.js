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
var Database = require('../../utils/Database');
var Storage = require('../Storage');
var Logging = require('../../utils/Logging');
var crypto = require('crypto');
var moment = require('moment');

let _dbConfig;
let _centralRestServer;

class MongoDBStorage extends Storage {
  // Create database access
  constructor(dbConfig) {
    super(dbConfig);
    // Keep local
    _dbConfig = dbConfig;
    // Override Promise
    mongoose.Promise = global.Promise;
  }

  start() {
    return new Promise((fulfill, reject) => {
      // Connect
      mongoose.connect(`mongodb://${_dbConfig.host}:${_dbConfig.port}/${_dbConfig.schema}`,
          {"user": _dbConfig.user, "pass": _dbConfig.password}, (err) => {
        if (err) {
          console.log(`MongoDB: Error when connecting: ${err.toString()}`);
          reject(err);
        } else {
          // Log
          Logging.logInfo({
            userFullName: "System", source: "Central Server", module: "MongoDBStorage", method: "start", action: "Startup",
            message: `Connected to MongoDB (Database) on '${_dbConfig.host}:${_dbConfig.port}' and using schema '${_dbConfig.schema}'` });
            console.log(`Connected to MongoDB (Database) on '${_dbConfig.host}:${_dbConfig.port}' and using schema '${_dbConfig.schema}'`);
          // Ok
          fulfill();
        }
      });
    });
  }

  setCentralRestServer(centralRestServer) {
    // Set
    _centralRestServer = centralRestServer;
  }

  getConfigurationParamValue(chargeBoxIdentity, paramName) {
    // Get the config
    return this.getConfiguration(chargeBoxIdentity).then((configuration) => {
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

  getLogs(dateFrom, searchValue, numberOfLogs) {
    // Not provided?
    if (!numberOfLogs || isNaN(numberOfLogs)) {
      // Default
      numberOfLogs = 50;
    }
    // Limit Exceeded?
    if(numberOfLogs > 500) {
      numberOfLogs = 500;
    }
    if (typeof numberOfLogs == "string" ) {
      numberOfLogs = parseInt(numberOfLogs);
    }

    // Set the filters
    let filter = {};
    // Date from provided?
    if (dateFrom) {
      // Yes, add in filter
      filter.timestamp = {};
      filter.timestamp.$gte = new Date(dateFrom);
    }
    // Source?
    if (searchValue) {
      // Build filter
      filter["$or"] = [
        { "source" : { $regex : `.*${searchValue}.*` } },
        { "message" : { $regex : `.*${searchValue}.*` } },
        { "action" : { $regex : `.*${searchValue}.*` } },
        { "userFullName" : { $regex : `.*${searchValue}.*` } }
        // { "module" : { $regex : `.*${searchValue}.*` } },
        // { "method" : { $regex : `.*${searchValue}.*` } },
      ];
    }
    // Exec request
    return MDBLog.find(filter).sort({timestamp: 1}).limit(numberOfLogs).exec().then((loggingsMongoDB) => {
      var loggings = [];
      loggingsMongoDB.forEach(function(loggingMongoDB) {
        var logging = {};
        // Set
        Database.updateLoggingObject(loggingMongoDB, logging);
        // Set the model
        loggings.push(logging);
      });
      // Ok
      return loggings;
    });
  }

  getConfiguration(chargeBoxIdentity) {
    // Exec request
    return MDBConfiguration.findById({"_id": chargeBoxIdentity }).then((configurationMongoDB) => {
      var configuration = null;
      if (configurationMongoDB) {
        // Set values
        configuration = {};
        Database.updateConfiguration(configurationMongoDB, configuration);
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
        Database.updateStatusNotification(statusNotificationMongoDB, statusNotification);
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
        Database.updateStatusNotification(statusNotificationsMongoDB[0], statusNotification);
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
        Database.updateMeterValue(meterValueMongoDB, meterValue);
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
        Database.updateMeterValue(meterValueMongoDB, meterValue);
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
    return bootNotificationMongoDB.save().then(() => {
      // Notify
      _centralRestServer.notifyChargingStationUpdated({"id" : bootNotification.chargeBoxIdentity});
    })
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
    return dataTransferMongoDB.save().then(() => {
      // Notify
      _centralRestServer.notifyChargingStationUpdated({"id" : dataTransfer.chargeBoxIdentity});
    });
  }

  saveConfiguration(configuration) {
    // Create model
    var configurationMongoDB = {};
    // Set the ID
    configurationMongoDB._id = configuration.chargeBoxIdentity;
    configurationMongoDB.chargeBoxID = configuration.chargeBoxIdentity;
    configurationMongoDB.configuration = configuration.configurationKey;
    configurationMongoDB.timestamp = configuration.timestamp;

    // Get
    return MDBConfiguration.findOneAndUpdate(
      {"_id": configuration.chargeBoxIdentity},
      configurationMongoDB,
      {new: true, upsert: true}).then((chargingStationMongoDB) => {
        // Notify
        _centralRestServer.notifyChargingStationUpdated({"id" : configuration.chargeBoxIdentity});
        // Return
        return chargingStationMongoDB;
    });
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
    return statusNotificationMongoDB.save().then(() => {
      // Notify
      _centralRestServer.notifyChargingStationUpdated({"id" : statusNotification.chargeBoxIdentity});
    });
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
    return diagnosticsStatusNotificationMongoDB.save(() => {
      // Notify
      _centralRestServer.notifyChargingStationUpdated({"id" : diagnosticsStatusNotification.chargeBoxIdentity});
    });
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
    return firmwareStatusNotificationMongoDB.save().then(() => {
      // Notify
      _centralRestServer.notifyChargingStationUpdated({"id" : firmwareStatusNotification.chargeBoxIdentity});
    });
  }

  saveLog(log) {
    // Create model
    var logMongoDB = new MDBLog(log);

    // Save
    return logMongoDB.save().then(() => {
      // Notify Change
      _centralRestServer.notifyLoggingCreated();
    });
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
    return authorizeMongoDB.save().then(() => {
      // Notify
      _centralRestServer.notifyChargingStationUpdated({"id" : authorize.chargeBoxIdentity});
    });
  }

  saveStartTransaction(startTransaction) {
    // Already created?
    if (!startTransaction.id) {
      // No: Set a new ID
      startTransaction.id = crypto.createHash('md5')
        .update(`${startTransaction.chargeBoxIdentity}~${startTransaction.connectorId}~${startTransaction.timestamp}`)
        .digest("hex");
      startTransaction.userID = startTransaction.user.getID();
      startTransaction.tagID = startTransaction.idTag;
      startTransaction.chargeBoxID = startTransaction.chargeBoxIdentity;
    }

    // Get
    return MDBStartTransaction.findOneAndUpdate({"_id": startTransaction.id}, startTransaction, {
        new: true,
        upsert: true
      }).then((startTransactionMongoDB) => {
        // Notify
        _centralRestServer.notifyChargingStationUpdated({"id" : startTransaction.chargeBoxIdentity});
      });
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
    return stopTransactionMongoDB.save().then(() => {
      // Notify
      _centralRestServer.notifyChargingStationUpdated({"id" : stopTransaction.chargeBoxIdentity});
    });
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
      return meterValueMongoDB.save().then(() => {
        // Notify
        _centralRestServer.notifyChargingStationUpdated({"id" : meterValues.chargeBoxIdentity});
      });
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
        Database.updateStartTransaction(startTransactionMongoDB, transaction.start);
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
            Database.updateStopTransaction(stopTransactionMongoDB, transaction.stop);
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
        Database.updateStartTransaction(startTransactionMongoDB, transaction.start);
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
            Database.updateStopTransaction(stopTransactionMongoDB, transaction.stop);
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
      {new: true, upsert: true}).then((chargingStationMongoDB) => {
        // Notify Change
        (!chargingStation.getID()?_centralRestServer.notifyChargingStationCreated(chargingStationMongoDB):_centralRestServer.notifyChargingStationUpdated(chargingStationMongoDB));
    });
  }

  deleteChargingStation(id) {
    return MDBChargingStation.remove({ "_id" : id }).then((charingStationMongoDB) => {
      // Notify Change
      _centralRestServer.notifyChargingStationDeleted({"id": id});
    });
  }

  getChargingStations(searchValue, numberOfUser) {
    if (!numberOfUser || isNaN(numberOfUser)) {
      numberOfUser = 100;
    }
    // Set the filters
    let filters = {};
    // Source?
    if (searchValue) {
      // Build filter
      filters["$or"] = [
        { "chargeBoxIdentity" : { $regex : `.*${searchValue}.*` } }
      ];
    }
    // Exec request
    return MDBChargingStation.find(filters).sort( {_id: 1} ).exec().then((chargingStationsMongoDB) => {
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

  getUsers(searchValue, numberOfUser) {
    if (!numberOfUser || isNaN(numberOfUser)) {
      numberOfUser = 100;
    }
    // Set the filters
    let filters = {};
    // Source?
    if (searchValue) {
      // Build filter
      filters["$or"] = [
        { "name" : { $regex : `.*${searchValue}.*` } },
        { "firstName" : { $regex : `.*${searchValue}.*` } },
        { "email" : { $regex : `.*${searchValue}.*` } },
        { "role" : { $regex : `.*${searchValue}.*` } }
      ];
    }
    // Exec request
    return MDBTag.find({}).exec().then((tagsMongoDB) => {
      // Exec request
      return MDBUser.find(filters).sort( {status: -1, name: 1, firstName: 1} ).limit(numberOfUser).exec().then((usersMongoDB) => {
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
          // Notify Change
          (!user.getID()?_centralRestServer.notifyUserCreated(userMongoDB):_centralRestServer.notifyUserUpdated(userMongoDB));
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
                  // Created with success
                });                // Add TagIds
            });
          });
        });
    }
  }

  getUser(id) {
    // Check
    if (!this._checkIfMongoDBIDIsValid(id)) {
      // Return empty user
      return Promise.resolve();
    }

    // Exec request
    return MDBUser.findById(id).exec().then((userMongoDB) => {
      return this._createUser(userMongoDB);
    });
  }

  getUserByEmailPassword(email, password) {
    // Exec request
    return MDBUser.findOne({"email": email, "password": password}).then((userMongoDB) => {
      return this._createUser(userMongoDB);
    });
  }

  getUserByEmail(email) {
    // Exec request
    return MDBUser.findOne({"email": email}).then((userMongoDB) => {
      return this._createUser(userMongoDB);
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

  _createUser(userMongoDB) {
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
    return MDBUser.remove({ "_id" : id }).then((userMongoDB) => {
      // Notify Change
      _centralRestServer.notifyUserDeleted({"id": id});
    });
  }

  _checkIfMongoDBIDIsValid(id) {
      // Check ID
    if (/^[0-9a-fA-F]{24}$/.test(id)) {
      // Valid
      return true;
    }
    return false;
  }
}

module.exports = MongoDBStorage;
