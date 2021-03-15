import { Application, NextFunction, Response } from 'express';

import ExpressTools from '../ExpressTools';
import OICPServiceConfiguration from '../../types/configuration/OICPServiceConfiguration';
import OICPServices from './OICPServices';
import { TenantIdHoldingRequest } from './AbstractOICPService';

const MODULE_NAME = 'OICPServer';

export default class OICPServer {
  private oicpRestConfig: OICPServiceConfiguration;
  private expressApplication: Application;

  // Create the rest server
  constructor(oicpRestConfig: OICPServiceConfiguration) {
    // Keep params
    this.oicpRestConfig = oicpRestConfig;
    // Initialize express app
    this.expressApplication = ExpressTools.initApplication(null, oicpRestConfig.debug);
    // New OICP Services Instances
    const oicpServices = new OICPServices(this.oicpRestConfig);
    // Register all services in express
    oicpServices.getOICPServiceImplementations().forEach((oicpService) => {
      this.expressApplication.use(oicpService.getPath(), async (req: TenantIdHoldingRequest, res: Response, next: NextFunction) => {
        try {
          await oicpService.restService(req, res, next);
        } catch (error) {
          next(error);
        }
      });
    });
    // Post init
    ExpressTools.postInitApplication(this.expressApplication);
  }

  // Start the server
  async start(): Promise<void> {
    ExpressTools.startServer(this.oicpRestConfig, ExpressTools.createHttpServer(this.oicpRestConfig, this.expressApplication), 'OICP', MODULE_NAME);
  }
}

