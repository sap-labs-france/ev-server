/* eslint-disable @typescript-eslint/no-misused-promises */
import { OCPIServerRoute, ServerAction } from '../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import CPOEMSPCredentialsRouterV211 from '../common/V2.1.1/CPOEMSPCredentialsRouterV211';
import EMSPCdrsRouterV211 from './V2.1.1/EMSPCdrsRouterV211';
import EMSPCommandsRouterV211 from './V2.1.1/EMSPCommandsRouterV211';
import EMSPLocationsRouterV211 from './V2.1.1/EMSPLocationsRouterV211';
import EMSPSessionsRouterV211 from './V2.1.1/EMSPSessionsRouterV211';
import EMSPTokensRouterV211 from './V2.1.1/EMSPTokensRouterV211';
import EMSPVersionsService from '../../service/emsp/EMSPVersionsService';
import RouterUtils from '../../../../utils/RouterUtils';

export default class EMSPRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteEmspVersions();
    this.buildRouteEmspV211();
    return this.router;
  }

  protected buildRouteEmspVersions(): void {
    this.router.get(`/${OCPIServerRoute.OCPI_VERSIONS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(EMSPVersionsService.handleGetVersions.bind(this), ServerAction.OCPI_GET_VERSIONS, req, res, next);
    });
  }

  protected buildRouteEmspV211(): void {
    this.router.use('/2.1.1', [
      new EMSPTokensRouterV211().buildRoutes(),
      new EMSPLocationsRouterV211().buildRoutes(),
      new EMSPSessionsRouterV211().buildRoutes(),
      new EMSPCdrsRouterV211().buildRoutes(),
      new EMSPCommandsRouterV211().buildRoutes(),
      new CPOEMSPCredentialsRouterV211().buildRoutes(),
    ]);
  }
}
