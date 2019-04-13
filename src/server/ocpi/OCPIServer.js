const morgan = require('morgan');
const expressTools = require('../ExpressTools');
const Logging = require('../../utils/Logging');
const Constants = require('../../utils/Constants');
const OCPIServices = require('./OCPIServices');
const OCPIErrorHandler = require('./OCPIErrorHandler');
require('source-map-support').install();

let _ocpiRestConfig;

const MODULE_NAME = "OCPIServer";

class OCPIServer {
  // Create the rest server
  constructor(ocpiRestConfig) {
    // Keep params
    _ocpiRestConfig = ocpiRestConfig;
    // Initialize express app
    this._express = expressTools.expressCommonInit();
    // log to console
    if (ocpiRestConfig.debug) {
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
    // new OCPI Services Instances
    const ocpiServices = new OCPIServices(_ocpiRestConfig);
    // OCPI versions
    this._express.use(Constants.OCPI_SERVER_BASE_PATH, ocpiServices.getVersions);
    // Register all services in express
    ocpiServices.getOCPIServiceImplementations().forEach(ocpiService => {
      this._express.use(ocpiService.getPath(), ocpiService.restService.bind(ocpiService));
    });
    // Register Error Handler
    this._express.use(OCPIErrorHandler.errorHandler);
  }

  // Start the server
  start() {
    expressTools.expressStartServer(_ocpiRestConfig, "OCPI", MODULE_NAME, this._express);
  }
}

module.exports = OCPIServer;