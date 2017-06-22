var ChargingStation = require('../../model/ChargingStation');
var Utils = require('../../utils/Utils');
var Logging = require('../../utils/Logging');
var bodyParser = require("body-parser");
require('body-parser-xml')(bodyParser);
var cors = require('cors');
var helmet = require('helmet');
var morgan = require('morgan');
var locale = require('locale');

let _centralSystemConfig;
let _chargingStationConfig;

class CentralSystemServer {
  // Common constructor for Central System Server
  constructor(centralSystemConfig, chargingStationConfig, express) {
    // Check
    if (new.target === CentralSystemServer) {
      throw new TypeError("Cannot construct CentralSystemServer instances directly");
    }

    // Body parser
    express.use(bodyParser.json());
    express.use(bodyParser.urlencoded({ extended: false }));
    express.use(bodyParser.xml());

    // log to console
    express.use(morgan('dev'));

    // Cross origin headers
    express.use(cors());

    // Secure the application
    express.use(helmet());

    // Keep params
    _centralSystemConfig = centralSystemConfig;
    _chargingStationConfig = chargingStationConfig;
  }

  // Start the server (to be defined in sub-classes)
  start() {
    // Done in the subclass
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

    // Get the charging station
    return global.storage.getChargingStation(headers.chargeBoxIdentity).then((chargingStation) => {
      if (!chargingStation) {
        // Save Charging Station
        chargingStation = new ChargingStation(args);
      }

      // Save Charging Station
      return chargingStation.save().then(() => {
        // Log
        Logging.logInfo({
          userFullName: "System", source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleBootNotification",
          action: "BootNotification", message: `Charging Station saved successfully`,
          detailedMessages: chargingStation.getModel() });
        // Save the Boot Notification
        return chargingStation.saveBootNotification(args);
      }).then(() => {
        // Log
        Logging.logInfo({
          userFullName: "System", source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleBootNotification",
          action: "BootNotification", message: `Boot Notification saved successfully`,
          detailedMessages: args });

        // Get the Charging Station Config
        return chargingStation.requestGetConfiguration();
      // Save the config
      }).then((configuration) => {
        // Save it
        if (configuration) {
          return chargingStation.saveConfiguration(configuration);
        } else {
          // Log
          return Promise.reject(new Error(`Cannot retrieve the Configuration of ${headers.chargeBoxIdentity}`));
        }
      // Return the result
      }).then(() => {
        // Log
        Logging.logInfo({
          userFullName: "System", source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleBootNotification",
          action: "BootNotification", message: `Charging Station Configuration saved successfully` });

        // Return the result
        // OCPP 1.6
        if (args.ocppVersion === "1.6") {
          return {
            "bootNotificationResponse": {
              "status": 'Accepted',
              "currentTime": new Date().toISOString(),
              "interval": _chargingStationConfig.heartbeatIntervalSecs
            }
          };
          // OCPP 1.2 && 1.5
        } else {
          return {
            "bootNotificationResponse": {
              "status": 'Accepted',
              "currentTime": new Date().toISOString(),
              "heartbeatInterval": _chargingStationConfig.heartbeatIntervalSecs
            }
          };
        }
      }).catch((err) => {
        // Log
        Logging.logError({
          userFullName: "System", source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleBootNotification",
          action: "BootNotification", message: err.toString(),
          detailedMessages: err.stack });
        // Reject
        return {
          "bootNotificationResponse": {
            "status": 'Rejected',
            "currentTime": new Date().toISOString(),
            "heartbeatInterval": _chargingStationConfig.heartbeatIntervalSecs
          }
        };
      });
    });
  }

