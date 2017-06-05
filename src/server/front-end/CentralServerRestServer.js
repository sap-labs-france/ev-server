var ChargingStation = require('../../model/ChargingStation');
var CentralServerRestAuthentication = require('./CentralServerRestAuthentication');
var CentralServerRestService = require('./CentralServerRestService');
var Utils = require('../../utils/Utils');
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

class CentralSystemRestServer {
  // Create the rest server
  constructor(centralSystemRestConfig) {
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
    express.use(CentralServerRestAuthentication.initialize());

    // Auth services
    express.use('/auth', CentralServerRestAuthentication.authService);

    // Secured API
    express.use('/client/api', CentralServerRestAuthentication.authenticate(), CentralServerRestService.restServiceSecured);

    // Util API
    express.use('/client/util', CentralServerRestService.restServiceUtil);

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
    server.listen(_centralSystemRestConfig.port, _centralSystemRestConfig.host, () => {
      // Log
      Logging.logInfo({
        userFullName: "System", source: "Central Server", module: "CentralServerRestServer", method: "start",
        message: `Central Rest Server (Front-End) started on '${_centralSystemRestConfig.protocol}://${server.address().address}:${server.address().port}'` });
      console.log(`Central Rest Server (Front-End) started on '${_centralSystemRestConfig.protocol}://${server.address().address}:${server.address().port}'`);
    });
  }
}

module.exports = CentralSystemRestServer;
