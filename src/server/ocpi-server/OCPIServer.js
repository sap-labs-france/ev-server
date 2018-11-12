const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const locale = require('locale');
const express = require('express')();
const http = require('http');
// const https = require('https');
// const fs = require('fs');
// const path = require('path');
// const sanitize = require('mongo-sanitize');
const bodyParser = require("body-parser");
const CFLog = require('cf-nodejs-logging-support');
require('body-parser-xml')(bodyParser);
// const CentralRestServerAuthentication = require('./CentralRestServerAuthentication');
// const CentralRestServerService = require('./CentralRestServerService');
// const Database = require('../../utils/Database');
const Configuration = require('../../utils/Configuration');
const Logging = require('../../utils/Logging');
const Constants = require('../../utils/Constants');
// const ErrorHandler = require('./ErrorHandler');
require('source-map-support').install();

let _ocpiRestConfig;

class OCPIServer {
  // Create the rest server
  constructor(ocpiRestConfig) {
    // Keep params
    _ocpiRestConfig = ocpiRestConfig;

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
    if (ocpiRestConfig.debug) {
      // Log
      express.use(
        morgan('combined', {
          'stream': {
            write: (message) => {
              // Log
              Logging.logDebug({
                module: "OCPIServer",
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
    // express.use(CentralRestServerAuthentication.initialize());

    // Auth services
    // express.use('/client/auth', CentralRestServerAuthentication.authService);

    // Secured API
    // express.use('/client/api', CentralRestServerAuthentication.authenticate(), CentralRestServerService.restServiceSecured);

    // Util API
    // express.use('/client/util', CentralRestServerService.restServiceUtil);

    // Register error handler
    // express.use(ErrorHandler.errorHandler);

    // Check if the front-end has to be served also
    // const centralSystemConfig = Configuration.getCentralSystemFrontEndConfig();
    // // Server it?
    // if (centralSystemConfig.distEnabled) {
    //   // Serve all the static files of the front-end
    //   express.get(/^\/(?!client\/)(.+)$/, function(req, res, next) {
    //     // Filter to not handle other server requests
    //     if (!res.headersSent) {
    //       // Not already processed: serve the file
    //       res.sendFile(path.join(__dirname, centralSystemConfig.distPath, sanitize(req.params[0])));
    //     }
    //   });
    //   // Default, serve the index.html
    //   express.get('/', function(req, res, next) {
    //     // Return the index.html
    //     res.sendFile(path.join(__dirname, centralSystemConfig.distPath, 'index.html'));
    //   });
    // }
  }

  // Start the server (to be defined in sub-classes)
  start() {
    let server;
    // Log
    console.log(`Starting OCPI Server ...`);
    // Create the HTTP server
    // if (_centralSystemRestConfig.protocol == "https") {
    //   // Create the options
    //   const options = {};
    //   // Set the keys
    //   options.key = fs.readFileSync(_centralSystemRestConfig["ssl-key"]);
    //   options.cert = fs.readFileSync(_centralSystemRestConfig["ssl-cert"]);
    //   // Intermediate cert?
    //   if (_centralSystemRestConfig["ssl-ca"]) {
    //     // Array?
    //     if (Array.isArray(_centralSystemRestConfig["ssl-ca"])) {
    //       options.ca = [];
    //       // Add all
    //       for (let i = 0; i < _centralSystemRestConfig["ssl-ca"].length; i++) {
    //         options.ca.push(fs.readFileSync(_centralSystemRestConfig["ssl-ca"][i]));
    //       }
    //     } else {
    //       // Add one
    //       options.ca = fs.readFileSync(_centralSystemRestConfig["ssl-ca"]);
    //     }
    //   }
    //   // Https server
    //   server = https.createServer(options, express);
    // } else {
      // Http server
    server = http.createServer(express);
    // }

    // Init Socket IO
    // _socketIO = require("socket.io")(server);
    // // Handle Socket IO connection
    // _socketIO.on("connection", (socket) => {
    //   socket.join(socket.handshake.query.tenantID);
    //   // Handle Socket IO connection
    //   socket.on("disconnect", () => {
    //     // Nothing to do
    //   });
    // });

    // Listen
    server.listen(_ocpiRestConfig.port, _ocpiRestConfig.host);
    // server.listen(_centralSystemRestConfig.port, _centralSystemRestConfig.host, () => {
    //   // Check and send notif
    //   setInterval(() => {
    //     // Send
    //     for (let i = _currentNotifications.length - 1; i >= 0; i--) {
    //       // console.log(`****** Notify '${_currentNotifications[i].entity}', Action '${(_currentNotifications[i].action?_currentNotifications[i].action:'')}', Data '${(_currentNotifications[i].data ? JSON.stringify(_currentNotifications[i].data, null, ' ') : '')}'`);
    //       // Notify all Web Sockets
    //       _socketIO.to(_currentNotifications[i].tenantID).emit(_currentNotifications[i].entity, _currentNotifications[i]);
    //       // Remove
    //       _currentNotifications.splice(i, 1);
    //     }
    //   }, _centralSystemRestConfig.webSocketNotificationIntervalSecs * 1000);

    //   // Log
    Logging.logInfo({
      tenantID: Constants.DEFAULT_TENANT,
      module: "CentralServerRestServer",
      method: "start", action: "Startup",
      message: `Central Rest Server (Front-End) listening on '${_ocpiRestConfig.protocol}://${server.address().address}:${server.address().port}'`
    });
    
    console.log(`Central Rest Server (Front-End) listening on '${_ocpiRestConfig.protocol}://${server.address().address}:${server.address().port}'`);
    // });
  }

 
}

module.exports = OCPIServer;