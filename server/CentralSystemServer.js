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
    setInterval(ChargingStationBackgroundTasks.executeAllBackgroundTasks, 15000);

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
    chargingStation.save().then(function() {
      // Save Boot Notification
      chargingStation.saveBootNotification(args);

      // Get the Charging Station Config
      chargingStation.requestConfiguration().then(function(configuration) {
        // Save it
        chargingStation.saveConfiguration(configuration);
      });
    });

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
  }

  handleHeartBeat(args, headers, req) {
    var heartBeat = new Date();

    // Get the charging station
    global.storage.getChargingStation(headers.chargeBoxIdentity).then(function(chargingStation) {
      // Found?
      if (chargingStation) {
        // Set Heartbeat
        chargingStation.setLastHeartBeat(heartBeat);
        // Save
        chargingStation.save();
      }
    });

    return {
      "heartbeatResponse": {
        "currentTime": heartBeat.toISOString()
      }
    };
  }

  handleStatusNotification(args, headers, req) {
    // Get the charging station
    global.storage.getChargingStation(headers.chargeBoxIdentity).then(function(chargingStation) {
      // Found?
      if (chargingStation) {
        // Save
        chargingStation.saveStatusNotification(args);
      }
    });

    return {
      "statusNotificationResponse": {
      }
    }
  }

  handleMeterValues(args, headers, req) {
    // Get the charging station
    global.storage.getChargingStation(headers.chargeBoxIdentity).then(function(chargingStation) {
      // Found?
      if (chargingStation) {
        // Save
        chargingStation.saveMeterValues(args);
      }
    });

    return {
      "meterValuesResponse": {
      }
    }
  }

  handleAuthorize(args, headers, req) {
    // Get the charging station
    global.storage.getChargingStation(headers.chargeBoxIdentity).then(function(chargingStation) {
      // Found?
      if (chargingStation) {
        // Save
        chargingStation.saveAuthorize(args);
      }
    });

    return {
      "authorizeResponse": {
        "idTagInfo": {
          "status": "Accepted"
          //          "expiryDate": "",
          //          "parentIdTag": ""
        }
      }
    }
  }

  handleDiagnosticsStatusNotification(args, headers, req) {
    // Get the charging station
    global.storage.getChargingStation(headers.chargeBoxIdentity).then(function(chargingStation) {
      // Found?
      if (chargingStation) {
        // Save
        chargingStation.saveDiagnosticsStatusNotification(args);
      }
    });

    return {
      "diagnosticsStatusNotificationResponse": {
      }
    }
  }

  handleFirmwareStatusNotification(args, headers, req) {
    // Get the charging station
    global.storage.getChargingStation(headers.chargeBoxIdentity).then(function(chargingStation) {
      // Found?
      if (chargingStation) {
        // Save
        chargingStation.saveFirmwareStatusNotification(args);
      }
    });

    return {
      "firmwareStatusNotificationResponse": {
      }
    }
}

  handleStartTransaction(args, headers, req) {
    // Set the transaction ID
    args.transactionId = Utils.getRandomInt();

    // Get the charging station
    global.storage.getChargingStation(headers.chargeBoxIdentity).then(function(chargingStation) {
      // Found?
      if (chargingStation) {
        // Save
        chargingStation.saveStartTransaction(args);
      }
    });

    return {
      "startTransactionResponse": {
        "transactionId": args.transactionId,
        "idTagInfo": {
          "status": "Accepted"
//          "expiryDate": "",
//          "parentIdTag": ""
        }
      }
    }
  }

  handleDataTransfer(args, headers, req) {
    // Get the charging station
    global.storage.getChargingStation(headers.chargeBoxIdentity).then(function(chargingStation) {
      // Found?
      if (chargingStation) {
        // Save
        chargingStation.saveDataTransfer(args);
      }
    });

    return {
      "dataTransferResponse": {
        "status": "Accepted"
//        "data": ""
      }
    }
  }

  handleStopTransaction(args, headers, req) {
    // Get the charging station
    global.storage.getChargingStation(headers.chargeBoxIdentity).then(function(chargingStation) {
      // Found?
      if (chargingStation) {
        // Save
        chargingStation.saveStopTransaction(args);
      }
    });

    return {
      "stopTransactionResponse": {
        "idTagInfo": {
          "status": "Accepted"
//          "expiryDate": "",
//          "parentIdTag": "",
        }
      }
    }
  }
}

module.exports = CentralSystemServer;
