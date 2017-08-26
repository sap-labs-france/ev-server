const ChargingStation = require('../../model/ChargingStation');
const User = require('../../model/User');
const Utils = require('../../utils/Utils');
const Logging = require('../../utils/Logging');
const moment = require('moment');
const SchedulerTask = require('../SchedulerTask');

class ChargingStationConsumptionTask extends SchedulerTask {
  constructor() {
    super();
  }

  run() {
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
          // Get the last tranasction first
          return chargingStation.getLastTransaction(connector.connectorId).then((transaction) => {
            // Found?
            if (transaction && !transaction.stop) {
              // Get the consumption
              chargingStation.getConsumptionsFromTransaction(transaction, true).then((consumption) => {
                let currentConsumption = 0;
                let totalConsumption = 0;
                // Check
                if (consumption) {
                  currentConsumption = (consumption.values.length > 0?consumption.values[consumption.values.length-1].value:0);
                  totalConsumption = consumption.totalConsumption;
                }
                // Changed?
                if (connector.currentConsumption !== currentConsumption || connector.totalConsumption !== totalConsumption) {
                  // Set consumption
                  connector.currentConsumption = currentConsumption;
                  connector.totalConsumption = totalConsumption;
                  // console.log(`${chargingStation.getChargeBoxIdentity()}-${connector.connectorId}-${currentConsumption}-${totalConsumption}` );
                  // Log
                  Logging.logInfo({
                    userFullName: "System", source: "Central Server", module: "ChargingStationConsumptionTask",
                    method: "run", action: "ChargingStationConsumption",
                    message: `${chargingStation.getChargeBoxIdentity()} - ${connector.connectorId} - Consumption changed: ${connector.currentConsumption}, Total: ${connector.totalConsumption}` });              // console.log(`${chargingStation.getChargeBoxIdentity()}-${connector.connectorId}-No Transaction` );
                    // Save
                    chargingStation.save();
                }
              });
            } else {
              // Check
              if (connector.currentConsumption !== 0 || connector.totalConsumption !== 0) {
                // Set consumption
                connector.currentConsumption = 0;
                connector.totalConsumption = 0;
                // Log
                Logging.logInfo({
                  userFullName: "System", source: "Central Server", module: "ChargingStationConsumptionTask",
                  method: "run", action: "ChargingStationConsumption",
                  message: `${chargingStation.getChargeBoxIdentity()} - ${connector.connectorId} - Consumption changed: ${connector.currentConsumption}, Total: ${connector.totalConsumption}` });              // console.log(`${chargingStation.getChargeBoxIdentity()}-${connector.connectorId}-No Transaction` );
                // Save
                chargingStation.save();
              }
            }
          });
        });
      });
    });
  }
}

module.exports=ChargingStationConsumptionTask;
