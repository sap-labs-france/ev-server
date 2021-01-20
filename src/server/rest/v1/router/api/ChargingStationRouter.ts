import express, { NextFunction, Request, Response } from 'express';

import ChargingStationService from '../../service/ChargingStationService';
import RouterUtils from '../RouterUtils';
import { ServerAction } from '../../../../../types/Server';
import sanitize from 'mongo-sanitize';

export default class ChargingStationRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteChargingStations();
    return this.router;
  }

  protected buildRouteChargingStations(): void {
    this.router.get(`/${ServerAction.REST_CHARGING_STATIONS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(ChargingStationService.handleGetChargingStations.bind(this), ServerAction.REST_CHARGING_STATIONS, req, res, next);
    });
  }
}
