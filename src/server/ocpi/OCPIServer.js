const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const locale = require('locale');
const express = require('express')();
const http = require('http');
const https = require('https');
const fs = require('fs');
const bodyParser = require("body-parser");
const CFLog = require('cf-nodejs-logging-support');
require('body-parser-xml')(bodyParser);
const Configuration = require('../../utils/Configuration');
const Logging = require('../../utils/Logging');
const Constants = require('../../utils/Constants');
const OCPIServices = require('./OCPIServices');
const OCPIErrorHandler = require('./OCPIErrorHandler');
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
    // new OCPI Services Instances
    const ocpiServices = new OCPIServices(_ocpiRestConfig);
    // OCPI versions
    express.use('/ocpi/cpo/versions', ocpiServices.getVersions);
    // Register all services in express
    ocpiServices.getOCPIServiceImplementations().forEach(ocpiService => {
      express.use(ocpiService.getPath(), ocpiService.restService.bind(ocpiService));
    });
    // Register Error Handler
    express.use(OCPIErrorHandler.errorHandler);
  }

  // Start the server (to be defined in sub-classes)
  start() {
    let server;
    // Log
    console.log(`Starting OCPI Server ...`); // eslint-disable-line
    // Create the HTTP server
    if (_ocpiRestConfig.protocol == "https") {
      // Create the options
      const options = {};
      // Set the keys
      options.key = fs.readFileSync(_ocpiRestConfig["ssl-key"]);
      options.cert = fs.readFileSync(_ocpiRestConfig["ssl-cert"]);
      // Intermediate cert?
      if (_ocpiRestConfig["ssl-ca"]) {
        // Array?
        if (Array.isArray(_ocpiRestConfig["ssl-ca"])) {
          options.ca = [];
          // Add all
          for (let i = 0; i < _ocpiRestConfig["ssl-ca"].length; i++) {
            options.ca.push(fs.readFileSync(_ocpiRestConfig["ssl-ca"][i]));
          }
        } else {
          // Add one
          options.ca = fs.readFileSync(_ocpiRestConfig["ssl-ca"]);
        }
      }
      // Https server
      server = https.createServer(options, express);
    } else {
      //Http server
      server = http.createServer(express);
    }

    // Listen
    server.listen(_ocpiRestConfig.port, _ocpiRestConfig.host, () => {
      // Log
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        module: "OCPIServer",
        method: "start", action: "Startup",
        message: `OCPI Server listening on '${_ocpiRestConfig.protocol}://${server.address().address}:${server.address().port}'`
      });
      console.log(`OCPI Server listening on '${_ocpiRestConfig.protocol}://${server.address().address}:${server.address().port}'`); // eslint-disable-line
    });
  }
}

module.exports = OCPIServer;