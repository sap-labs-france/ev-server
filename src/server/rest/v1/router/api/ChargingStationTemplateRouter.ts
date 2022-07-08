/* eslint-disable max-len */
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
    this.buildRouteChargingStationTemplateCreate();
    this.buildRouteChargingStationTemplates();
    this.buildRouteChargingStationTemplate();
    this.buildRouteChargingStationTemplateDelete();
    this.buildRouteChargingStationTemplateUpdate();
    return this.router;
  }

  private buildRouteChargingStationTemplates(): void {
    this.router.get(`/${RESTServerRoute.REST_CHARGING_STATION_TEMPLATES}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(ChargingStationTemplateService.handleGetChargingStationTemplates.bind(this), ServerAction.CHARGING_STATION_TEMPLATES, req, res, next);
    });
  }

  private buildRouteChargingStationTemplate(): void {
    this.router.get(`/${RESTServerRoute.REST_CHARGING_STATION_TEMPLATE}`, (req: Request, res: Response, next: NextFunction) => {
      req.body.id = req.params.id;
      void RouterUtils.handleRestServerAction(ChargingStationTemplateService.handleGetChargingStationTemplate.bind(this), ServerAction.CHARGING_STATION_TEMPLATE, req, res, next);
    });
  }

  private buildRouteChargingStationTemplateCreate(): void {
    this.router.post(`/${RESTServerRoute.REST_CHARGING_STATION_TEMPLATES}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(ChargingStationTemplateService.handleCreateChargingStationTemplate.bind(this), ServerAction.CHARGING_STATION_TEMPLATE_CREATE, req, res, next);
    });
  }

  private buildRouteChargingStationTemplateDelete(): void {
    this.router.delete(`/${RESTServerRoute.REST_CHARGING_STATION_TEMPLATE}`, (req: Request, res: Response, next: NextFunction) => {
      req.body.id = req.params.id;
      void RouterUtils.handleRestServerAction(ChargingStationTemplateService.handleDeleteChargingStationTemplate.bind(this), ServerAction.CHARGING_STATION_TEMPLATE_DELETE, req, res, next);
    });
  }

  private buildRouteChargingStationTemplateUpdate(): void {
    this.router.put(`/${RESTServerRoute.REST_CHARGING_STATION_TEMPLATE}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(ChargingStationTemplateService.handleUpdateChargingStationTemplate.bind(this), ServerAction.CHARGING_STATION_TEMPLATE_UPDATE, req, res, next);
    });
  }
}
