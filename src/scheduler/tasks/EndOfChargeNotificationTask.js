const Logging = require('../../utils/Logging');
const NotificationHandler = require('../../notification/NotificationHandler');
const Configuration = require('../../utils/Configuration');
const Utils = require('../../utils/Utils');
const moment = require('moment');

_configChargingStation = Configuration.getChargingStationConfig();

class EndOfChargeNotificationTask {
    static run() {
      Logging.logInfo({
        userFullName: "System", source: "Central Server", module: "EndOfChargeNotificationTask",
        method: "run", action: "EndOfChargeNotification",
        message: `The task 'endOfChargeNotificationTask' is being run` });

      // Get all the charging stations
      global.storage.getChargingStations().then((chargingStations) => {
        // Charging Station
        chargingStations.forEach(chargingStation => {
          // Connector
          chargingStation.getConnectors().forEach((connector) => {
            // Get the consumption of the connector
            chargingStation.getLastAverageConsumption(connector.connectorId, 2).then((consumption) => {
              // Get the consumption for each connector
              chargingStation.getLastTransaction(connector.connectorId).then((lastTransaction) => {
                // Transaction In Progress?
                if (lastTransaction && !lastTransaction.stop && // Transaction must not be stopped
                  moment(lastTransaction.start.timestamp).add( // Check after 5 mins (start transaction date + 5 mins)
                    _configChargingStation.checkEndOfChargeNotificationAfterMin, "minutes").isBefore(moment())) {
                  // --------------------------------------------------------------------
                  // Notification BEFORE end of charge ----------------------------------
                  // --------------------------------------------------------------------
                  if (_configChargingStation.notifBeforeEndOfChargeEnabled && // notif Before End Of Charge Enabled?
                      consumption <= _configChargingStation.notifBeforeEndOfChargePercent) {  // Under a certain percentage
                    // Send Notification
                    NotificationHandler.sendBeforeEndOfCharge(
                      lastTransaction.start.transactionId + "-BEOF",
                      lastTransaction.start.userID,
                      chargingStation.getModel(),
                      {
                        "user": lastTransaction.start.userID,
                        "chargingStationId": chargingStation.getChargeBoxIdentity(),
                        "connectorId": connector.connectorId,
                        "evseDashboardChargingStationURL" : Utils.buildEvseTransactionURL(chargingStation, connector.connectorId, lastTransaction.start.transactionId)
                      },
                      lastTransaction.start.userID.locale);
                  }

                  // --------------------------------------------------------------------
                  // Notification END of charge -----------------------------------------
                  // --------------------------------------------------------------------
                  if (_configChargingStation.notifEndOfChargeEnabled && consumption === 0) {
                    // Send Notification
                    NotificationHandler.sendEndOfCharge(
                      lastTransaction.start.transactionId + "-EOF",
                      lastTransaction.start.userID,
                      chargingStation.getModel(),
                      {
                        "user": lastTransaction.start.userID,
                        "chargingStationId": chargingStation.getChargeBoxIdentity(),
                        "connectorId": connector.connectorId,
                        "evseDashboardChargingStationURL" : Utils.buildEvseTransactionURL(chargingStation, connector.connectorId, lastTransaction.start.transactionId),
                        "notifStopTransactionAndUnlockConnector": _configChargingStation.notifStopTransactionAndUnlockConnector
                      },
                      lastTransaction.start.userID.locale);

                    // Stop Transaction and Unlock Connector?
                    if (_configChargingStation.notifStopTransactionAndUnlockConnector) {
                      // Yes: Stop the transaction
                      chargingStation.requestStopTransaction(lastTransaction.start.transactionId).then((result) => {
                        // Ok?
                        if (result && result.status === "Accepted") {
                          // Unlock the connector
                          chargingStation.requestUnlockConnector(connector.connectorId).then((result) => {
                            // Ok?
                            if (result && result.status === "Accepted") {
                              // Nothing to do
                              return Promise.resolve();
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
                }
              });
            });
          });
        });
      });
    }
}

module.exports=EndOfChargeNotificationTask;
