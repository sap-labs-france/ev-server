import express from 'express';
import morgan from 'morgan';
import { Action } from '../../types/Authorization';
import Configuration from '../../utils/Configuration';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import expressTools from '../ExpressTools';
import ODataServerFactory from '../odata/ODataServerFactory';
import ODataSchema from './odata-schema/ODataSchema';
import ODataRestAdapter from './ODataRestAdapter';

const MODULE_NAME = 'ODataServer';
export default class ODataServer {
  private oDataServerConfig: any;
  private express: express.Application;

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
                tenantID: Constants.DEFAULT_TENANT,
                module: MODULE_NAME, method: 'constructor',
                action: Action.EXPRESS_SERVER,
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
    ODataRestAdapter.restServerUrl = restServerUrl;
    this.express.use(
      '/odata',
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

