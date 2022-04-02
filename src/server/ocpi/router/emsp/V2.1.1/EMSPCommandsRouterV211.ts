/* eslint-disable @typescript-eslint/no-misused-promises */
import { OCPIServerRoute, ServerAction } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import EMSPCommandsService from '../../../service/emsp/v2.1.1/EMSPCommandsService';
import RouterUtils from '../../../../../utils/RouterUtils';

export default class EMSPCdrsREMSPCommandsRouterV211uterV211 {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteCommand();
    return this.router;
  }

  protected buildRouteCommand(): void {
    this.router.post(`/${OCPIServerRoute.OCPI_COMMANDS}*`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleOCPIServerAction(EMSPCommandsService.handleCommand.bind(this), ServerAction.OCPI_EMSP_COMMAND, req, res, next);
    });
  }
}
