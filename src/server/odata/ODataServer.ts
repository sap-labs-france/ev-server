import morgan from 'morgan';
import Configuration from '../../utils/Configuration';
import expressTools from '../ExpressTools';
import Logging from '../../utils/Logging';
import ODataSchema from './odata-schema/ODataSchema';
import ODataServerFactory from '../odata/ODataServerFactory';

import SourceMap from 'source-map-support';
SourceMap.install();

const MODULE_NAME = 'ODataServer';
export default class ODataServer {
  private oDataServerConfig: any;
  private express: any;

  // Create the rest server
  constructor(oDataServerConfig) {
    // Keep params
    this.oDataServerConfig = oDataServerConfig;
    // Initialize express app
    this.express = expressTools.init();
    // Log to console
    if (this.oDataServerConfig.debug) {
      // Log
      this.express.use(
        morgan('combined', {
          'stream': {
            write: (message) => {
              // Log
              Logging.logDebug({
                module: MODULE_NAME,
                method: 'constructor',
                action: 'HttpRequestLog',
                message: message
              });
            }
          }
        })
      );
    }
    // Get URL of the CentralSystemRestServer
    const restConf = Configuration.getCentralSystemRestServer();
    const restServerUrl = `${restConf.protocol}://${restConf.host}:${restConf.port}/`;

    // Register ODataServer
    const oDataServerFactory = new ODataServerFactory();
    const oDataServer = oDataServerFactory.getODataServer();
    oDataServer.restServerUrl = restServerUrl;
    ODataSchema.restServerUrl = restServerUrl;
    this.express.use('/odata',
      ODataSchema.getSchema,
      function(req, res) {
        oDataServer.handle(req, res);
      }
    );
  }

  // Start the server
  start() {
    expressTools.startServer(this.oDataServerConfig, expressTools.createHttpServer(this.oDataServerConfig, this.express), 'OData', MODULE_NAME);
  }
}

