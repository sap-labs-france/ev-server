var ChargingStation = require('../model/ChargingStation');
var User = require('../model/User');
var Utils = require('../utils/Utils');
var Logging = require('../utils/Logging');
var Configuration = require('../utils/Configuration');
var Mustache = require('mustache');
var EMail = require('../email/EMail');

_configChargingStation = Configuration.getChargingStationConfig();

module.exports = {
  // Execute all tasks
  executeAllBackgroundTasks: function() {
    // Upload initial users
    // module.exports.uploadUsers();

    // Upload initial users
    // module.exports.saveUsers();

    // Handle task related to Charging Stations
    return module.exports.checkChargingStations();
  },

  checkChargingStations() {
    // Create a promise
    return new Promise((fulfill, reject) => {
    // Get all the charging stations
      global.storage.getChargingStations().then((chargingStations) => {
        // Wait
        Promise.all(chargingStations.map(chargingStation => {
          var chargingStationUpdated = false;
          // Compute current consumption
          return module.exports.computeChargingStationsConsumption(chargingStation).then((updated) => {
            // Update
            chargingStationUpdated = chargingStationUpdated || updated;
            // Check Notifications
            return module.exports.checkAndSendEndOfChargeNotification(chargingStation);
          }).then((updated) => {
            // Update
            chargingStationUpdated = chargingStationUpdated || updated;
            // Updated?
            if (chargingStationUpdated) {
              // Save
              return chargingStation.save();
            }
          });
        })).then(() => {
          fulfill();
        });
      }).catch((err) => {
        // Log
        Logging.logError({
          userFullName: "System", source: "Central Server", module: "ChargingStationBackgroundTasks", method: "checkChargingStations",
          message: `Cannot check the Charging Stations: ${err.toString()}`,
          detailedMessages: err.stack });
        reject(err);
      });
    });
  },

  computeChargingStationsConsumption: function(chargingStation) {
    // Create a promise
    return new Promise((fulfill, reject) => {
      var promises = [];
      var chargingStationUpdated = false;

      // Check
      if (!_configChargingStation.notifBeforeEndOfChargeEnabled) {
        // Bypass
        fulfill(false);
        return;
      }

      // Get Connectors
      var connectors = chargingStation.getConnectors();
      // Connection
      connectors.forEach((connector) => {
        // Get the consumption for each connector
        promises.push(chargingStation.getLastConsumption(connector.connectorId).then((consumption) => {
          let currentConsumption = 0;
          // Value provided?
          if (consumption) {
            // Yes
            currentConsumption = consumption.value;
          }
          // Changed?
          if (connector.currentConsumption !== currentConsumption) {
            // Log
            Logging.logInfo({
              userFullName: "System", source: "Central Server", module: "ChargingStationBackgroundTasks", method: "computeChargingStationsConsumption",
              message: `Charging Station ${chargingStation.getChargeBoxIdentity()} consumption changed from ${connector.currentConsumption} to ${currentConsumption}` });
            // Set consumption
            connector.currentConsumption = currentConsumption;
            // Update
            chargingStationUpdated = true;
          }
          // Nothing to do
          return Promise.resolve();
        }));
     });
     // Wait
     Promise.all(promises).then(() => {
       fulfill(chargingStationUpdated);
     });
    });
  },

  checkAndSendEndOfChargeNotification: function(chargingStation) {
    // Create a promise
    return new Promise((fulfill, reject) => {
      var promises = [];
      var chargingStationUpdated = false;
      // Get Connectors
      var connectors = chargingStation.getConnectors();
      // Connection
      connectors.forEach((connector) => {
        // Get the consumption for each connector
        promises.push(chargingStation.getLastTransaction(connector.connectorId).then((lastTransaction) => {
          // Transaction In Progress?
          if (lastTransaction && !lastTransaction.stop) {
            // Yes: Compute percent
            var percentConsumption = (connector.currentConsumption * 100) / connector.power;
            // Check
            if (!lastTransaction.start.notifBeforeEndOfChargeSent &&
                percentConsumption <= _configChargingStation.notifBeforeEndOfChargePercent) {
              // Send the email
              EMail.sendNotifyBeforeEndOfChargeEmail({
                    "user": lastTransaction.start.userID,
                    "evseDashboardChargingStationURL" : Utils.buildEvseChargingStationURL(chargingStation)
                  }, lastTransaction.start.userID.locale).then(
                message => {
                  // Set notif sent
                  // Keep user
                  let user = {};
                  user.firstName = lastTransaction.start.userID.firstName;
                  user.name = lastTransaction.start.userID.name;
                  user.email = lastTransaction.start.userID.email;
                  // Set
                  lastTransaction.start.userID = lastTransaction.start.userID.id;
                  lastTransaction.start.notifBeforeEndOfChargeSent = true;
                  // Save Start Transaction
                  chargingStation.saveStartTransaction(lastTransaction.start).then(() => {
                    // Success
                    Logging.logInfo({
                      userFullName: "System", source: "Central Server", module: "CentralServerBackgroundTasks", method: "checkAndSendEndOfChargeNotification",
                      action: "NotifyBeforeEndOfCharge", message: `User ${user.firstName} ${user.name} with email ${user.email} has been notified successfully about before the end of charge`,
                      detailedMessages: lastTransaction});
                    // Nothing to do
                    return Promise.resolve();
                  });
                },
                error => {
                  // Error
                  Logging.logError({
                    userFullName: "System", source: "Central Server", module: "CentralServerBackgroundTasks", method: "checkAndSendEndOfChargeNotification",
                    action: "NotifyBeforeEndOfCharge", message: `${error.toString()}`,
                    detailedMessages: error.stack });
                });

            // Charge ended?
            } else if (percentConsumption == 0) {
              // Yes: Stop the transaction
              chargingStation.requestStopTransaction(lastTransaction.start.transactionId).then((result) => {
                // Ok?
                if (result && result.status === "Accepted") {
                  // Unlock the connector
                  chargingStation.requestUnlockConnector(connector.connectorId).then((result) => {
                    // Ok?
                    if (result && result.status === "Accepted") {
                      // Send EMail notification
                      EMail.sendNotifyEndOfChargeEmail({
                            "user": lastTransaction.start.userID,
                            "evseDashboardChargingStationURL" : Utils.buildEvseChargingStationURL(chargingStation)
                          }, lastTransaction.start.userID.locale).then(
                        message => {
                          // Success
                          Logging.logInfo({
                            userFullName: "System", source: "Central Server", module: "CentralServerBackgroundTasks", method: "checkAndSendEndOfChargeNotification",
                            action: "NotifyEndOfCharge", message: `User ${lastTransaction.start.userID.firstName} ${lastTransaction.start.userID.name} with email ${lastTransaction.start.userID.email} has been notified successfully about the end of charge`,
                            detailedMessages: lastTransaction});
                          // Nothing to do
                          return Promise.resolve();
                        },
                        error => {
                          // Error
                          Logging.logError({
                            userFullName: "System", source: "Central Server", module: "CentralServerBackgroundTasks", method: "checkAndSendEndOfChargeNotification",
                            action: "NotifyEndOfCharge", message: `${error.toString()}`,
                            detailedMessages: error.stack });
                        });
                    } else {
                      // Cannot unlock the connector
                      Logging.logError({
                        userFullName: "System", source: "Central Server", module: "CentralServerBackgroundTasks", method: "checkAndSendEndOfChargeNotification",
                        action: "NotifyEndOfCharge", message: `Cannot unlock the connector '${connector.connectorId}' of the Charging Station '${chargingStation.getChargeBoxIdentity()}'`,
                        detailedMessages: lastTransaction});
                    }
                  });
                } else {
                  // Cannot stop the transaction
                  Logging.logError({
                    userFullName: "System", source: "Central Server", module: "CentralServerBackgroundTasks", method: "checkAndSendEndOfChargeNotification",
                    action: "NotifyEndOfCharge", message: `Cannot stop the transaction of the Charging Station '${chargingStation.getChargeBoxIdentity()}'`,
                    detailedMessages: lastTransaction});
                }
              });
            }
          }
          // Nothing to do
          return Promise.resolve();
        }));
     });

      // Wait
     Promise.all(promises).then(() => {
       fulfill(chargingStationUpdated);
     });
    });
  },

  uploadUsers() {
    // Log
    console.log("Users Uploaded!");
    // Get from the file system
    var users = Utils.getUsers();
    // Process them
    for (var i = 0; i < users.length; i++) {
      // Check & Save
      module.exports.checkAndSaveUser(users[i]);
    }
  },

  checkAndSaveUser(user) {
    // Get user
    global.storage.getUserByEmail(user.email).then((userDB) => {
      // Found
      if (!userDB) {
        var newUser = new User(user);
        // Save
        newUser.save().then(() => {
          Logging.logInfo({
            userFullName: "System", source: "Central Server", module: "ChargingStationBackgroundTasks", method: "checkAndSaveUser",
            message: `User ${newUser.getFullName()} with Email ${newUser.getEMail()} has been saved successfully`,
            detailedMessages: user});
        });
      }
    });
  },

  saveUsers() {
    console.log("Users Saved!");
    // Get the users
    global.storage.getUsers().then(function(users) {
      let savedUsers = [];
      for (var i = 0; i < users.length; i++) {
        savedUsers.push(users[i].getModel());
      }
      // Save
      Utils.saveUsers(savedUsers);
    }).catch((err) => {
      // Log
      console.log(err);
    });
  }
};
