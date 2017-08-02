var ChargingStation = require('../../model/ChargingStation');
var CentralRestServerAuthentication = require('./CentralRestServerAuthentication');
var CentralRestServerAuthorization = require('./CentralRestServerAuthorization');
var CentralRestServerService = require('./CentralRestServerService');
var Utils = require('../../utils/Utils');
var Configuration = require('../../utils/Configuration');
var Logging = require('../../utils/Logging');
var bodyParser = require("body-parser");
require('body-parser-xml')(bodyParser);
var cors = require('cors');
var helmet = require('helmet');
var morgan = require('morgan');
var locale = require('locale');
var express = require('express');
var app = require('express')();
var http = require('http');
var https = require('https');
var fs = require('fs');
var path = require('path');

let _centralSystemRestConfig;
let _io;
let _currentNotifications = [];

class CentralSystemRestServer {
  // Create the rest server
  constructor(centralSystemRestConfig) {
    // Body parser
    app.use(bodyParser.json({limit: '1mb'}));
    app.use(bodyParser.urlencoded({ extended: false, limit: '1mb' }));
    app.use(bodyParser.xml());

    // Use
    app.use(locale(Configuration.getLocalesConfig().supported));

    // log to console
    if (centralSystemRestConfig.debug) {
      app.use(morgan('dev'));
    }

    // Cross origin headers
    app.use(cors());

    // Secure the application
    app.use(helmet());

    // Authentication
    app.use(CentralRestServerAuthentication.initialize());

    // Auth services
    app.use('/client/auth', CentralRestServerAuthentication.authService);

    // Secured API
    app.use('/client/api', CentralRestServerAuthentication.authenticate(), CentralRestServerService.restServiceSecured);

    // Util API
    app.use('/client/util', CentralRestServerService.restServiceUtil);

    // Check if the front-end has to be served also
    let frontEndPath = Configuration.getCentralSystemFrontEndConfig().distPath;
    // Server it?
    if (frontEndPath) {
      // Serve all the static files of the front-end
      app.get(/^\/(?!client\/)(.+)$/, function(req, res, next) {
        // Filter to not handle other server requests
        if(!res.headersSent) {
          console.log(path.join(__dirname, frontEndPath, req.params[0]));
          // Not already processed: serve the file
          res.sendFile(path.join(__dirname, frontEndPath, req.params[0]));
        }
      });
      // Default, serve the index.html
      app.get('/', function(req, res, next) {
        // Return the index.html
        console.log(path.join(__dirname, frontEndPath, 'index.html'));
        res.sendFile(path.join(__dirname, frontEndPath, 'index.html'));
      });
    }

    // Keep params
    _centralSystemRestConfig = centralSystemRestConfig;

    // Check and send notif
    setInterval(() => {
      // Send
      for (var i = _currentNotifications.length-1; i >= 0; i--) {
        // send
        this.notifyAllWebSocketClients(_currentNotifications[i]);
        // Remove
        _currentNotifications.splice(i, 1);
      }
    }, _centralSystemRestConfig.webSocketNotificationIntervalSecs * 1000);
  }

  // Start the server (to be defined in sub-classes)
  start() {
    var server;
    // Create the HTTP server
    if (_centralSystemRestConfig.protocol === "https") {
      // Create the options
    var options = {
        key: fs.readFileSync(_centralSystemRestConfig["ssl-key"]),
        cert: fs.readFileSync(_centralSystemRestConfig["ssl-cert"])
      };
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
      server = https.createServer(options, app);
    } else {
      // Http server
      server = http.createServer(app);
    }

    // Init Socket IO
    _io = require("socket.io")(server);

    // Handle Socket IO connection
    _io.on("connection", (socket) => {
      // Handle Socket IO connection
      socket.on("disconnect", () =>{
        // Nothing to do
      });
    });

    // Listen
    server.listen(_centralSystemRestConfig.port, _centralSystemRestConfig.host, () => {
      // Log
      Logging.logInfo({
        userFullName: "System", source: "Central Server", module: "CentralServerRestServer", method: "start", action: "Startup",
        message: `Central Rest Server (Front-End) started on '${_centralSystemRestConfig.protocol}://${server.address().address}:${server.address().port}'` });
      console.log(`Central Rest Server (Front-End) started on '${_centralSystemRestConfig.protocol}://${server.address().address}:${server.address().port}'`);
    });
  }

