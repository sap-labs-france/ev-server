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
const ODataServerFactory = require('../odata/ODataServerFactory');
const ODataSchema = require('./odata-schema/ODataSchema');
require('source-map-support').install();

let _oDataServerConfig;

class ODataServer {
  // Create the rest server
  constructor(oDataServerConfig) {
    // Keep params
    _oDataServerConfig = oDataServerConfig;
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
    if (oDataServerConfig.debug) {
      // Log
      express.use(
        morgan('combined', {
          'stream': {
            write: (message) => {
              // Log
              Logging.logDebug({
                module: "ODataServer",
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
    //  Register ODATAServer
    const oDataServerFactory = new ODataServerFactory();
    const odataServer = oDataServerFactory.getODataServer();
    express.use('/odata',
      ODataSchema.getSchema,
      function (req, res) {
        odataServer.handle(req, res);
      });
    // Register Error Handler
    // express.use(OCPIErrorHandler.errorHandler);
  }

  // Start the server (to be defined in sub-classes)
  start() {
    let server;
    // Log
    console.log(`Starting ODataServer ...`); // eslint-disable-line
    // Create the HTTP server
    if (_oDataServerConfig.protocol == "https") {
      // Create the options
      const options = {};
      // Set the keys
      options.key = fs.readFileSync(_oDataServerConfig["ssl-key"]);
      options.cert = fs.readFileSync(_oDataServerConfig["ssl-cert"]);
      // Intermediate cert?
      if (_oDataServerConfig["ssl-ca"]) {
        // Array?
        if (Array.isArray(_oDataServerConfig["ssl-ca"])) {
          options.ca = [];
          // Add all
          for (let i = 0; i < _oDataServerConfig["ssl-ca"].length; i++) {
            options.ca.push(fs.readFileSync(_oDataServerConfig["ssl-ca"][i]));
          }
        } else {
          // Add one
          options.ca = fs.readFileSync(_oDataServerConfig["ssl-ca"]);
        }
      }
      // Https server
      server = https.createServer(options, express);
    } else {
      //Http server
      server = http.createServer(express);
    }

    // Listen
    server.listen(_oDataServerConfig.port, _oDataServerConfig.host, () => {
      // Log
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        module: "ODataServer",
        method: "start", action: "Startup",
        message: `OData Server listening on '${_oDataServerConfig.protocol}://${server.address().address}:${server.address().port}'`
      });
      console.log(`OData Server listening on '${_oDataServerConfig.protocol}://${server.address().address}:${server.address().port}'`); // eslint-disable-line
    });
  }
}

module.exports = ODataServer;