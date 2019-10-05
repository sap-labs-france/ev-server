import morgan from 'morgan';
import Constants from '../../utils/Constants';
import expressTools from '../ExpressTools';
import Logging from '../../utils/Logging';
import OCPIServices from './OCPIServices';
import { Application } from 'express';
import Config from '../../types/configuration/Config';

const MODULE_NAME = 'OCPIServer';
export default class OCPIServer {
  private ocpiRestConfig: Config['OCPIService'];
  private express: Application;

  // Create the rest server
  constructor(ocpiRestConfig: Config['OCPIService']) {
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
    this.express.use(Constants.OCPI_SERVER_BASE_PATH, ocpiServices.getVersions.bind(ocpiServices));
    // Register all services in express
    ocpiServices.getOCPIServiceImplementations().forEach((ocpiService) => {
      this.express.use(ocpiService.getPath(), ocpiService.restService.bind(ocpiService));
    });
  }

  // Start the server
  start() {
    expressTools.startServer(this.ocpiRestConfig, expressTools.createHttpServer(this.ocpiRestConfig, this.express), 'OCPI', MODULE_NAME);
  }
}

