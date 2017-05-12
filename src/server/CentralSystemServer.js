var ChargingStation = require('../model/ChargingStation');
var Utils = require('../utils/Utils');
var ChargingStationBackgroundTasks = require('./ChargingStationBackgroundTasks');
var Logging = require('../utils/Logging');
var bodyParser = require("body-parser");
require('body-parser-xml')(bodyParser);
var cors = require('cors');
var cookieParser = require('cookie-parser')()
var helmet = require('helmet');
var passport = require('passport');
var JwtStrategy = require('passport-jwt').Strategy;
var ExtractJwt = require('passport-jwt').ExtractJwt;
var LocalStrategy = require('passport-local').Strategy;
var ChargingStationRestService = require('./ChargingStationRestService');
var expressSession = require('express-session')({
    secret: 's3A92797boeiBhxQDM1GInRith',
    resave: false,
    saveUninitialized: true,
    cookie: { httpOnly: true, maxAge: 2419200000 },
    secure: true })

let _serverConfig;
let _chargingStationConfig;

const allowedOrigins = [
  'http://localhost:8080',
  'http://37.71.38.82:8080'];

class CentralSystemServer {
  constructor(serverConfig, chargingStationConfig, express) {
    if (new.target === CentralSystemServer) {
      throw new TypeError("Cannot construct CentralSystemServer instances directly");
    }

    // Check the charging station status...
    setInterval(ChargingStationBackgroundTasks.executeAllBackgroundTasks, 15 * 1000);

    // Body parser
    express.use(bodyParser.json());
    express.use(bodyParser.urlencoded({ extended: false }));
    express.use(bodyParser.xml());

    // Cross origin headers
    // express.use(cors());

    // Cookies
    express.use(cookieParser);

    // Use session
    express.use(expressSession);

    // Secure the application
    express.use(helmet());

    // Authentication
    passport.use(new LocalStrategy({usernameField: 'email', session: true},
      function(email, password, done) {
        // Check email
        global.storage.getUserByEmail(email).then(function(user) {
          if (user) {
            return done(null, user.getModel());
          } else {
            return done(null, false);
          }
          next();
        }).catch((err) => {
          // Log
          return done(err, false);
        });
      }
    ));
    // // Init JWT auth
    // var opts = {};
    // opts.secretOrKey = 'secret';
    // opts.jwtFromRequest = ExtractJwt.fromAuthHeader();
    // // opts.issuer = 'evse-dashboard';
    // // opts.audience = 'yoursite.net';
    // passport.use(new JwtStrategy(opts, function(jwtPayload, done) {
    //   // Check the user
    //   global.storage.getUser(jwtPayload.sub).then(function(user) {
    //     if (user) {
    //       return done(null, user.getModel());
    //     } else {
    //       return done(null, false);
    //     }
    //     next();
    //   }).catch((err) => {
    //     // Log
    //     return done(err, false);
    //   });
    // }));

    passport.serializeUser(function(user, done) {
      done(null, user.id);
    });

    passport.deserializeUser(function(id, done) {
      // Check email
      global.storage.getUser(id).then(function(user) {
        if (user) {
          return done(null, user.getModel());
        } else {
          return done(null, null);
        }
        next();
      }).catch((err) => {
        // Log
        return done(err, null);
      });
    });

    // Authentication
    express.use(passport.initialize());
    express.use(passport.session());

    // Cross Origin
    express.use((request, response, next) => {
      var origin = request.headers.origin;
      if (allowedOrigins.indexOf(origin) > -1) {
        response.setHeader('Access-Control-Allow-Origin', origin);
      }
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Requested-With');
      response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,HEAD,DELETE,OPTIONS');
      response.setHeader('Access-Control-Allow-Credentials', true);
      // Check
      if (request.method === "OPTIONS") {
        response.end();
      } else {
        next();
      }
    });

    // Login
    express.post('/auth/login', passport.authenticate('local', {}),
      function(req, res) {
        res.status(200).send({});
    });

    // Logout
    express.get('/auth/logout',
      function(req, res) {
        // Get rid of the session token. Then call `logout`; it does no harm.
        req.logout();
        req.session.destroy();
        res.status(200).send({});
    });

    // Receive REST request to trigger action to the charging station remotely (reboot...)
    express.use('/client/api', this.isAuthenticated, ChargingStationRestService);

    // Ping
    express.get('/ping', function(req, res) {
      res.status(200).send({});
    });

    // Keep params
    _serverConfig = serverConfig;
    _chargingStationConfig = chargingStationConfig;
  }

