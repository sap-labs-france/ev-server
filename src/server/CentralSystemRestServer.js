var ChargingStation = require('../model/ChargingStation');
var Utils = require('../utils/Utils');
var ServerBackgroundTasks = require('./ServerBackgroundTasks');
var Logging = require('../utils/Logging');
var bodyParser = require("body-parser");
require('body-parser-xml')(bodyParser);
var cors = require('cors');
var helmet = require('helmet');
var ServerRestService = require('./ServerRestService');
var morgan = require('morgan');
var locale = require('locale');
var ServerRestAuthentication = require('./ServerRestAuthentication');
var express = require('express')();
var http = require('http');
var https = require('https');
var fs = require('fs');

let _centralSystemRestConfig;

class CentralSystemRestServer {
  // Create the rest server
  constructor(centralSystemRestConfig) {
    // Check the charging station status...
    setInterval(ServerBackgroundTasks.executeAllBackgroundTasks, 15 * 1000);

    // Body parser
    express.use(bodyParser.json({limit: '5mb'}));
    express.use(bodyParser.urlencoded({ extended: false, limit: '5mb' }));
    express.use(bodyParser.xml());

    // Use
    express.use(locale(Utils.getLocalesConfig().supported));

    // log to console
    express.use(morgan('dev'));

    // Cross origin headers
    express.use(cors());

    // Secure the application
    express.use(helmet());

    // Authentication
    express.use(ServerRestAuthentication.initialize());

    // Auth services
    express.use('/auth', ServerRestAuthentication.authService);

    // Secured API
    express.use('/client/api', ServerRestAuthentication.authenticate(), ServerRestService.restServiceSecured);

    // Util API
    express.use('/client/util', ServerRestService.restServiceUtil);

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

    // Listen
    server.listen(_centralSystemRestConfig.port, function(req, res) {
      // Log
      Logging.logInfo({
        source: "Central Rest Server", module: "CentralSystemRest", method: "start",
        message: `Central Rest Server started on '${_centralSystemRestConfig.protocol}://localhost:${_centralSystemRestConfig.port}'` });
      console.log(`Central Rest Server started on '${_centralSystemRestConfig.protocol}://localhost:${_centralSystemRestConfig.port}'`);
    });
  }
}

module.exports = CentralSystemRestServer;
