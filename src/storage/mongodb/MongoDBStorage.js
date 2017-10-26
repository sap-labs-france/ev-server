const mongoose = require('mongoose');
const MDBConfiguration = require('./model/MDBConfiguration');
const MDBUser = require('./model/MDBUser');
const MDBTag = require('./model/MDBTag');
const MDBLog = require('./model/MDBLog');
const MDBFirmwareStatusNotification = require('./model/MDBFirmwareStatusNotification');
const MDBDiagnosticsStatusNotification = require('./model/MDBDiagnosticsStatusNotification');
const MDBChargingStation = require('./model/MDBChargingStation');
const MDBMigration = require('./model/MDBMigration');
const MDBAuthorize = require('./model/MDBAuthorize');
const MDBBootNotification = require('./model/MDBBootNotification');
const MDBStatusNotification = require('./model/MDBStatusNotification');
const MDBMeterValue = require('./model/MDBMeterValue');
const MDBTransaction = require('./model/MDBTransaction');
const MDBNotification = require('./model/MDBNotification');
const MDBPricing = require('./model/MDBPricing');
const MDBDataTransfer = require('./model/MDBDataTransfer');
const User = require('../../model/User');
const ChargingStation = require('../../model/ChargingStation');
const Utils = require('../../utils/Utils');
const Database = require('../../utils/Database');
const Storage = require('../Storage');
const Logging = require('../../utils/Logging');
const crypto = require('crypto');
const moment = require('moment');
const ObjectId = mongoose.Types.ObjectId;

