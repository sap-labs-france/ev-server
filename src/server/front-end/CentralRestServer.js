const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const locale = require('locale');
const express = require('express')();
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const sanitize = require('mongo-sanitize');
const bodyParser = require("body-parser");
const CFLog = require('cf-nodejs-logging-support');
require('body-parser-xml')(bodyParser);
const CentralRestServerAuthentication = require('./CentralRestServerAuthentication');
const CentralRestServerService = require('./CentralRestServerService');
const Database = require('../../utils/Database');
const Configuration = require('../../utils/Configuration');
const Logging = require('../../utils/Logging');
const Constants = require('../../utils/Constants');
const ErrorHandler = require('./ErrorHandler');
require('source-map-support').install();

let _centralSystemRestConfig;
let _chargingStationConfig;
let _socketIO;
let _currentNotifications = [];

class CentralRestServer {
  // Create the rest server
  constructor(centralSystemRestConfig, chargingStationConfig){
    // Keep params
    _centralSystemRestConfig = centralSystemRestConfig;
    _chargingStationConfig = chargingStationConfig;

    // Set
    Database.setChargingStationHeartbeatIntervalSecs(
      _chargingStationConfig.heartbeatIntervalSecs);

    // Body parser
    express.use(bodyParser.json({
      limit: '1mb'
    }));
    express.use(bodyParser.urlencoded({
      extended: false,
      limit: '1mb'
    }));
    express.use(bodyParser.xml());

    // Use
    express.use(locale(Configuration.getLocalesConfig().supported));

    // log to console
    if (centralSystemRestConfig.debug) {
      // Log
      express.use(
        morgan('combined', {
          'stream': {
            write: (message) => {
              // Log
              Logging.logDebug({
                tenantID: Constants.DEFAULT_TENANT,
                module: "CentralRestServer",
                method: "constructor",
                action: "HttpRequestLog",
                message: message
              });
            }
          }
        })
      );
    }

    // Cross origin headers
    express.use(cors());

    // Secure the application
    express.use(helmet());

    // Check Cloud Foundry
    if (Configuration.isCloudFoundry()) {
      // Bind to express app
      express.use(CFLog.logNetwork);
    }

    // Authentication
    express.use(CentralRestServerAuthentication.initialize());

    // Auth services
    express.use('/client/auth', CentralRestServerAuthentication.authService);

    // Secured API
    express.use('/client/api', CentralRestServerAuthentication.authenticate(), CentralRestServerService.restServiceSecured);

    // Util API
    express.use('/client/util', CentralRestServerService.restServiceUtil);

    // Register error handler
    express.use(ErrorHandler.errorHandler);

    // Check if the front-end has to be served also
    let centralSystemConfig = Configuration.getCentralSystemFrontEndConfig();
    // Server it?
    if (centralSystemConfig.distEnabled) {
      // Serve all the static files of the front-end
      express.get(/^\/(?!client\/)(.+)$/, function(req, res, next){
        // Filter to not handle other server requests
        if (!res.headersSent) {
          // Not already processed: serve the file
          res.sendFile(path.join(__dirname, centralSystemConfig.distPath, sanitize(req.params[0])));
        }
      });
      // Default, serve the index.html
      express.get('/', function(req, res, next){
        // Return the index.html
        res.sendFile(path.join(__dirname, centralSystemConfig.distPath, 'index.html'));
      });
    }
  }

