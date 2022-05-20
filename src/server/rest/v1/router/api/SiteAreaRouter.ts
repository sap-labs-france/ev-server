import { RESTServerRoute, ServerAction } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import RouterUtils from '../../../../../utils/RouterUtils';
import SiteAreaService from '../../service/SiteAreaService';

export default class SiteAreaRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteSiteAreas();
    this.buildRouteSiteArea();
    this.buildRouteCreateSiteArea();
    this.buildRouteGetSiteAreaConsumption();
    this.buildRouteUpdateSiteArea();
    this.buildRouteDeleteSiteArea();
    this.buildRouteAssignChargingStationsToSiteArea();
    this.buildRouteRemoveChargingStationsFromSiteArea();
    this.buildRouteAssignAssetsToSiteArea();
    this.buildRouteRemoveAssetsToSiteArea();
    return this.router;
  }

  private buildRouteSiteAreas(): void {
    this.router.get(`/${RESTServerRoute.REST_SITE_AREAS}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(SiteAreaService.handleGetSiteAreas.bind(this), ServerAction.SITE_AREAS, req, res, next);
    });
  }

  private buildRouteSiteArea(): void {
    this.router.get(`/${RESTServerRoute.REST_SITE_AREA}`, (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      void RouterUtils.handleRestServerAction(SiteAreaService.handleGetSiteArea.bind(this), ServerAction.SITE_AREA, req, res, next);
    });
  }

  private buildRouteCreateSiteArea(): void {
    this.router.post(`/${RESTServerRoute.REST_SITE_AREAS}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(SiteAreaService.handleCreateSiteArea.bind(this), ServerAction.SITE_AREA_CREATE, req, res, next);
    });
  }

  private buildRouteGetSiteAreaConsumption(): void {
    this.router.get(`/${RESTServerRoute.REST_SITE_AREA_CONSUMPTION}`, (req: Request, res: Response, next: NextFunction) => {
      req.query.SiteAreaID = req.params.id;
      void RouterUtils.handleRestServerAction(SiteAreaService.handleGetSiteAreaConsumption.bind(this), ServerAction.SITE_AREA_CONSUMPTION, req, res, next);
    });
  }

  private buildRouteUpdateSiteArea(): void {
    this.router.put(`/${RESTServerRoute.REST_SITE_AREA}`, (req: Request, res: Response, next: NextFunction) => {
      req.body.id = req.params.id;
      void RouterUtils.handleRestServerAction(SiteAreaService.handleUpdateSiteArea.bind(this), ServerAction.SITE_AREA_UPDATE, req, res, next);
    });
  }

  private buildRouteDeleteSiteArea(): void {
    this.router.delete(`/${RESTServerRoute.REST_SITE_AREA}`, (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      void RouterUtils.handleRestServerAction(SiteAreaService.handleDeleteSiteArea.bind(this), ServerAction.SITE_AREA_DELETE, req, res, next);
    });
  }

  private buildRouteAssignChargingStationsToSiteArea(): void {
    this.router.put(`/${RESTServerRoute.REST_SITE_AREA_ASSIGN_CHARGING_STATIONS}`, (req: Request, res: Response, next: NextFunction) => {
      req.body.siteAreaID = req.params.id;
      void RouterUtils.handleRestServerAction(SiteAreaService.handleAssignChargingStationsToSiteArea.bind(this), ServerAction.ADD_CHARGING_STATIONS_TO_SITE_AREA, req, res, next);
    });
  }

  private buildRouteRemoveChargingStationsFromSiteArea(): void {
    this.router.put(`/${RESTServerRoute.REST_SITE_AREA_REMOVE_CHARGING_STATIONS}`, (req: Request, res: Response, next: NextFunction) => {
      req.body.siteAreaID = req.params.id;
      void RouterUtils.handleRestServerAction(SiteAreaService.handleAssignChargingStationsToSiteArea.bind(this), ServerAction.REMOVE_CHARGING_STATIONS_FROM_SITE_AREA, req, res, next);
    });
  }

  private buildRouteAssignAssetsToSiteArea(): void {
    this.router.put(`/${RESTServerRoute.REST_SITE_AREA_ASSIGN_ASSETS}`, (req: Request, res: Response, next: NextFunction) => {
      req.body.siteAreaID = req.params.id;
      void RouterUtils.handleRestServerAction(SiteAreaService.handleAssignAssetsToSiteArea.bind(this), ServerAction.ADD_ASSET_TO_SITE_AREA, req, res, next);
    });
  }

  private buildRouteRemoveAssetsToSiteArea(): void {
    this.router.put(`/${RESTServerRoute.REST_SITE_AREA_REMOVE_ASSETS}`, (req: Request, res: Response, next: NextFunction) => {
      req.body.siteAreaID = req.params.id;
      void RouterUtils.handleRestServerAction(SiteAreaService.handleAssignAssetsToSiteArea.bind(this), ServerAction.REMOVE_ASSET_TO_SITE_AREA, req, res, next);
    });
  }
}
