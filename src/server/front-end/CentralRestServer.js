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
var express = require('express')();
var http = require('http');
var https = require('https');
var fs = require('fs');

let _centralSystemRestConfig;
let _io;

class CentralSystemRestServer {
  // Create the rest server
  constructor(centralSystemRestConfig) {
    // Body parser
    express.use(bodyParser.json({limit: '5mb'}));
    express.use(bodyParser.urlencoded({ extended: false, limit: '5mb' }));
    express.use(bodyParser.xml());

    // Use
    express.use(locale(Configuration.getLocalesConfig().supported));

    // log to console
    if (centralSystemRestConfig.debug) {
      express.use(morgan('dev'));
    }

    // Cross origin headers
    express.use(cors());

    // Secure the application
    express.use(helmet());

    // Authentication
    express.use(CentralRestServerAuthentication.initialize());

    // Auth services
    express.use('/auth', CentralRestServerAuthentication.authService);

    // Secured API
    express.use('/client/api', CentralRestServerAuthentication.authenticate(), CentralRestServerService.restServiceSecured);

    // Util API
    express.use('/client/util', CentralRestServerService.restServiceUtil);

    // Keep params
    _centralSystemRestConfig = centralSystemRestConfig;
  }

  // Start the server (to be defined in sub-classes)
  start() {
    var server;
    // Create the HTTP server
    if (_centralSystemRestConfig.protocol === "https") {
      // Create the options
      const options = {
        key: fs.readFileSync(_centralSystemRestConfig["ssl-key"]),
        cert: fs.readFileSync(_centralSystemRestConfig["ssl-cert"])
      };
      // Https server
      server = https.createServer(options, express);
    } else {
      // Http server
      server = http.createServer(express);
    }

    // Init Socket IO
    _io = require("socket.io")(server);

    // Handle Socket IO connection
    _io.on("connection", (socket) => {
      console.log("CONNECTION SOCKET IO DONE");

      // Handle Socket IO connection
      socket.on("disconnect", () =>{
        console.log("DISCONNET SOCKET");
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
    // Notify
    this.notifyAllWebSocketClients(CentralRestServerAuthorization.ENTITY_USER, {
      "action": CentralRestServerAuthorization.ACTION_UPDATE,
      "id": user.id
    });
  }

  notifyUserCreated(user) {
    // Notify
    this.notifyAllWebSocketClients(CentralRestServerAuthorization.ENTITY_USER, {
      "action": CentralRestServerAuthorization.ACTION_CREATE,
      "id": user.id
    });
  }

  notifyAllWebSocketClients(entity, entityDetails) {
    // Notify all
    _io.sockets.emit(entity, entityDetails);
  }
}

module.exports = CentralSystemRestServer;
