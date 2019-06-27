import morgan from 'morgan';
import SourceMap from 'source-map-support';
import Constants from '../../utils/Constants';
import expressTools from '../ExpressTools';
import Logging from '../../utils/Logging';
import OCPIErrorHandler from './OCPIErrorHandler';
import OCPIServices from './OCPIServices';
SourceMap.install();

const MODULE_NAME = 'OCPIServer';
export default class OCPIServer {
  private ocpiRestConfig: any;
  private express: any;

  // Create the rest server
  constructor(ocpiRestConfig) {
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
    // Register Error Handler
    this.express.use(OCPIErrorHandler.errorHandler);
  }

  // Start the server
  start() {
    expressTools.startServer(this.ocpiRestConfig, expressTools.createHttpServer(this.ocpiRestConfig, this.express), 'OCPI', MODULE_NAME);
  }
}