  handleHeartBeat(args, headers, req) {
    var heartBeat = new Date();

    // Get the charging station
    return global.storage.getChargingStation(headers.chargeBoxIdentity).then((chargingStation) => {
      // Found?
      if (chargingStation) {
        // Set Heartbeat
        chargingStation.setLastHeartBeat(heartBeat);
        // Save
        return chargingStation.save().then(()=> {
          // Log
          Logging.logInfo({
            userFullName: "System", source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleHeartBeat",
            action: "HeartBeat", message: `HeartBeat saved successfully`,
            detailedMessages: heartBeat });
        });
      }
    }).then(() => {
      return {
        "heartbeatResponse": {
          "currentTime": heartBeat.toISOString()
        }
      };
    }).catch((err) => {
      // Log
      Logging.logError({
        userFullName: "System", source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleHeartBeat",
        action: "HeartBeat", message: `Error when processing the Heart Beat: ${err.toString()}`,
        detailedMessages: err.stack });
      // Send the response
      return {
        "heartbeatResponse": {
          "currentTime": heartBeat.toISOString()
        }
      };
    });
  }

  handleStatusNotification(args, headers, req) {
    // Get the charging station
    return global.storage.getChargingStation(headers.chargeBoxIdentity).then((chargingStation) => {
      // Found?
      if (chargingStation) {
        // Save
        return chargingStation.saveStatusNotification(args);
      }
    }).then(() => {
      // Log
      Logging.logInfo({
        userFullName: "System", source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleStatusNotification",
        action: "StatusNotification", message: `Status Notification saved successfully`,
        detailedMessages: args });

      return {
        "statusNotificationResponse": {
        }
      };
    }).catch((err) => {
      // Log
      Logging.logError({
        userFullName: "System", source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleStatusNotification",
        action: "StatusNotification", message: err.toString(),
        detailedMessages: err.stack });

      // Return
      return {
        "statusNotificationResponse": {
        }
      };
    });
  }

  handleMeterValues(args, headers, req) {
    // Get the charging station
    return global.storage.getChargingStation(headers.chargeBoxIdentity).then((chargingStation) => {
      // Found?
      if (chargingStation) {
        // Save
        return chargingStation.saveMeterValues(args);
      }
    }).then(() => {
      return {
        "meterValuesResponse": {
        }
      };
    }).catch((err) => {
      // Log
      Logging.logError({
        userFullName: "System", source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleMeterValues",
        action: "MeterValues", message: `Error when processing the Meter Values: ${err.toString()}`,
        detailedMessages: err.stack });
      // Response
      return {
        "meterValuesResponse": {
        }
      };
    });
  }

  handleAuthorize(args, headers, req) {
    // Get the charging station
    return global.storage.getChargingStation(headers.chargeBoxIdentity).then((chargingStation) => {
      // Found?
      if (chargingStation) {
        // Save
        return chargingStation.saveAuthorize(args);
      } else {
        // Error
        return Promise.reject(new Error(`Charging Station ${headers.chargeBoxIdentity} does not exist`));
      }
    }).then(() => {
      // Log
      Logging.logInfo({
        userFullName: "System", source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleAuthorize",
        action: "Authorize", message: `Authorize saved successfully`,
        detailedMessages: args });

      return {
        "authorizeResponse": {
          "idTagInfo": {
            "status": "Accepted"
            //          "expiryDate": "",
            //          "parentIdTag": ""
          }
        }
      };
    }).catch((err) => {
      // Log
      Logging.logError({
        userFullName: "System", source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleAuthorize",
        action: "Authorize", message: err.toString(),
        detailedMessages: err.stack });

      return {
        "authorizeResponse": {
          "idTagInfo": {
            "status": "Invalid"
            //          "expiryDate": "",
            //          "parentIdTag": ""
          }
        }
      };
    });
  }

  handleDiagnosticsStatusNotification(args, headers, req) {
    // Get the charging station
    return global.storage.getChargingStation(headers.chargeBoxIdentity).then((chargingStation) => {
      // Found?
      if (chargingStation) {
        // Save
        return chargingStation.saveDiagnosticsStatusNotification(args);
      }
    }).then(() => {
      // Log
      Logging.logInfo({
        userFullName: "System", source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleDiagnosticsStatusNotification",
        action: "DiagnosticsStatusNotification", message: `Diagnostics Status Notification saved successfully`,
        detailedMessages: args });

      return {
        "diagnosticsStatusNotificationResponse": {
        }
      };
    }).catch((err) => {
      // Log
      Logging.logError({
        userFullName: "System", source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleDiagnosticsStatusNotification",
        action: "DiagnosticsStatusNotification", message: err.toString(),
        detailedMessages: err.stack });

      return {
        "diagnosticsStatusNotificationResponse": {
        }
      };
    });
  }