  // Start the server (to be defined in sub-classes)
  start(){
    let server;
    // Log
    console.log(`Starting Central Rest Server (Front-End)...`);
    // Create the HTTP server
    if (_centralSystemRestConfig.protocol == "https") {
      // Create the options
      var options = {};
      // Set the keys
      options.key = fs.readFileSync(_centralSystemRestConfig["ssl-key"]);
      options.cert = fs.readFileSync(_centralSystemRestConfig["ssl-cert"]);
      // Intermediate cert?
      if (_centralSystemRestConfig["ssl-ca"]) {
        // Array?
        if (Array.isArray(_centralSystemRestConfig["ssl-ca"])) {
          options.ca = [];
          // Add all
          for (var i = 0; i < _centralSystemRestConfig["ssl-ca"].length; i++) {
            options.ca.push(fs.readFileSync(_centralSystemRestConfig["ssl-ca"][i]));
          }
        } else {
          // Add one
          options.ca = fs.readFileSync(_centralSystemRestConfig["ssl-ca"]);
        }
      }
      // Https server
      server = https.createServer(options, express);
    } else {
      // Http server
      server = http.createServer(express);
    }

    // Init Socket IO
    _socketIO = require("socket.io")(server);
    // Handle Socket IO connection
    _socketIO.on("connection", (socket) => {
      socket.join(socket.handshake.query.tenantID);
      // Handle Socket IO connection
      socket.on("disconnect", () => {
        // Nothing to do
      });
    });

    // Listen
    server.listen(_centralSystemRestConfig.port, _centralSystemRestConfig.host, () => {
      // Check and send notif
      setInterval(() => {
        // Send
        for (var i = _currentNotifications.length - 1; i >= 0; i--) {
          // console.log(`****** Notify '${_currentNotifications[i].entity}', Action '${(_currentNotifications[i].action?_currentNotifications[i].action:'')}', Data '${(_currentNotifications[i].data ? JSON.stringify(_currentNotifications[i].data, null, ' ') : '')}'`);
          // Notify all Web Sockets
          _socketIO.to(_currentNotifications[i].tenantID).emit(_currentNotifications[i].entity, _currentNotifications[i]);
          // Remove
          _currentNotifications.splice(i, 1);
        }
      }, _centralSystemRestConfig.webSocketNotificationIntervalSecs * 1000);

      // Log
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        module: "CentralServerRestServer",
        method: "start", action: "Startup",
        message: `Central Rest Server (Front-End) listening on '${_centralSystemRestConfig.protocol}://${server.address().address}:${server.address().port}'`
      });
      console.log(`Central Rest Server (Front-End) listening on '${_centralSystemRestConfig.protocol}://${server.address().address}:${server.address().port}'`);
    });
  }

  notifyUser(tenantID, action, data){
    // Add in buffer
    this.addNotificationInBuffer({
      "tenantID": tenantID,
      "entity": Constants.ENTITY_USER,
      "action": action,
      "data": data
    });
    // Add in buffer
    this.addNotificationInBuffer({
      "tenantID": tenantID,
      "entity": Constants.ENTITY_USERS
    });
  }

  notifyVehicle(tenantID, action, data){
    // Add in buffer
    this.addNotificationInBuffer({
      "tenantID": tenantID,
      "entity": Constants.ENTITY_VEHICLE,
      "action": action,
      "data": data
    });
    // Add in buffer
    this.addNotificationInBuffer({
      "tenantID": tenantID,
      "entity": Constants.ENTITY_VEHICLES
    });
  }

  notifyVehicleManufacturer(tenantID, action, data){
    // Add in buffer
    this.addNotificationInBuffer({
      "tenantID": tenantID,
      "entity": Constants.ENTITY_VEHICLE_MANUFACTURER,
      "action": action,
      "data": data
    });
    // Add in buffer
    this.addNotificationInBuffer({
      "tenantID": tenantID,
      "entity": Constants.ENTITY_VEHICLE_MANUFACTURERS
    });
  }

  notifyTenant(tenantID, action, data){
    // Add in buffer
    this.addNotificationInBuffer({
      "tenantID": tenantID,
      "entity": Constants.ENTITY_TENANT,
      "action": action,
      "data": data
    });
    // Add in buffer
    this.addNotificationInBuffer({
      "tenantID": tenantID,
      "entity": Constants.ENTITY_TENANTS
    });
  }

  notifySite(tenantID, action, data){
    // Add in buffer
    this.addNotificationInBuffer({
      "tenantID": tenantID,
      "entity": Constants.ENTITY_SITE,
      "action": action,
      "data": data
    });
    // Add in buffer
    this.addNotificationInBuffer({
      "tenantID": tenantID,
      "entity": Constants.ENTITY_SITES
    });
  }

  notifySiteArea(tenantID, action, data){
    // Add in buffer
    this.addNotificationInBuffer({
      "tenantID": tenantID,
      "entity": Constants.ENTITY_SITE_AREA,
      "action": action,
      "data": data
    });
    // Add in buffer
    this.addNotificationInBuffer({
      "tenantID": tenantID,
      "entity": Constants.ENTITY_SITE_AREAS
    });
  }

  notifyCompany(tenantID, action, data){
    // Add in buffer
    this.addNotificationInBuffer({
      "tenantID": tenantID,
      "entity": Constants.ENTITY_COMPANY,
      "action": action,
      "data": data
    });
    // Add in buffer
    this.addNotificationInBuffer({
      "tenantID": tenantID,
      "entity": Constants.ENTITY_COMPANIES
    });
  }

  notifyTransaction(tenantID, action, data){
    // Add in buffer
    this.addNotificationInBuffer({
      "tenantID": tenantID,
      "entity": Constants.ENTITY_TRANSACTION,
      "action": action,
      "data": data
    });
    // Add in buffer
    this.addNotificationInBuffer({
      "tenantID": tenantID,
      "entity": Constants.ENTITY_TRANSACTIONS
    });
  }

  notifyChargingStation(tenantID, action, data){
    // Add in buffer
    this.addNotificationInBuffer({
      "tenantID": tenantID,
      "entity": Constants.ENTITY_CHARGING_STATION,
      "action": action,
      "data": data
    });
    // Add in buffer
    this.addNotificationInBuffer({
      "tenantID": tenantID,
      "entity": Constants.ENTITY_CHARGING_STATIONS
    });
  }

  notifyLogging(tenantID, action){
    // Add in buffer
    this.addNotificationInBuffer({
      "tenantID": tenantID,
      "entity": Constants.ENTITY_LOGGINGS,
      "action": action
    });
  }

  addNotificationInBuffer(notification){
    let dups = false;
    // Add in buffer
    for (var i = 0; i < _currentNotifications.length; i++) {
      // Same Entity and Action?
      if (_currentNotifications[i].tenantID === notification.tenantID
        && _currentNotifications[i].entity === notification.entity
        && _currentNotifications[i].action === notification.action) {
        // Yes
        dups = true;
        // Data provided: Check Id and Type
        if (_currentNotifications[i].data &&
          (_currentNotifications[i].data.id !== notification.data.id ||
            _currentNotifications[i].data.type !== notification.data.type)) {
          dups = false;
        } else {
          break;
        }
      }
    }
    // Found dups?
    if (!dups) {
      // No: Add it
      _currentNotifications.push(notification);
    }
  }
}

module.exports = CentralRestServer;