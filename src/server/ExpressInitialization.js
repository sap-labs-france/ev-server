const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const hpp = require('hpp');
const bodyParser = require("body-parser");
require('body-parser-xml')(bodyParser);
const locale = require('locale');
const http = require('http');
const https = require('https');
const fs = require('fs');
const CFLog = require('cf-nodejs-logging-support');
const Configuration = require('../utils/Configuration');
const Logging = require('../utils/Logging');
const Constants = require('../utils/Constants');

module.exports = {
  expressCommonInit: function (bodyLimit = '1mb') {
    const app = express();
    // Secure the application
    app.use(helmet());
    // Cross origin headers
    app.use(cors());
    // Body parser
    app.use(bodyParser.json({
      limit: bodyLimit
    }));
    app.use(bodyParser.urlencoded({
      extended: false,
      limit: bodyLimit
    }));
    app.use(hpp());
    app.use(bodyParser.xml());
    // Use
    app.use(locale(Configuration.getLocalesConfig().supported));
    // Check Cloud Foundry
    if (Configuration.isCloudFoundry()) {
      // Bind to express app
      app.use(CFLog.logNetwork);
    }
    return app;
  },

  expressStartServer: function (serverConfig, serverName, serverModuleName, expressApp, listenCb = null) {
    // Default listen callback
    function defaultListenCb() {
      // Log
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        module: serverModuleName,
        method: "start", action: "Startup",
        message: `${serverName} Server listening on '${serverConfig.protocol}://${server.address().address}:${server.address().port}'`
      });
      // eslint-disable-next-line no-console
      console.log(`${serverName} Server listening on '${serverConfig.protocol}://${server.address().address}:${server.address().port}'`);
    }
    let cb;
    if (listenCb !== null && typeof listenCb === 'function') {
      cb = listenCb
    } else {
      cb = defaultListenCb
    }
    let server;
    // Log
    // eslint-disable-next-line no-console
    console.log(`Starting ${serverName} Server...`);
    // Create the HTTP server
    if (serverConfig.protocol == "https") {
      // Create the options
      const options = {};
      // Set the keys
      options.key = fs.readFileSync(serverConfig["ssl-key"]);
      options.cert = fs.readFileSync(serverConfig["ssl-cert"]);
      // Intermediate cert?
      if (serverConfig["ssl-ca"]) {
        // Array?
        if (Array.isArray(serverConfig["ssl-ca"])) {
          options.ca = [];
          // Add all
          for (let i = 0; i < serverConfig["ssl-ca"].length; i++) {
            options.ca.push(fs.readFileSync(serverConfig["ssl-ca"][i]));
          }
        } else {
          // Add one
          options.ca = fs.readFileSync(serverConfig["ssl-ca"]);
        }
      }
      // Https server
      server = https.createServer(options, expressApp);
    } else {
      // Http server
      server = http.createServer(expressApp);
    }

    // Listen;
    if (serverConfig.host && serverConfig.port) {
      server.listen(serverConfig.port, serverConfig.host, cb);
    } else if (!serverConfig.host && serverConfig.port) {
      server.listen(serverConfig.port, cb);
    } else {
      // eslint-disable-next-line no-console
      console.log(`Fail to start the ${serverName} Server, missing required port configuration`)
    }

    return server;
  }
}