  handleFirmwareStatusNotification(args, headers, req) {
    // Get the charging station
    return global.storage.getChargingStation(headers.chargeBoxIdentity).then((chargingStation) => {
      // Found?
      if (chargingStation) {
        // Save
        return chargingStation.saveFirmwareStatusNotification(args);
      }
    }).then(() => {
      // Log
      Logging.logInfo({
        userFullName: "System", source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleFirmwareStatusNotification",
        action: "FirmwareStatusNotification", message: `Firmware Status Notification saved successfully`,
        detailedMessages: args });

      return {
        "firmwareStatusNotificationResponse": {
        }
      };
    }).catch((err) => {
      // Log
      Logging.logError({
        userFullName: "System", source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleFirmwareStatusNotification",
        action: "FirmwareStatusNotification", message: err.toString(),
        detailedMessages: err.stack });

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
    return global.storage.getChargingStation(headers.chargeBoxIdentity).then((chargingStation) => {
      // Found?
      if (chargingStation) {
        // Save
        return chargingStation.saveStartTransaction(args);
      } else {
        // Reject but save ok
        return Promise.reject( new Error(`Transaction rejected: Charging Station  ${headers.chargeBoxIdentity} does not exist`) );
      }
    }).then(() => {
      // Log
      Logging.logInfo({
        userFullName: "System", source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleStartTransaction",
        action: "StartTransaction", message: `Start Transaction saved successfully`,
        detailedMessages: args });

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
    }).catch((err) => {
      // Log
      Logging.logError({
        userFullName: "System", source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleStartTransaction",
        action: "StartTransaction", message: err.toString(),
        detailedMessages: err.stack });

      return {
        "startTransactionResponse": {
          "transactionId": args.transactionId,
          "idTagInfo": {
            "status": "Invalid"
  //          "expiryDate": "",
  //          "parentIdTag": ""
          }
        }
      };
    });
  }

  handleDataTransfer(args, headers, req) {
    // Get the charging station
    return global.storage.getChargingStation(headers.chargeBoxIdentity).then((chargingStation) => {
      // Found?
      if (chargingStation) {
        // Save
        return chargingStation.saveDataTransfer(args);
      }
    }).then(() => {
      // Log
      Logging.logInfo({
        userFullName: "System", source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleDataTransfer",
        action: "DataTransfer", message: `Data Transfer saved successfully`,
        detailedMessages: args });

      return {
        "dataTransferResponse": {
          "status": "Accepted"
  //        "data": ""
        }
      };
    }).catch((err) => {
      // Log
      Logging.logError({
        userFullName: "System", source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleDataTransfer",
        action: "DataTransfer", message: err.toString(),
        detailedMessages: err.stack });

      return {
        "dataTransferResponse": {
          "status": "Rejected"
        }
      };
    });
  }

  handleStopTransaction(args, headers, req) {
    // Get the charging station
    return global.storage.getChargingStation(headers.chargeBoxIdentity).then((chargingStation) => {
      // Found?
      if (chargingStation) {
        // Save
        return chargingStation.saveStopTransaction(args);
      }
    }).then(() => {
      // Log
      Logging.logInfo({
        userFullName: "System", source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleStopTransaction",
        action: "StopTransaction", message: `Stop Transaction saved successfully`,
        detailedMessages: args });

      // Success
      return {
        "stopTransactionResponse": {
          "idTagInfo": {
            "status": "Accepted"
  //          "expiryDate": "",
  //          "parentIdTag": "",
          }
        }
      };
    }).catch((err) => {
      // Log
      Logging.logError({
        userFullName: "System", source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleStopTransaction",
        action: "Stop Transaction", message: err.toString(),
        detailedMessages: err.stack });

      // Error
      return {
        "stopTransactionResponse": {
          "idTagInfo": {
            "status": "Invalid"
  //          "expiryDate": "",
  //          "parentIdTag": "",
          }
        }
      };
    });
  }
}

module.exports = CentralSystemServer;
