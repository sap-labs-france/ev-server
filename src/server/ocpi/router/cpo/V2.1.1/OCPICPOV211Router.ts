import { OCPIServerRoute, ServerAction } from '../../../../../types/Server';
/* eslint-disable @typescript-eslint/no-misused-promises */
import express, { NextFunction, Request, Response } from 'express';

import CPOLocationsService from '../../../service/cpo/v2.1.1/CPOLocationsService';
import RouterUtils from '../../../../../utils/RouterUtils';

export default class OCPICPOV211Router {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteCpoLocations();
    return this.router;
  }

  protected buildRouteCpoLocations(): void {
    this.router.get(`/${OCPIServerRoute.OCPI_LOCATIONS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(CPOLocationsService.handleGetLocations.bind(this), ServerAction.OCPI_CPO_GET_LOCATIONS, req, res, next);
    });
  }
}