  isAuthenticated(req, res, next) {
    if (!req.isAuthenticated()) {
      res.status(401).send();
    } else {
      next();
    }
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
          source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleBootNotification",
          action: "BootNotification",
          message: `Charging Station saved successfully`,
          detailedMessages: chargingStation.getModel() });
        // Save the Boot Notification
        return chargingStation.saveBootNotification(args);
      }).then(() => {
        // Log
        Logging.logInfo({
          source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleBootNotification",
          action: "BootNotification",
          message: `Boot Notification saved successfully`,
          detailedMessages: args });

        // Get the Charging Station Config
        return chargingStation.requestConfiguration();
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
          source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleBootNotification",
          action: "BootNotification",
          message: `Charging Station Configuration saved successfully` });

        // Return the result
        // OCPP 1.6
        if (args.ocppVersion === "1.6") {
          return {
            "bootNotificationResponse": {
              "status": 'Accepted',
              "currentTime": new Date().toISOString(),
              "interval": _chargingStationConfig.heartbeatInterval
            }
          };
          // OCPP 1.2 && 1.5
        } else {
          return {
            "bootNotificationResponse": {
              "status": 'Accepted',
              "currentTime": new Date().toISOString(),
              "heartbeatInterval": _chargingStationConfig.heartbeatInterval
            }
          };
        }
      }).catch((err) => {
        // Log
        Logging.logError({
          source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleBootNotification",
          action: "BootNotification",
          message: err.toString(),
          detailedMessages: err.stack });
        // Reject
        return {
          "bootNotificationResponse": {
            "status": 'Rejected',
            "currentTime": new Date().toISOString(),
            "heartbeatInterval": _chargingStationConfig.heartbeatInterval
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
            source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleHeartBeat",
            action: "HeartBeat",
            message: `HeartBeat saved successfully`,
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
      Logging.logWarning({
        source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleHeartBeat",
        action: "HeartBeat",
        message: `Error when processing the Heart Beat: ${err.toString()}`,
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
        source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleStatusNotification",
        action: "StatusNotification",
        message: `Status Notification saved successfully`,
        detailedMessages: args });

      return {
        "statusNotificationResponse": {
        }
      };
    }).catch((err) => {
      // Log
      Logging.logWarning({
        source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleStatusNotification",
        action: "StatusNotification",
        message: err.toString(),
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
      Logging.logWarning({
        source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleMeterValues",
        action: "MeterValues",
        message: `Error when processing the Meter Values: ${err.toString()}`,
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
        source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleAuthorize",
        action: "Authorize",
        message: `Authorize saved successfully`,
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
        source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleAuthorize",
        action: "Authorize",
        message: err.toString(),
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
        source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleDiagnosticsStatusNotification",
        action: "DiagnosticsStatusNotification",
        message: `Diagnostics Status Notification saved successfully`,
        detailedMessages: args });

      return {
        "diagnosticsStatusNotificationResponse": {
        }
      };
    }).catch((err) => {
      // Log
      Logging.logWarning({
        source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleDiagnosticsStatusNotification",
        action: "DiagnosticsStatusNotification",
        message: err.toString(),
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
        source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleFirmwareStatusNotification",
        action: "FirmwareStatusNotification",
        message: `Firmware Status Notification saved successfully`,
        detailedMessages: args });

      return {
        "firmwareStatusNotificationResponse": {
        }
      };
    }).catch((err) => {
      // Log
      Logging.logWarning({
        source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleFirmwareStatusNotification",
        action: "FirmwareStatusNotification",
        message: err.toString(),
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
        source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleStartTransaction",
        action: "StartTransaction",
        message: `Start Transaction saved successfully`,
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
        source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleStartTransaction",
        action: "StartTransaction",
        message: err.toString(),
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
        source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleDataTransfer",
        action: "DataTransfer",
        message: `Data Transfer saved successfully`,
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
        source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleDataTransfer",
        action: "DataTransfer",
        message: err.toString(),
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
        source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleStopTransaction",
        action: "StopTransaction",
        message: `Stop Transaction saved successfully`,
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
        source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleStopTransaction",
        action: "Stop Transaction",
        message: err.toString(),
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
