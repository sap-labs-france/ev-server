const ChargingStation = require('../../model/ChargingStation');
const User = require('../../model/User');
const Utils = require('../../utils/Utils');
const Logging = require('../../utils/Logging');
const moment = require('moment');

class ChargingStationConsumptionTask {
    static run() {
      Logging.logInfo({
        userFullName: "System", source: "Central Server", module: "ChargingStationConsumptionTask",
        method: "run", action: "ChargingStationConsumption",
        message: `The task 'chargingStationConsumptionTask' is being run` });

      // Get all the charging stations
      global.storage.getChargingStations().then((chargingStations) => {
        // Charging Station
        chargingStations.forEach(chargingStation => {
          // Connector
          chargingStation.getConnectors().forEach((connector) => {
            // Get the consumption of the connector
            chargingStation.getLastConsumption(connector.connectorId).then((consumption) => {
              // console.log(
              //   chargingStation.getChargeBoxIdentity() + "-" + connector.connectorId + ": " +
              //   connector.currentConsumption + " - Found: " + consumption);
              let currentConsumption = 0;
              // Value provided?
              if (consumption) {
                currentConsumption = consumption;
              }
              // Changed?
              if (connector.currentConsumption !== currentConsumption) {
                // Log
                Logging.logInfo({
                  userFullName: "System", source: "Central Server", module: "ChargingStationBackgroundTasks",
                  method: "computeChargingStationsConsumption", action: "ChargingStationConsumption",
                  message: `Charging Station ${chargingStation.getChargeBoxIdentity()} - Connector ${connector.connectorId} consumption changed from ${connector.currentConsumption} to ${currentConsumption}` });
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
}

module.exports=ChargingStationConsumptionTask;
