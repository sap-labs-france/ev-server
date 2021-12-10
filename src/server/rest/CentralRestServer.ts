import { Application, NextFunction, Request, Response } from 'express';

import AuthService from './v1/service/AuthService';
import CentralRestServerService from './CentralRestServerService';
import CentralSystemRestServiceConfiguration from '../../types/configuration/CentralSystemRestServiceConfiguration';
import ExpressUtils from '../ExpressUtils';
import GlobalRouter from './v1/router/GlobalRouter';
import Logging from '../../utils/Logging';
import { ServerType } from '../../types/Server';
import { ServerUtils } from '../ServerUtils';
import SessionHashService from './v1/service/SessionHashService';
import http from 'http';
import sanitize from 'express-sanitizer';

const MODULE_NAME = 'CentralRestServer';

export default class CentralRestServer {
  private static centralSystemRestConfig: CentralSystemRestServiceConfiguration;
  private static restHttpServer: http.Server;
  private expressApplication: Application;

  // Create the rest server
  constructor(centralSystemRestConfig: CentralSystemRestServiceConfiguration) {
    // Keep params
    CentralRestServer.centralSystemRestConfig = centralSystemRestConfig;
    // Initialize express app
    this.expressApplication = ExpressUtils.initApplication('2mb', centralSystemRestConfig.debug);
    // Mount express-sanitizer middleware
    this.expressApplication.use(sanitize());
    // Authentication
    this.expressApplication.use(AuthService.initialize());
    // Routers
    this.expressApplication.use('/v1', new GlobalRouter().buildRoutes());
    // Secured API
    this.expressApplication.use('/client/api/:action',
      AuthService.authenticate(),
      SessionHashService.checkUserAndTenantValidity.bind(this),
      Logging.traceExpressRequest.bind(this),
      CentralRestServerService.restServiceSecured.bind(this)
    );
    // Util API
    this.expressApplication.use('/client/util/:action',
      Logging.traceExpressRequest.bind(this),
      CentralRestServerService.restServiceUtil.bind(this)
    );
    // Post init
    ExpressUtils.postInitApplication(this.expressApplication);
    // Create HTTP server to serve the express app
    CentralRestServer.restHttpServer = ServerUtils.createHttpServer(CentralRestServer.centralSystemRestConfig, this.expressApplication);
  }

  start(): void {
    ServerUtils.startHttpServer(CentralRestServer.centralSystemRestConfig, CentralRestServer.restHttpServer, MODULE_NAME, ServerType.REST_SERVER);
  }
}
