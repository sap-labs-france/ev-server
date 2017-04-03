var ChargingStation = require('../model/ChargingStation');
var User = require('../model/User');
var Utils = require('../utils/Utils');

module.exports = {
  // Execute all tasks
  executeAllBackgroundTasks: function() {
    // Handle task related to Charging Stations
    return module.exports.checkChargingStations();
  },

  checkChargingStations() {
    // Create a promise
    return new Promise(function(fulfill, reject) {
      var promises = [];
      // Check DB
      if (global.storage) {
        // Get all the charging stations
        global.storage.getChargingStations().then(function(chargingStations) {
          // Charging Station
          chargingStations.forEach(function(chargingStation) {
            var chargingStationUpdated = false;
            // Compute current consumption
            promises.push(module.exports.computeChargingStationsConsumption(chargingStation).then(function(updated) {
                // Update
                chargingStationUpdated = chargingStationUpdated || updated;
                // Update the status
                return module.exports.checkChargingStationsStatus(chargingStation);
              }).then(function(updated) {
                // Update
                chargingStationUpdated = chargingStationUpdated || updated;
                // Updated?
                if (chargingStationUpdated) {
                  // Save
                  return chargingStation.save();
                }
            }));
          });

          // Wait
          //Promise.all(promises).then(function() {
            fulfill();
          //});
        });
      } else {
        // Nothing to do
        fulfill();
      }
    });
  },

  computeChargingStationsConsumption: function(chargingStation) {
    // Create a promise
    return new Promise(function(fulfill, reject) {
      var promises = [];
      var chargingStationUpdated = false;

      // Get Connectors
      var connectors = chargingStation.getConnectors();

      // Connection
      connectors.forEach(function(connector) {
        // Set the date to the last 20secs
        var date = new Date();
        date.setSeconds(date.getSeconds() - (chargingStation.getMeterIntervalSecs() * 2));

        // Get the consumption for each connector
        promises.push(chargingStation.getConsumptions(connector.connectorId, null, date).then(function(consumption) {
          let currentConsumption = 0;

          // Value provided?
          if (consumption.values.length !== 0) {
            // Yes
            currentConsumption = Math.floor((consumption.values[0].value / connector.power) * 100);
          }

          // Changed?
          if (connector.currentConsumption !== currentConsumption) {
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
      fulfill(true);
//      Promise.all(promises).then(function() {
//        fulfill(chargingStationUpdated);
//      });
    });
  },

  checkChargingStationsStatus: function(chargingStation) {
    // Create a promise
    return new Promise(function(fulfill, reject) {
      var promises = [];
      var chargingStationUpdated = false;

      // Get Connectors
      var connectors = chargingStation.getConnectors();

      // Connection
      connectors.forEach(function(connector) {
        // Get config
        var chargingStationConfig = Utils.getChargingStationConfig();
        var currentDate = new Date();
        var dateHeartBeatCeil = new Date(chargingStation.getLastHeartBeat());

        // Set a value in the future
        dateHeartBeatCeil.setSeconds(
          chargingStation.getLastHeartBeat().getSeconds() +
          (chargingStationConfig.heartbeatInterval * 2));

        // Not longer any heartbeat?
        if (dateHeartBeatCeil < currentDate) {
          // Check
          if (connector.status !== 'Unknown') {
            // Reset status
            connector.status = 'Unknown';
            // Update
            chargingStationUpdated = true;
          }
          // Nothing to do
          return Promise.resolve();
        } else {
          // Refresh with the last status for the connector
          promises.push(chargingStation.getLastStatusNotification(connector.connectorId).then(function(lastStatus) {
            // Check
            if (lastStatus.status && connector.status !== lastStatus.status) {
              // Reset status
              connector.status = lastStatus.status;
              // Update
              chargingStationUpdated = true;
            }
            // Nothing to do
            return Promise.resolve();
          }));
        };
      });

      // Wait
      //Promise.all(promises).then(function() {
      //  fulfill(chargingStationUpdated);
      //});
      fulfill(true);
    });
  },

  uploadUsers() {
    // Get from the file system
    var users = Utils.getUsers();
    // Process them
    for (var i = 0; i < users.users.length; i++) {
      // Check & Save
      module.exports.checkAndSaveUser(users.users[i]);
    };
  },

  checkAndSaveUser(user) {
    // Get user
    global.storage.getUserByTagId(user.tagID).then((userDB) => {
      // Found
      if (!userDB) {
        // No: Create
        var newUser = new User(user);
        // Save
        newUser.save().then(() => {
          // Ok
          console.log("User saved");
        }, (err) => {
          // Ko
          console.log(err);
        });
      }
    });
  }
};
