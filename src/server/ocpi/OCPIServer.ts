import { Application, NextFunction, Request, Response } from 'express';
import { ServerAction, ServerType } from '../../types/Server';

import AppError from '../../exception/AppError';
import Constants from '../../utils/Constants';
import ExpressUtils from '../ExpressUtils';
import GlobalRouter from './router/GlobalRouter';
import { HTTPError } from '../../types/HTTPError';
import Logging from '../../utils/Logging';
import OCPIEndpointStorage from '../../storage/mongodb/OCPIEndpointStorage';
import OCPIServiceConfiguration from '../../types/configuration/OCPIServiceConfiguration';
import OCPIServices from './OCPIServices';
import { OCPIStatusCode } from '../../types/ocpi/OCPIStatusCode';
import OCPIUtils from './OCPIUtils';
import { ServerUtils } from '../ServerUtils';
import { StatusCodes } from 'http-status-codes';
import { TenantComponents } from '../../types/Tenant';
import { TenantIdHoldingRequest } from './AbstractOCPIService';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'OCPIServer';

export default class OCPIServer {
  private ocpiRestConfig: OCPIServiceConfiguration;
  private expressApplication: Application;

  // Create the rest server
  public constructor(ocpiRestConfig: OCPIServiceConfiguration) {
    // Keep params
    this.ocpiRestConfig = ocpiRestConfig;
    // Initialize express app
    this.expressApplication = ExpressUtils.initApplication(null, ocpiRestConfig.debug);
    // Authenticate
    this.expressApplication.use(this.initialize.bind(this));
    // Log Express Request
    this.expressApplication.use(Logging.traceExpressRequest.bind(this));
    // Routers
    this.expressApplication.use('/ocpi', new GlobalRouter().buildRoutes());
    // const ocpiServices = new OCPIServices(this.ocpiRestConfig);
    // // Register all services in express
    // for (const ocpiService of ocpiServices.getOCPIServiceImplementations()) {
    //   // eslint-disable-next-line @typescript-eslint/no-misused-promises
    //   this.expressApplication.use(ocpiService.getPath(), async (req: TenantIdHoldingRequest, res: Response, next: NextFunction) => {
    //     try {
    //       await ocpiService.restService(req, res, next);
    //     } catch (error) {
    //       next(error);
    //     }
    //   });
    // }
    // Post init
    ExpressUtils.postInitApplication(this.expressApplication);
  }

  // Start the server
  public start(): void {
    ServerUtils.startHttpServer(this.ocpiRestConfig, ServerUtils.createHttpServer(this.ocpiRestConfig, this.expressApplication), MODULE_NAME, ServerType.OCPI_SERVER);
  }

  private async initialize(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Get Token
      if (!req.headers || !req.headers.authorization) {
        throw new AppError({
          module: MODULE_NAME, method: 'initialize',
          action: ServerAction.OCPI_ENDPOINT,
          errorCode: StatusCodes.UNAUTHORIZED,
          message: 'Missing authorization token',
          ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
        });
      }
      let decodedToken: { tenant: string; tid: string };
      const token = req.headers.authorization.split(' ')[1];
      try {
        decodedToken = JSON.parse(OCPIUtils.atob(token));
      } catch (error) {
        throw new AppError({
          module: MODULE_NAME, method: 'initialize',
          action: ServerAction.OCPI_ENDPOINT,
          errorCode: StatusCodes.UNAUTHORIZED,
          message: 'Invalid authorization token',
          ocpiError: OCPIStatusCode.CODE_3000_GENERIC_SERVER_ERROR,
          detailedMessages: { error: error.stack }
        });
      }
      const tenantSubdomain = decodedToken.tenant ?? decodedToken.tid;
      // Get Tenant
      const tenant = await TenantStorage.getTenantBySubdomain(tenantSubdomain);
      if (!tenant) {
        throw new AppError({
          module: MODULE_NAME, method: 'initialize',
          action: ServerAction.OCPI_ENDPOINT,
          errorCode: StatusCodes.UNAUTHORIZED,
          message: `The Tenant '${tenantSubdomain}' does not exist`,
          ocpiError: OCPIStatusCode.CODE_3000_GENERIC_SERVER_ERROR
        });
      }
      req.tenant = tenant;
      if (!Utils.isTenantComponentActive(tenant, TenantComponents.OCPI)) {
        throw new AppError({
          module: MODULE_NAME, method: 'initialize',
          action: ServerAction.OCPI_ENDPOINT,
          errorCode: StatusCodes.UNAUTHORIZED,
          message: `The Tenant '${tenantSubdomain}' does not support OCPI`,
          ocpiError: OCPIStatusCode.CODE_3000_GENERIC_SERVER_ERROR
        });
      }
      // Get Endpoint
      const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpointByLocalToken(tenant, token);
      if (!ocpiEndpoint) {
        throw new AppError({
          module: MODULE_NAME, method: 'initialize',
          action: ServerAction.OCPI_ENDPOINT,
          errorCode: StatusCodes.UNAUTHORIZED,
          message: 'Invalid Token',
          ocpiError: OCPIStatusCode.CODE_3000_GENERIC_SERVER_ERROR
        });
      }
      req.ocpiEndpoint = ocpiEndpoint;
      // Check that the Token belongs to the right role (CPO or EMSP)
      if (!req.url.includes(ocpiEndpoint.role.toLocaleLowerCase())) {
        throw new AppError({
          module: MODULE_NAME, method: 'initialize',
          action: ServerAction.OCPI_ENDPOINT,
          errorCode: StatusCodes.UNAUTHORIZED,
          message: `Invalid Token for URL '${req.url}' (endpoint URL: '${ocpiEndpoint.versionUrl}')`,
          ocpiError: OCPIStatusCode.CODE_3000_GENERIC_SERVER_ERROR
        });
      }
      next();
    } catch (error) {
      await Logging.logActionExceptionMessage(req.tenant?.id ?? Constants.DEFAULT_TENANT_ID, error.params?.action ?? ServerAction.OCPI_ENDPOINT, error);
      res.status(error.params?.errorCode ?? HTTPError.GENERAL_ERROR).json(OCPIUtils.toErrorResponse(error));
    }
  }
}
