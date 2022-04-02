/* eslint-disable @typescript-eslint/no-misused-promises */
import { OCPIServerRoute, ServerAction } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import CPOLocationsService from '../../../service/cpo/v2.1.1/CPOLocationsService';
import RouterUtils from '../../../../../utils/RouterUtils';

export default class CPOLocationsRouterV211 {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteGetLocations();
    return this.router;
  }

  protected buildRouteGetLocations(): void {
    this.router.get(`/${OCPIServerRoute.OCPI_LOCATIONS}*`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleOCPIServerAction(CPOLocationsService.handleGetLocations.bind(this), ServerAction.OCPI_CPO_GET_LOCATIONS, req, res, next);
    });
  }
}