require('source-map-support').install();

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
      mongoose.connect(`mongodb://${_dbConfig.user}:${_dbConfig.password}@${_dbConfig.host}:${_dbConfig.port}/${_dbConfig.schema}`,
          {"useMongoClient": true}, (err) => {
        if (err) {
          reject(err);
        } else {
          // Log
          Logging.logInfo({
            userFullName: "System", source: "Central Server", module: "MongoDBStorage", method: "start", action: "Startup",
            message: `Connected to MongoDB (Database) on '${_dbConfig.host}:${_dbConfig.port}' and using schema '${_dbConfig.schema}'` });
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

  getLogs(dateFrom, level, chargingStation, searchValue, numberOfLogs, sortDate) {
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
    // Log level
    switch (level) {
      // Error
      case "E":
        // Build filter
        filter.level = 'E';
        break;
      // Warning
      case "W":
        filter.level = { $in : ['E','W'] };
        break;
      // Info
      case "I":
        filter.level = { $in : ['E','W','I'] };
        break;
      // Debug
      case "D":
        // No filter
        break;
    }
    // Charging Station
    if (chargingStation) {
      // Yes, add in filter
      filter.source = chargingStation;
    }
    // Source?
    if (searchValue) {
      // Build filter
      filter.$or = [
        { "message" : { $regex : `.*${searchValue}.*` } },
        { "action" : { $regex : `.*${searchValue}.*` } },
        { "userFullName" : { $regex : `.*${searchValue}.*` } }
      ];
    }
    // Set the sort
    let sort = {};
    // Set timestamp
    if (sortDate) {
      sort.timestamp = sortDate;
    } else {
      // default
      sort.timestamp = -1;
    }
    // Exec request
    return MDBLog.find(filter).sort(sort).limit(numberOfLogs).exec().then((loggingsMDB) => {
      var loggings = [];
      loggingsMDB.forEach(function(loggingMDB) {
        var logging = {};
        // Set
        Database.updateLoggingObject(loggingMDB, logging);
        // Set the model
        loggings.push(logging);
      });
      // Ok
      return loggings;
    });
  }

  saveLog(log) {
    // Create model
    var logMDB = new MDBLog(log);
    // Save
    return logMDB.save().then(() => {
      // Available?
      if (_centralRestServer) {
        // Notify Change
        _centralRestServer.notifyLoggingCreated();
      }
    });
  }

  deleteLogs(deleteUpToDate) {
    // Build filter
    var filter = {};
    // Date provided
    if (deleteUpToDate) {
      filter.timestamp = {};
      filter.timestamp.$lte = new Date(deleteUpToDate);
    }
    return MDBLog.remove(filter).then((result) => {
      // Notify Change
      _centralRestServer.notifyLoggingDeleted();
      // Return the result
      return result.result;
    });
  }

  getConfiguration(chargeBoxIdentity) {
    // Exec request
    return MDBConfiguration.findById({"_id": chargeBoxIdentity }).then((configurationMDB) => {
      var configuration = null;
      if (configurationMDB) {
        // Set values
        configuration = {};
        Database.updateConfiguration(configurationMDB, configuration);
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
    return MDBStatusNotification.find(filter).sort({timestamp: 1}).exec().then((statusNotificationsMDB) => {
      var statusNotifications = [];
      // Create
      statusNotificationsMDB.forEach((statusNotificationMDB) => {
        var statusNotification = {};
        // Set values
        Database.updateStatusNotification(statusNotificationMDB, statusNotification);
        // Add
        statusNotifications.push(statusNotification);
      });
      // Ok
      return statusNotifications;
    });
  }

  getPricing() {
    // Exec request
    return MDBPricing.findOne({}).then((pricingMDB) => {
      var pricing;
      if (pricingMDB) {
        // Set
        pricing = {};
        Database.updatePricing(pricingMDB, pricing);
      }
      // Ok
      return pricing;
    });
  }

  savePricing(pricing) {
    // Get
    return MDBPricing.findOneAndUpdate({}, pricing, {
        new: true,
        upsert: true
      }).then((pricingMDB) => {
        return pricingMDB;
      });
  }

  getLastStatusNotification(chargeBoxIdentity, connectorId) {
    // Get the Status Notification
    var filter = {};
    filter.chargeBoxID = chargeBoxIdentity;
    filter.connectorId = connectorId;
    // Exec request
    return MDBStatusNotification.find(filter).sort({timestamp: -1}).limit(1).exec().then((statusNotificationsMDB) => {
      var statusNotification = null;
      // At least one
      if (statusNotificationsMDB[0]) {
        statusNotification = {};
        // Set values
        Database.updateStatusNotification(statusNotificationsMDB[0], statusNotification);
      }
      // Ok
      return statusNotification;
    });
  }

  getMeterValuesFromTransaction(transactionId) {
    // Build filter
    var filter = {};
    // Mandatory filters
    filter.transactionId = transactionId;

    // Exec request
    return MDBMeterValue.find(filter).sort( {timestamp: 1, value: -1} ).exec().then((meterValuesMDB) => {
      var meterValues = [];
      // Create
      meterValuesMDB.forEach((meterValueMDB) => {
        var meterValue = {};
        // Set values
        Database.updateMeterValue(meterValueMDB, meterValue);
        // Add
        meterValues.push(meterValue);
      });
      // Ok
      return meterValues;
    });
  }

  saveBootNotification(bootNotification) {
    // Create model
    var bootNotificationMDB = new MDBBootNotification(bootNotification);
    // Set the ID
    bootNotificationMDB._id = crypto.createHash('sha256')
      .update(`${bootNotification.chargeBoxID}~${bootNotification.timestamp}`)
      .digest("hex");
    // Create new
    return bootNotificationMDB.save().then(() => {
      // Notify
      _centralRestServer.notifyChargingStationUpdated({"id" : bootNotification.chargeBoxID});
    });
  }

  saveNotification(notification) {
    // Create model
    var notificationMDB = new MDBNotification(notification);
    // Set the ID
    notificationMDB._id = crypto.createHash('sha256')
      .update(`${notification.sourceId}~${notification.channel}`)
      .digest("hex");
    // Create new
    return notificationMDB.save().then(() => {
      // Nothing
    });
  }

  getNotifications(sourceId) {
    // Exec request
    return MDBNotification.find({"sourceId": sourceId}).exec().then((notificationsMDB) => {
      var notifications = [];
      // Create
      notificationsMDB.forEach((notificationMDB) => {
        var notification = {};
        // Set values
        Database.updateNotification(notificationMDB, notification);
        // Add
        notifications.push(notification);
      });
      // Ok
      return notifications;
    });
  }

  saveDataTransfer(dataTransfer) {
    // Create model
    var dataTransferMDB = new MDBDataTransfer(dataTransfer);
    // Set the ID
    dataTransferMDB._id = crypto.createHash('sha256')
      .update(`${dataTransfer.chargeBoxID}~${dataTransfer.data}~${dataTransfer.timestamp}`)
      .digest("hex");
    // Create new
    return dataTransferMDB.save().then(() => {
      // Notify
      _centralRestServer.notifyChargingStationUpdated({"id" : dataTransfer.chargeBoxID});
    });
  }

  saveConfiguration(configuration) {
    // Create model
    var configurationMDB = {};
    // Set the ID
    configurationMDB._id = configuration.chargeBoxID;
    configurationMDB.configuration = configuration.configurationKey;
    configurationMDB.timestamp = configuration.timestamp;

    // Get
    return MDBConfiguration.findOneAndUpdate(
      {"_id": configuration.chargeBoxID},
      configurationMDB,
      {new: true, upsert: true}).then((chargingStationMDB) => {
        // Notify
        _centralRestServer.notifyChargingStationUpdated({"id" : configuration.chargeBoxID});
        // Return
        return chargingStationMDB;
    });
  }

  saveStatusNotification(statusNotification) {
    // Create model
    var statusNotificationMDB = new MDBStatusNotification(statusNotification);
    // Set the ID
    statusNotificationMDB._id = crypto.createHash('sha256')
      .update(`${statusNotification.chargeBoxID}~${statusNotification.connectorId}~${statusNotification.status}~${statusNotification.timestamp}`)
      .digest("hex");
    // Create new
    return statusNotificationMDB.save().then(() => {
      // Notify
      _centralRestServer.notifyChargingStationUpdated({"id" : statusNotification.chargeBoxID});
    });
  }

  saveDiagnosticsStatusNotification(diagnosticsStatusNotification) {
    // Create model
    var diagnosticsstatusNotificationMDB = new MDBDiagnosticsStatusNotification(diagnosticsStatusNotification);
    // Set the ID
    diagnosticsstatusNotificationMDB._id = crypto.createHash('sha256')
      .update(`${diagnosticsStatusNotification.chargeBoxID}~${diagnosticsStatusNotification.timestamp.toISOString()}`)
      .digest("hex");
    // Create new
    return diagnosticsstatusNotificationMDB.save(() => {
      // Notify
      _centralRestServer.notifyChargingStationUpdated({"id" : diagnosticsStatusNotification.chargeBoxID});
    });
  }

  saveFirmwareStatusNotification(firmwareStatusNotification) {
    // Create model
    var firmwarestatusNotificationMDB = new MDBFirmwareStatusNotification(firmwareStatusNotification);
    // Set the ID
    firmwarestatusNotificationMDB._id = crypto.createHash('sha256')
      .update(`${firmwareStatusNotification.chargeBoxID}~${firmwareStatusNotification.timestamp.toISOString()}`)
      .digest("hex");
    // Create new
    return firmwarestatusNotificationMDB.save().then(() => {
      // Notify
      _centralRestServer.notifyChargingStationUpdated({"id" : firmwareStatusNotification.chargeBoxID});
    });
  }

  saveAuthorize(authorize) {
    // Create model
    var authorizeMDB = new MDBAuthorize(authorize);
    // Set the ID
    authorizeMDB._id = crypto.createHash('sha256')
      .update(`${authorize.chargeBoxID}~${authorize.timestamp.toISOString()}`)
      .digest("hex");
    authorizeMDB.userID = authorize.user.getID();
    authorizeMDB.tagID = authorize.idTag;
    // Create new
    return authorizeMDB.save().then(() => {
      // Notify
      _centralRestServer.notifyChargingStationUpdated({"id" : authorize.chargeBoxID});
    });
  }

  saveStartTransaction(startTransaction) {
    // Already created?
    if (!startTransaction.id) {
      // No: Set a new ID
      startTransaction.id = startTransaction.transactionId;
      startTransaction.userID = startTransaction.user.getID();
      startTransaction.tagID = startTransaction.idTag;
    }

    // Get
    return MDBTransaction.findOneAndUpdate({"_id": startTransaction.id}, startTransaction, {
        new: true,
        upsert: true
      }).then((startTransactionMDB) => {
        // Notify
        _centralRestServer.notifyChargingStationUpdated({"id" : startTransaction.chargeBoxID});
      });
  }

  saveStopTransaction(stopTransaction) {
    // Get the Start Transaction
    return MDBTransaction.findById({"_id": stopTransaction.transactionId}).then((transactionMDB) => {
      // Create model
      transactionMDB.stop = stopTransaction;
      // Set the User data
      if(stopTransaction.idTag) {
        transactionMDB.stop.tagID = stopTransaction.idTag;
        transactionMDB.stop.userID = stopTransaction.user.getID();
      }
      // Create new
      return transactionMDB.save().then(() => {
        // Notify
        _centralRestServer.notifyChargingStationUpdated({"id" : stopTransaction.chargeBoxID});
      });
    });
  }

  getMigrations() {
    // Exec request
    return MDBMigration.find({}).exec().then((migrationsMDB) => {
      var migrations = [];
      // Create
      migrationsMDB.forEach((migrationMDB) => {
        var migration = {};
        // Set values
        Database.updateMigration(migrationMDB, migration);
        // Add
        migrations.push(migration);
      });
      // Ok
      return migrations;
    });
  }

  saveMigration(migration) {
    // Create model
    var migrationMDB = new MDBMigration(migration);
    // Set the ID
    migrationMDB._id = migration.name + "~" + migration.version;
    // Create new
    return migrationMDB.save();
  }

  saveMeterValues(meterValues) {
    // Save all
    return Promise.all(meterValues.values.map(meterValue => {
      // Create model
      var meterValueMDB = new MDBMeterValue(meterValue);
      // Set the ID
      var attribute = JSON.stringify(meterValue.attribute);
      meterValueMDB._id = crypto.createHash('sha256')
        .update(`${meterValue.chargeBoxID}~${meterValue.connectorId}~${meterValue.timestamp}~${meterValue.value}~${attribute}`)
        .digest("hex");
      // Save
      return meterValueMDB.save().then(() => {
        // Notify
        _centralRestServer.notifyChargingStationUpdated({"id" : meterValues.chargeBoxID});
      });
    }));
  }

  getTransactions(searchValue, filter, withPicture=false) {
    // Build filter
    var $match = {};
    // User
    if (filter.userId) {
      $match.userID = new ObjectId(filter.userId);
    }
    // Charge Box
    if (filter.chargeBoxIdentity) {
      $match.chargeBoxID = filter.chargeBoxIdentity;
    }
    // Connector
    if (filter.connectorId) {
      $match.connectorId = parseInt(filter.connectorId);
    }
    // Date provided?
    if (filter.startDateTime || filter.endDateTime) {
      $match.timestamp = {};
    }
    // Start date
    if (filter.startDateTime) {
      $match.timestamp.$gte = new Date(filter.startDateTime);
    }
    // End date
    if (filter.endDateTime) {
      $match.timestamp.$lte = new Date(filter.endDateTime);
    }
    // Check stop tr
    if (filter.stop) {
      $match.stop = filter.stop;
    }
    // Yes: Get only active ones
    return MDBTransaction.find($match).populate("userID", (withPicture?{}:{image:0}))
        .populate("chargeBoxID").populate("stop.userID")
        .sort({timestamp:-1}).exec().then(transactionsMDB => {
      // Set
      var transactions = [];
      // Filter
      transactionsMDB = this._filterTransactions(transactionsMDB, searchValue);
      // Create
      transactionsMDB.forEach((transactionMDB) => {
        // Set
        var transaction = {};
        Database.updateTransaction(transactionMDB, transaction);
        // Add
        transactions.push(transaction);
      });
      return transactions;
    });
  }

  _filterTransactions(transactionsMDB, searchValue) {
    let regexp = new RegExp(searchValue);
    // Check User and ChargeBox
    return transactionsMDB.filter((transactionMDB) => {
      // User not found?
      if (!transactionMDB.userID) {
        Logging.logError({
          userFullName: "System", source: "Central Server", module: "MongoDBStorage", method: "getTransactions",
          message: `Transaction ID '${transactionMDB.id}': User does not exist` });
        return false;
      }
      // Charge Box not found?
      if (!transactionMDB.chargeBoxID) {
        Logging.logError({
          userFullName: "System", source: "Central Server", module: "MongoDBStorage", method: "getTransactions",
          message: `Transaction ID '${transactionMDB.id}': Charging Station does not exist` });
        return false;
      }
      // Filter?
      if (searchValue) {
        // Yes
        return regexp.test(transactionMDB.chargeBoxID.id.toString()) ||
          regexp.test(transactionMDB.userID.name.toString()) ||
          regexp.test(transactionMDB.userID.firstName.toString());
      }
      // Default ok
      return true;
    });
  }

  getTransaction(transactionId) {
    // Get the Start Transaction
    return MDBTransaction.findById({"_id": transactionId}).populate("userID").populate("chargeBoxID")
        .populate("stop.userID").exec().then((transactionMDB) => {
      // Set
      var transaction = null;
      // Found?
      if (transactionMDB) {
        // Set data
        transaction = {};
        Database.updateTransaction(transactionMDB, transaction);
      }
      // Ok
      return transaction;
    });
  }

  saveChargingStation(chargingStation) {
    // Get
    return MDBChargingStation.findOneAndUpdate(
      {"_id": chargingStation.chargeBoxIdentity},
      chargingStation,
      {new: true, upsert: true}).then((chargingStationMDB) => {
        var newChargingStation = new ChargingStation(chargingStationMDB);
        // Notify Change
        if (!chargingStation.id) {
          _centralRestServer.notifyChargingStationCreated(newChargingStation.getModel());
        } else {
          _centralRestServer.notifyChargingStationUpdated(newChargingStation.getModel());
        }
        return newChargingStation;
    });
  }

  deleteChargingStation(id) {
    return MDBChargingStation.remove({ "_id" : id }).then((result) => {
      // Notify Change
      _centralRestServer.notifyChargingStationDeleted({"id": id});
      // Return the result
      return result.result;
    });
  }

  deleteUser(id) {
    return MDBUser.remove({ "_id" : id }).then((result) => {
      // Notify Change
      _centralRestServer.notifyUserDeleted({"id": id});
      // Return the result
      return result.result;
    });
  }

  getChargingStations(searchValue) {
    // Set the filters
    let filters = {};
    // Source?
    if (searchValue) {
      // Build filter
      filters.$or = [
        { "_id" : { $regex : `.*${searchValue}.*` } }
      ];
    }
    // Exec request
    return MDBChargingStation.find(filters).sort( {_id: 1} ).exec().then((chargingStationsMDB) => {
      var chargingStations = [];
      // Create
      chargingStationsMDB.forEach((chargingStationMDB) => {
        chargingStations.push(new ChargingStation(chargingStationMDB));
      });
      // Ok
      return chargingStations;
    });
  }

  getChargingStation(chargeBoxIdentity) {
    // Exec request
    return MDBChargingStation.findById({"_id": chargeBoxIdentity}).then(chargingStationMDB => {
      var chargingStation = null;
      // Found
      if (chargingStationMDB) {
        // Create
        chargingStation = new ChargingStation(chargingStationMDB);
      }
      return chargingStation;
    });
  }

  getUsers(searchValue, numberOfUser, withPicture=false) {
    if (!numberOfUser || isNaN(numberOfUser)) {
      numberOfUser = 200;
    }
    // Set the filters
    let filters = {
      "$and": [
        {
          "$or": [
            { "deleted": { $exists:false } },
            { deleted: false }
          ]
        }
      ]
    };
    // Source?
    if (searchValue) {
      // Build filter
      filters.$and.push({
        "$or": [
          { "name" : { $regex : `.*${searchValue}.*` } },
          { "firstName" : { $regex : `.*${searchValue}.*` } },
          { "email" : { $regex : `.*${searchValue}.*` } },
          { "role" : { $regex : `.*${searchValue}.*` } }
        ]
      });
    }
    // Exec request
    return MDBTag.find({}).exec().then((tagsMDB) => {
      // Exec request
      return MDBUser.find(filters, (withPicture?{}:{image:0})).sort( {status: -1, name: 1, firstName: 1} ).limit(numberOfUser).exec().then((usersMDB) => {
        var users = [];
        // Create
        usersMDB.forEach((userMDB) => {
          // Create
          var user = new User(userMDB);
          // Get TagIDs
          var tags = tagsMDB.filter((tag) => {
            // Find a match
            return tag.userID.equals(userMDB._id);
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
    if (!user.id && !user.email) {
      // ID ,ust be provided!
      return Promise.reject( new Error("Error in saving the User: User has no ID or Email and cannot be created or updated") );
    } else {
      var userFilter = {};
      // Build Request
      if (user.id) {
        userFilter._id = user.id;
      } else {
        userFilter.email = user.email;
      }
      // Get
      return MDBUser.findOneAndUpdate(userFilter, user, {
          new: true,
          upsert: true
        }).then((userMDB) => {
          var newUser = new User(userMDB);
          // Notify Change
          if (!user.id) {
            _centralRestServer.notifyUserCreated(newUser.getModel());
          } else {
            _centralRestServer.notifyUserUpdated(newUser.getModel());
          }
          // Update the badges
          // First delete them
          MDBTag.remove({ "userID" : userMDB._id }).then(() => {
            // Add tags
            user.tagIDs.forEach((tag) => {
              // Update/Insert Tag
              return MDBTag.findOneAndUpdate({
                  "_id": tag
                },{
                  "_id": tag,
                  "userID": userMDB._id
                },{
                  new: true,
                  upsert: true
                }).then((newTag) => {
                  // Created with success
                });                // Add TagIds
            });
          });
          return newUser;
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
    return MDBUser.findById(id).exec().then((userMDB) => {
      // Check deleted
      if (userMDB && userMDB.deleted) {
        // Return empty user
        return Promise.resolve();
      } else {
        // Ok
        return this._createUser(userMDB);
      }
    });
  }

  getUserByEmail(email) {
    // Exec request
    return MDBUser.findOne({"email": email}, {image:0}).then((userMDB) => {
      // Check deleted
      if (userMDB && userMDB.deleted) {
        // Return empty user
        return Promise.resolve();
      } else {
        // Ok
        return this._createUser(userMDB);
      }
    });
  }

  getUserByTagId(tagID) {
    // Exec request
    return MDBTag.findById(tagID).populate("userID").exec().then((tagMDB) => {
      var user = null;
      // Check
      if (tagMDB && tagMDB.userID && !tagMDB.userID.deleted) {
        // Ok
        user = new User(tagMDB.userID);
      } else {
        // Return empty user
        return Promise.resolve();
      }
      // Ok
      return user;
    });
  }

  _createUser(userMDB) {
    var user = null;
    // Check
    if (userMDB) {
      // Create
      user = new User(userMDB);
      // Get the Tags
      return MDBTag.find({"userID": userMDB.id}).exec().then((tagsMDB) => {
        // Check
        if (tagsMDB) {
          // Get the Tags
          var tags = tagsMDB.map((tagMDB) => { return tagMDB.id; });
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
