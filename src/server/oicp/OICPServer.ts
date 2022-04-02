import { Application, NextFunction, Response } from 'express';

import ExpressUtils from '../ExpressUtils';
import OICPServiceConfiguration from '../../types/configuration/OICPServiceConfiguration';
import OICPServices from './OICPServices';
import { ServerType } from '../../types/Server';
import { ServerUtils } from '../ServerUtils';
import { TenantIdHoldingRequest } from './AbstractOICPService';

const MODULE_NAME = 'OICPServer';

export default class OICPServer {
  private oicpRestConfig: OICPServiceConfiguration;
  private expressApplication: Application;

  public constructor(oicpRestConfig: OICPServiceConfiguration) {
    // Keep params
    this.oicpRestConfig = oicpRestConfig;
    // Initialize express app
    this.expressApplication = ExpressUtils.initApplication(null, oicpRestConfig.debug);
    // New OICP Services Instances
    const oicpServices = new OICPServices(this.oicpRestConfig);
    // Register all services in express
    oicpServices.getOICPServiceImplementations().forEach((oicpService) => {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      this.expressApplication.use(oicpService.getPath(), async (req: TenantIdHoldingRequest, res: Response, next: NextFunction) => {
        try {
          await oicpService.restService(req, res, next);
        } catch (error) {
          next(error);
        }
      });
    });
    // Post init
    ExpressUtils.postInitApplication(this.expressApplication);
  }

  public start(): void {
    ServerUtils.startHttpServer(this.oicpRestConfig,
      ServerUtils.createHttpServer(this.oicpRestConfig, this.expressApplication), MODULE_NAME, ServerType.OICP_SERVER);
  }
}

