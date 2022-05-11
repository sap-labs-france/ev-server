import { Application } from 'express';
import AuthService from './v1/service/AuthService';
import CentralSystemRestServiceConfiguration from '../../types/configuration/CentralSystemRestServiceConfiguration';
import ExpressUtils from '../ExpressUtils';
import GlobalRouterV1 from './v1/router/GlobalRouterV1';
import RestServerService from './RestServerService';
import { ServerType } from '../../types/Server';
import { ServerUtils } from '../ServerUtils';
import SessionHashService from './v1/service/SessionHashService';
import http from 'http';

const MODULE_NAME = 'RestServer';

export default class RestServer {
  private static centralSystemRestConfig: CentralSystemRestServiceConfiguration;
  private static restHttpServer: http.Server;
  private expressApplication: Application;

  // Create the rest server
  public constructor(centralSystemRestConfig: CentralSystemRestServiceConfiguration) {
    // Keep params
    RestServer.centralSystemRestConfig = centralSystemRestConfig;
    // Initialize express app
    this.expressApplication = ExpressUtils.initApplication('1mb', centralSystemRestConfig.debug);
    // Authentication
    this.expressApplication.use(AuthService.initialize());
    // Routers
    this.expressApplication.use('/v1', new GlobalRouterV1().buildRoutes());
    // TODO: To Remove, Secured API is deprecated
    this.expressApplication.use('/client/api/:action',
      AuthService.authenticate(),
      SessionHashService.checkUserAndTenantValidity.bind(this),
      RestServerService.restServiceSecured.bind(this)
    );
    // TODO: To Remove, Util API is deprecated
    this.expressApplication.use('/client/util/:action',
      RestServerService.restServiceUtil.bind(this)
    );
    // Post init
    ExpressUtils.postInitApplication(this.expressApplication);
    // Create HTTP server to serve the express app
    RestServer.restHttpServer = ServerUtils.createHttpServer(RestServer.centralSystemRestConfig, this.expressApplication);
  }

  public start(): void {
    ServerUtils.startHttpServer(RestServer.centralSystemRestConfig, RestServer.restHttpServer, MODULE_NAME, ServerType.REST_SERVER);
  }
}
