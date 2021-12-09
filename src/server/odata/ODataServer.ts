import { Application, NextFunction, Request, Response } from 'express';

import Configuration from '../../utils/Configuration';
import ExpressUtils from '../ExpressUtils';
import Logging from '../../utils/Logging';
import ODataRestAdapter from './ODataRestAdapter';
import ODataSchema from './odata-schema/ODataSchema';
import ODataServerFactory from '../odata/ODataServerFactory';
import ODataServiceConfiguration from '../../types/configuration/ODataServiceConfiguration';
import { ServerType } from '../../types/Server';
import { ServerUtils } from '../ServerUtils';

const MODULE_NAME = 'ODataServer';

export default class ODataServer {
  private oDataServerConfig: ODataServiceConfiguration;
  private expressApplication: Application;

  // Create the rest server
  constructor(oDataServerConfig: ODataServiceConfiguration) {
    // Keep params
    this.oDataServerConfig = oDataServerConfig;
    // Initialize express app
    this.expressApplication = ExpressUtils.initApplication(null, oDataServerConfig.debug);
    // Log Express Request
    this.expressApplication.use(Logging.traceExpressRequest.bind(this));
    // Get URL of the CentralSystemRestServer
    const restConf = Configuration.getCentralSystemRestServerConfig();
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
    // Not found
    this.expressApplication.use((req: Request, res: Response, next: NextFunction) => {
      res.status(404);
      res.format({
        html: () => res.send(`404: ${req.url}`),
        json: () => res.json({ error: `404: ${req.url}` }),
        default: () => res.type('txt').send(`404: ${req.url}`)
      });
    });
    // Post init
    ExpressUtils.postInitApplication(this.expressApplication);
  }

  // Start the server
  start(): void {
    ServerUtils.startHttpServer(this.oDataServerConfig,
      ServerUtils.createHttpServer(this.oDataServerConfig, this.expressApplication), MODULE_NAME, ServerType.ODATA_SERVER);
  }
}

