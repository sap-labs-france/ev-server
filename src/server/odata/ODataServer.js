const morgan = require('morgan');
const expressTools = require('../ExpressTools');
// const compression = require('compression');
const Configuration = require('../../utils/Configuration');
const Logging = require('../../utils/Logging');
const ODataServerFactory = require('../odata/ODataServerFactory');
const ODataSchema = require('./odata-schema/ODataSchema');

require('source-map-support').install();

const MODULE_NAME = "ODataServer";

class ODataServer {
  // Create the rest server
  constructor(oDataServerConfig) {
    // Keep params
    this._oDataServerConfig = oDataServerConfig;
    // Initialize express app
    this._express = expressTools.init();
    // Log to console
    if (this._oDataServerConfig.debug) {
      // Log
      this._express.use(
        morgan('combined', {
          'stream': {
            write: (message) => {
              // Log
              Logging.logDebug({
                module: MODULE_NAME,
                method: "constructor",
                action: "HttpRequestLog",
                message: message
              });
            }
          }
        })
      );
    }
    // Use Compression
    // this._express.use(compression());
    // Get URL of the CentralSystemRestServer
    const restConf = Configuration.getCentralSystemRestServer();
    const restServerUrl = `${restConf.protocol}://${restConf.host}:${restConf.port}/`;

    // Register ODataServer
    const oDataServerFactory = new ODataServerFactory();
    const oDataServer = oDataServerFactory.getODataServer();
    oDataServer.restServerUrl = restServerUrl;
    ODataSchema.restServerUrl = restServerUrl;
    this._express.use('/odata',
      ODataSchema.getSchema,
      function (req, res) {
        oDataServer.handle(req, res);
      });
    // Register Error Handler
    // this._express.use(OCPIErrorHandler.errorHandler);
  }

  // Start the server
  start() {
    expressTools.startServer(this._oDataServerConfig, expressTools.createHttpServer(this._oDataServerConfig, this._express), "OData", MODULE_NAME);
  }
}

module.exports = ODataServer;