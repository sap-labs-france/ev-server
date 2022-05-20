/* eslint-disable @typescript-eslint/no-misused-promises */
import { OCPIServerRoute, ServerAction } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import EMSPLocationsService from '../../../service/emsp/v2.1.1/EMSPLocationsService';
import RouterUtils from '../../../../../utils/RouterUtils';

export default class EMSPLocationsRouterV211 {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRoutePutLocation();
    this.buildRoutePatchLocation();
    return this.router;
  }

  protected buildRoutePutLocation(): void {
    this.router.put(`/${OCPIServerRoute.OCPI_LOCATIONS}*`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleOCPIServerAction(EMSPLocationsService.handlePutLocation.bind(this), ServerAction.OCPI_EMSP_UPDATE_LOCATION, req, res, next);
    });
  }

  protected buildRoutePatchLocation(): void {
    this.router.patch(`/${OCPIServerRoute.OCPI_LOCATIONS}*`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleOCPIServerAction(EMSPLocationsService.handlePatchLocation.bind(this), ServerAction.OCPI_EMSP_UPDATE_LOCATION, req, res, next);
    });
  }
}
