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
        // Get the consumption for each connector
        promises.push(chargingStation.getLastConsumption(connector.connectorId).then((consumption) => {
          let currentConsumption = 0;
          console.log("chargingStation: " + chargingStation.getChargeBoxIdentity() +
            ", connector: " + connector.connectorId +
            ", value: " + (consumption?consumption.value:"n/a"));
          // Value provided?
          if (consumption) {
            // Yes
            currentConsumption = consumption.value;
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
    global.storage.getUserByEmail(user.email).then((userDB) => {
      // Found
      if (!userDB) {
        var newUser = new User(user);
        // Save
        newUser.save().then(() => {
          Logging.logInfo({
            source: "Central Server", module: "ChargingStationBackgroundTasks", method: "checkAndSaveUser",
            message: `User ${newUser.getFullName()} with Email ${newUser.getEMail()} has been saved successfully`,
            detailedMessages: user});
        });
      }
    });
  }
};
