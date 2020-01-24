import morgan from 'morgan';
import Constants from '../../utils/Constants';
import expressTools from '../ExpressTools';
import Logging from '../../utils/Logging';
import OCPIServices from './OCPIServices';
import { Application, NextFunction, Request, Response } from 'express';
import { Configuration } from '../../types/configuration/Configuration';
import { TenantIdHoldingRequest } from './AbstractOCPIService';

const MODULE_NAME = 'OCPIServer';
export default class OCPIServer {
  private ocpiRestConfig: Configuration['OCPIService'];
  private express: Application;

  // Create the rest server
  constructor(ocpiRestConfig: Configuration['OCPIService']) {
    // Keep params
    this.ocpiRestConfig = ocpiRestConfig;
    // Initialize express app
    this.express = expressTools.init();
    // Log to console
    if (this.ocpiRestConfig.debug) {
      // Log
      this.express.use(
        morgan('combined', {
          'stream': {
            write: (message) => {
              // Log
              Logging.logDebug({
                tenantID: Constants.DEFAULT_TENANT,
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
    // New OCPI Services Instances
    const ocpiServices = new OCPIServices(this.ocpiRestConfig);
    // OCPI versions
    this.express.use(Constants.OCPI_SERVER_CPO_PATH + Constants.OCPI_VERSIONS_PATH, (req: Request, res: Response) => ocpiServices.getCPOVersions(req, res));
    this.express.use(Constants.OCPI_SERVER_EMSP_PATH + Constants.OCPI_VERSIONS_PATH, (req: Request, res: Response) => ocpiServices.getEMSPVersions(req, res));
    // Register all services in express
    ocpiServices.getOCPIServiceImplementations().forEach((ocpiService) => {
      this.express.use(ocpiService.getPath(), async (req: TenantIdHoldingRequest, res: Response, next: NextFunction) => await ocpiService.restService(req, res, next));
    });
  }

  // Start the server
  start() {
    expressTools.startServer(this.ocpiRestConfig, expressTools.createHttpServer(this.ocpiRestConfig, this.express), 'OCPI', MODULE_NAME);
  }
}

