/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/no-misused-promises */
import { RESTServerRoute, ServerAction } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import ChargingStationTemplateService from '../../service/ChargingStationTemplateService';
import RouterUtils from '../../../../../utils/RouterUtils';
import sanitize from 'mongo-sanitize';

export default class ChargingStationTemplateRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteChargingStationCreateChargingTemplates();
    this.buildRouteChargingStationTemplates();
    this.buildRouteChargingStationTemplate();
    return this.router;
  }

  private buildRouteChargingStationTemplates(): void {
    this.router.get(`/${RESTServerRoute.REST_CHARGING_STATION_TEMPLATES}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleRestServerAction(ChargingStationTemplateService.handleGetChargingStationTemplates.bind(this), ServerAction.CHARGING_STATION_TEMPLATES, req, res, next);
    });
  }

  private buildRouteChargingStationTemplate(): void {
    this.router.get(`/${RESTServerRoute.REST_CHARGING_STATION_TEMPLATE}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = sanitize(req.params.id);
      await RouterUtils.handleRestServerAction(ChargingStationTemplateService.handleGetChargingStationTemplate.bind(this), ServerAction.CHARGING_STATION_TEMPLATE, req, res, next);
    });
  }

  private buildRouteChargingStationCreateChargingTemplates(): void {
    this.router.post(`/${RESTServerRoute.REST_CHARGING_STATION_TEMPLATE_CREATE}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleRestServerAction(ChargingStationTemplateService.handleCreateChargingStationTemplate.bind(this), ServerAction.CHARGING_PROFILE_CREATE, req, res, next);
    });
  }
}
