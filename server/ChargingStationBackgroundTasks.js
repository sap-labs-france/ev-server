var ChargingStation = require('../model/ChargingStation');
var Utils = require('../utils/Utils');

module.exports = {
  // Execute all tasks
  executeAllBackgroundTasks: function() {
    // Clean up status
    module.exports.checkChargingStationsStatus();

    // Compute current consumption
    module.exports.computeChargingStationsConsumption();
  },

  computeChargingStationsConsumption: function() {
    // Check DB
    if (global.storage) {
      // Get all the charging stations
      global.storage.getChargingStations().then(function(chargingStations) {
        // Handle each charging stations
        chargingStations.forEach(function(chargingStation) {
          // For each connector
          chargingStation.getConnectors().forEach(function(connector) {
            // Set the date to the last 20secs
            var date = new Date();
            date.setSeconds(date.getSeconds() - (chargingStation.getMeterIntervalSecs() * 2));

            // Get the consumption for each connector
            chargingStation.getConsumptions(connector.connectorId, null, date).then(function(consumption) {
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
                // Save
                chargingStation.save();
              }
            });
          });
        });
      });
    }
  },

  checkChargingStationsStatus: function() {
    var chargingStationConfig = Utils.getChargingStationConfig();

    // Check DB
    if (global.storage) {
      // Get all the charging stations
      global.storage.getChargingStations().then(function(chargingStations) {
        var currentDate = new Date();

        chargingStations.forEach(function(chargingStation) {
          // Check how hold the heartbeat is
          var dateHeartBeatCeil = new Date(chargingStation.getLastHeartBeat());
          // Set a value in the future
          dateHeartBeatCeil.setSeconds(
              chargingStation.getLastHeartBeat().getSeconds() + chargingStationConfig.heartbeatInterval * 2);

          // Check status with last heartbeatInterval
          var chargerChanged = false;
          var connectors = chargingStation.getConnectors();
          // Not longer any heartbeat?
          if (dateHeartBeatCeil < currentDate) {
            // Reset Status
            connectors.forEach(function(connector) {
              // Check
              if (connector.status !== 'Unknown') {
                // Reset status
                connector.status = 'Unknown';
                chargerChanged = true;
              }
            });

            // Update Charger?
            if (chargerChanged) {
              // Update
              chargingStation.save();
            }
          } else {
            // Check if the status is correct
            connectors.forEach(function(connector) {
              // Get the last status for the connector
              chargingStation.getLastStatusNotification(connector.connectorId).then(function(lastStatus) {
                // Check
                if (lastStatus.status && connector.status !== lastStatus.status) {
                  // Reset status
                  connector.status = lastStatus.status;
                  // Save
                  chargingStation.save();
                }
              });
            });
          }
        });
      });
    }
  }
};
