import express, { NextFunction, Request, Response } from 'express';

import Configuration from '../../utils/Configuration';
import ExpressTools from '../ExpressTools';
import ODataRestAdapter from './ODataRestAdapter';
import ODataSchema from './odata-schema/ODataSchema';
import ODataServerFactory from '../odata/ODataServerFactory';
import ODataServiceConfiguration from '../../types/configuration/ODataServiceConfiguration';

const MODULE_NAME = 'ODataServer';

export default class ODataServer {
  private oDataServerConfig: ODataServiceConfiguration;
  private expressApplication: express.Application;

  // Create the rest server
  constructor(oDataServerConfig: ODataServiceConfiguration) {
    // Keep params
    this.oDataServerConfig = oDataServerConfig;
    // Initialize express app
    this.expressApplication = ExpressTools.initApplication(null, oDataServerConfig.debug);
    // Get URL of the CentralSystemRestServer
    const restConf = Configuration.getCentralSystemRestServer();
    const restServerUrl = `${restConf.protocol}://${restConf.host}:${restConf.port}/`;
    // Register ODataServer
    const oDataServerFactory = new ODataServerFactory();
    const oDataServer = oDataServerFactory.getODataServer();
    oDataServer.restServerUrl = restServerUrl;
    ODataSchema.restServerUrl = restServerUrl;
    ODataRestAdapter.restServerUrl = restServerUrl;
    this.expressApplication.use(
      '/odata',
      ODataSchema.getSchema.bind(this),
      (req: Request, res: Response, next: NextFunction) => {
        try {
          oDataServer.handle(req, res);
        } catch (error) {
          next(error);
        }
      }
    );
    // Post init
    ExpressTools.postInitApplication(this.expressApplication);
  }

  // Start the server
  start() {
    ExpressTools.startServer(this.oDataServerConfig, ExpressTools.createHttpServer(this.oDataServerConfig, this.expressApplication), 'OData', MODULE_NAME);
  }
}

