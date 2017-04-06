var ChargingStation = require('../model/ChargingStation');
var User = require('../model/User');
var Utils = require('../utils/Utils');
var Logging = require('../utils/Logging');

module.exports = {
  // Execute all tasks
  executeAllBackgroundTasks: function() {
    // Upload initial users
    // module.exports.uploadUsers();

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
            // Update the status
            return module.exports.checkChargingStationsStatus(chargingStation);
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
          source: "Central Server", module: "ChargingStationBackgroundTasks", method: "checkChargingStations",
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

      // Get Connectors
      var connectors = chargingStation.getConnectors();

      // Connection
      connectors.forEach((connector) => {
        // Set the date to the last 20secs
        var date = new Date();
        date.setSeconds(date.getSeconds() - (chargingStation.getMeterIntervalSecs() * 2));

        // Get the consumption for each connector
        promises.push(chargingStation.getConsumptions(connector.connectorId, null, date).then((consumption) => {
          let currentConsumption = 0;

          // Value provided?
          if (consumption.values.length !== 0) {
            // Yes
            currentConsumption = consumption.values[0].value;
          }

          // Changed?
          if (connector.currentConsumption !== currentConsumption) {
            // Log
            Logging.logInfo({
              source: "Central Server", module: "ChargingStationBackgroundTasks", method: "computeChargingStationsConsumption",
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

  checkChargingStationsStatus: function(chargingStation) {
    // Create a promise
    return new Promise((fulfill, reject) => {
      var promises = [];
      var chargingStationUpdated = false;

      // Get Connectors
      var connectors = chargingStation.getConnectors();

      // Connection
      connectors.forEach((connector) => {
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
            // Log
            Logging.logInfo({
              source: "Central Server", module: "ChargingStationBackgroundTasks", method: "checkChargingStationsStatus",
              message: `Charging Station ${chargingStation.getChargeBoxIdentity()} Status changed from '${connector.status}' to 'Unknown'` });
            // Reset status
            connector.status = 'Unknown';
            // Update
            chargingStationUpdated = true;
          }
          // Nothing to do
          return Promise.resolve();
        } else {
          // Refresh with the last status for the connector
          promises.push(chargingStation.getLastStatusNotification(connector.connectorId).then((lastStatus) => {
            // Check
            if (lastStatus.status && connector.status !== lastStatus.status) {
              // Log
              Logging.logInfo({
                source: "Central Server", module: "ChargingStationBackgroundTasks", method: "checkChargingStationsStatus",
                message: `Charging Station ${chargingStation.getChargeBoxIdentity()} Status changed from '${connector.status}' to '${lastStatus.status}'` });
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
      Promise.all(promises).then(() => {
        fulfill(chargingStationUpdated);
      });
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
        // Save
        new User(user).save();
      }
    });
  }
};
