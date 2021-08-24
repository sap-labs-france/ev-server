/* eslint-disable @typescript-eslint/no-misused-promises */
import { ServerAction, ServerRoute } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import RouterUtils from '../RouterUtils';
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
    return this.router;
  }

  protected buildRouteSiteAreas(): void {
    this.router.get(`/${ServerRoute.REST_SITE_AREAS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(SiteAreaService.handleGetSiteAreas.bind(this), ServerAction.SITE_AREAS, req, res, next);
    });
  }

  protected buildRouteSiteArea(): void {
    this.router.get(`/${ServerRoute.REST_SITE_AREA}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(SiteAreaService.handleGetSiteArea.bind(this), ServerAction.SITE_AREA, req, res, next);
    });
  }

  protected buildRouteCreateSiteArea(): void {
    this.router.post(`/${ServerRoute.REST_SITE_AREAS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(SiteAreaService.handleCreateSiteArea.bind(this), ServerAction.SITE_AREA_CREATE, req, res, next);
    });
  }
}