  notifyUserUpdated(user) {
    // Add in buffer
    this.addNotificationInBuffer({
      "entity": CentralRestServerAuthorization.ENTITY_USER,
      "action": CentralRestServerAuthorization.ACTION_UPDATE,
      "id": user.id
    });
    // Add in buffer
    this.addNotificationInBuffer({
      "entity": CentralRestServerAuthorization.ENTITY_USERS
    });
  }

  notifyUserCreated(user) {
    // Add in buffer
    this.addNotificationInBuffer({
      "entity": CentralRestServerAuthorization.ENTITY_USER,
      "action": CentralRestServerAuthorization.ACTION_CREATE,
      "id": user.id
    });
    // Add in buffer
    this.addNotificationInBuffer({
      "entity": CentralRestServerAuthorization.ENTITY_USERS
    });
  }

  notifyUserDeleted(user) {
    // Add in buffer
    this.addNotificationInBuffer({
      "entity": CentralRestServerAuthorization.ENTITY_USER,
      "action": CentralRestServerAuthorization.ACTION_DELETE,
      "id": user.id
    });
    // Add in buffer
    this.addNotificationInBuffer({
      "entity": CentralRestServerAuthorization.ENTITY_USERS
    });
  }

  notifyChargingStationUpdated(chargingStation) {
    // Add in buffer
    this.addNotificationInBuffer({
      "entity": CentralRestServerAuthorization.ENTITY_CHARGING_STATION,
      "action": CentralRestServerAuthorization.ACTION_UPDATE,
      "id": chargingStation.id
    });
    // Add in buffer
    this.addNotificationInBuffer({
      "entity": CentralRestServerAuthorization.ENTITY_CHARGING_STATIONS
    });
  }

  notifyChargingStationCreated(chargingStation) {
    // Add in buffer
    this.addNotificationInBuffer({
      "entity": CentralRestServerAuthorization.ENTITY_CHARGING_STATION,
      "action": CentralRestServerAuthorization.ACTION_CREATE,
      "id": chargingStation.id
    });
    // Add in buffer
    this.addNotificationInBuffer({
      "entity": CentralRestServerAuthorization.ENTITY_CHARGING_STATIONS
    });
  }

  notifyChargingStationDeleted(chargingStation) {
    // Add in buffer
    this.addNotificationInBuffer({
      "entity": CentralRestServerAuthorization.ENTITY_CHARGING_STATION,
      "action": CentralRestServerAuthorization.ACTION_DELETE,
      "id": chargingStation.id
    });
    // Add in buffer
    this.addNotificationInBuffer({
      "entity": CentralRestServerAuthorization.ENTITY_CHARGING_STATIONS
    });
  }

  notifyLoggingCreated() {
    // Add in buffer
    this.addNotificationInBuffer({
      "entity": CentralRestServerAuthorization.ENTITY_LOGGING,
      "action": CentralRestServerAuthorization.ACTION_CREATE,
    });
  }

  addNotificationInBuffer(notification) {
    let dups = false;
    // Add in buffer
    for (var i = 0; i < _currentNotifications.length; i++) {
      if (_currentNotifications[i].entity === notification.entity &&
          _currentNotifications[i].action === notification.action &&
          _currentNotifications[i].id === notification.id) {
        dups = true;
      }
    }
    // Found dups?
    if (!dups) {
      // No: Add it
      _currentNotifications.push(notification);
    }
  }

  notifyAllWebSocketClients(notification) {
    // Action?
    if (notification.action) {
      // Notify all with action
      _io.sockets.emit(notification.entity, {
        "action": notification.action,
        "id": notification.id
      });
    } else {
      // Notify all without action
      _io.sockets.emit(notification.entity, {});
    }
  }
}

module.exports = CentralSystemRestServer;
