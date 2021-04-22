import AbstractOCPIService, { TenantIdHoldingRequest } from './AbstractOCPIService';
import { Application, NextFunction, Request, Response } from 'express';

import CPOService211 from './ocpi-services-impl/ocpi-2.1.1/CPOService';
import EMSPService211 from './ocpi-services-impl/ocpi-2.1.1/EMSPService';
import ExpressUtils from '../ExpressUtils';
import OCPIServiceConfiguration from '../../types/configuration/OCPIServiceConfiguration';
import OCPIServices from './OCPIServices';

const MODULE_NAME = 'OCPIServer';

export default class OCPIServer {
  private ocpiRestConfig: OCPIServiceConfiguration;
  private expressApplication: Application;

  // Create the rest server
  constructor(ocpiRestConfig: OCPIServiceConfiguration) {
    // Keep params
    this.ocpiRestConfig = ocpiRestConfig;
    // Initialize express app
    this.expressApplication = ExpressUtils.initApplication(null, ocpiRestConfig.debug);
    // New OCPI Services Instances
    const ocpiServices = new OCPIServices(this.ocpiRestConfig);
    // OCPI versions
    this.expressApplication.use(CPOService211.PATH + AbstractOCPIService.VERSIONS_PATH,
      (req: Request, res: Response, next: NextFunction) => ocpiServices.getCPOVersions(req, res, next));
    this.expressApplication.use(EMSPService211.PATH + AbstractOCPIService.VERSIONS_PATH,
      (req: Request, res: Response, next: NextFunction) => ocpiServices.getEMSPVersions(req, res, next));
    // Register all services in express
    for (const ocpiService of ocpiServices.getOCPIServiceImplementations()) {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      this.expressApplication.use(ocpiService.getPath(), async (req: TenantIdHoldingRequest, res: Response, next: NextFunction) => {
        try {
          await ocpiService.restService(req, res, next);
        } catch (error) {
          next(error);
        }
      });
    }
    // Post init
    ExpressUtils.postInitApplication(this.expressApplication);
  }

  // Start the server
  start(): void {
    ExpressUtils.startServer(this.ocpiRestConfig, ExpressUtils.createHttpServer(this.ocpiRestConfig, this.expressApplication), 'OCPI', MODULE_NAME);
  }
}

