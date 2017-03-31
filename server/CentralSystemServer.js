var ChargingStation = require('../model/ChargingStation');
var Utils = require('../utils/Utils');
var ChargingStationBackgroundTasks = require('./ChargingStationBackgroundTasks');

let _serverConfig;
let _chargingStationConfig;

class CentralSystemServer {
  constructor(serverConfig, chargingStationConfig) {
    if (new.target === CentralSystemServer) {
      throw new TypeError("Cannot construct CentralSystemServer instances directly");
    }

    // Check the charging station status...
    setInterval(ChargingStationBackgroundTasks.executeAllBackgroundTasks, 15 * 1000);

    // Keep params
    _serverConfig = serverConfig;
    _chargingStationConfig = chargingStationConfig;
  }

  // Start the server (to be defined in sub-classes)
  start() {
  }

  handleBootNotification(args, headers, req) {
    // Set the endpoint
    args.endpoint = headers.From.Address;
    // Set the ChargeBox ID
    args.chargeBoxIdentity = headers.chargeBoxIdentity;
    // Set the default Heart Beat
    args.lastReboot = new Date().toISOString();
    args.lastHeartBeat = args.lastReboot;
    args.timestamp = args.lastReboot;

    // Save Charging Station
    var chargingStation = new ChargingStation(args);
    // Save
    return chargingStation.save().then(function() {
      // Save the Boot Notification
      return chargingStation.saveBootNotification(args);
    // Get the Configuration from the Station
    }).then(function() {
      // Get the Charging Station Config
      return chargingStation.requestConfiguration().then(function(configuration) {
        return configuration;
      });
    // Save the config
    }).then(function(configuration) {
      // Save it
      return chargingStation.saveConfiguration(configuration);
      // Return the result
    }).then(function() {
      // Return the result
      // OCPP 1.6
      if (args.ocppVersion === "1.6") {
        return {
          "bootNotificationResponse": {
            "status": 'Accepted',
            "currentTime": new Date().toISOString(),
            "interval": _chargingStationConfig.heartbeatInterval
          }
        }
        // OCPP 1.2 && 1.5
      } else {
        return {
          "bootNotificationResponse": {
            "status": 'Accepted',
            "currentTime": new Date().toISOString(),
            "heartbeatInterval": _chargingStationConfig.heartbeatInterval
          }
        }
      };
    });
  }

  handleHeartBeat(args, headers, req) {
    var heartBeat = new Date();

    // Get the charging station
    return global.storage.getChargingStation(headers.chargeBoxIdentity).then(function(chargingStation) {
      // Found?
      if (chargingStation) {
        // Set Heartbeat
        chargingStation.setLastHeartBeat(heartBeat);
        // Save
        return chargingStation.save();
      } else {
        // Nothing to return
        return Promise.resolve();
      }
    }).then(function() {
      return {
        "heartbeatResponse": {
          "currentTime": heartBeat.toISOString()
        }
      };
    });
  }

  handleStatusNotification(args, headers, req) {
    // Get the charging station
    return global.storage.getChargingStation(headers.chargeBoxIdentity).then(function(chargingStation) {
      // Found?
      if (chargingStation) {
        // Save
        return chargingStation.saveStatusNotification(args);
      } else {
        // Nothing to return
        return Promise.resolve();
      }
    }).then(function() {
      return {
        "statusNotificationResponse": {
        }
      };
    });
  }

  handleMeterValues(args, headers, req) {
    // Get the charging station
    return global.storage.getChargingStation(headers.chargeBoxIdentity).then(function(chargingStation) {
      // Found?
      if (chargingStation) {
        // Save
        return chargingStation.saveMeterValues(args);
      } else {
        // Nothing to return
        return Promise.resolve();
      }
    }).then(function() {
      return {
        "meterValuesResponse": {
        }
      };
    });
  }

  handleAuthorize(args, headers, req) {
    // Get the charging station
    return global.storage.getChargingStation(headers.chargeBoxIdentity).then(function(chargingStation) {
      // Found?
      if (chargingStation) {
        // Save
        return chargingStation.saveAuthorize(args);
      } else {
        // Nothing to return
        return Promise.resolve();
      }
    }).then(function() {
      return {
        "authorizeResponse": {
          "idTagInfo": {
            "status": "Accepted"
            //          "expiryDate": "",
            //          "parentIdTag": ""
          }
        }
      };
    });
  }

  handleDiagnosticsStatusNotification(args, headers, req) {
    // Get the charging station
    return global.storage.getChargingStation(headers.chargeBoxIdentity).then(function(chargingStation) {
      // Found?
      if (chargingStation) {
        // Save
        return chargingStation.saveDiagnosticsStatusNotification(args);
      } else {
        // Nothing to return
        return Promise.resolve();
      }
    }).then(function() {
      return {
        "diagnosticsStatusNotificationResponse": {
        }
      };
    });
  }

  handleFirmwareStatusNotification(args, headers, req) {
    // Get the charging station
    return global.storage.getChargingStation(headers.chargeBoxIdentity).then(function(chargingStation) {
      // Found?
      if (chargingStation) {
        // Save
        return chargingStation.saveFirmwareStatusNotification(args);
      } else {
        // Nothing to return
        return Promise.resolve();
      }
    }).then(function() {
      return {
        "firmwareStatusNotificationResponse": {
        }
      };
    });
}

  handleStartTransaction(args, headers, req) {
    // Set the transaction ID
    args.transactionId = Utils.getRandomInt();

    // Get the charging station
    return global.storage.getChargingStation(headers.chargeBoxIdentity).then(function(chargingStation) {
      // Found?
      if (chargingStation) {
        // Save
        return chargingStation.saveStartTransaction(args);
      } else {
        // Nothing to return
        return Promise.resolve();
      }
    }).then(function() {
      return {
        "startTransactionResponse": {
          "transactionId": args.transactionId,
          "idTagInfo": {
            "status": "Accepted"
  //          "expiryDate": "",
  //          "parentIdTag": ""
          }
        }
      };
    });
  }

  handleDataTransfer(args, headers, req) {
    // Get the charging station
    return global.storage.getChargingStation(headers.chargeBoxIdentity).then(function(chargingStation) {
      // Found?
      if (chargingStation) {
        // Save
        return chargingStation.saveDataTransfer(args);
      } else {
        // Nothing to return
        return Promise.resolve();
      }
    }).then(function() {
      return {
        "dataTransferResponse": {
          "status": "Accepted"
  //        "data": ""
        }
      }
    });
  }

  handleStopTransaction(args, headers, req) {
    // Get the charging station
    return global.storage.getChargingStation(headers.chargeBoxIdentity).then(function(chargingStation) {
      // Found?
      if (chargingStation) {
        // Save
        return chargingStation.saveStopTransaction(args);
      } else {
        // Nothing to return
        return Promise.resolve();
      }
    }).then(function() {
      return {
        "stopTransactionResponse": {
          "idTagInfo": {
            "status": "Accepted"
  //          "expiryDate": "",
  //          "parentIdTag": "",
          }
        }
      };
    });
  }
}

module.exports = CentralSystemServer;
