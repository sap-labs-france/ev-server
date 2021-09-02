/* eslint-disable @typescript-eslint/no-misused-promises */
import { ServerAction, ServerRoute } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import CarService from '../../service/CarService';
import RouterUtils from '../RouterUtils';

export default class CarRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteCarCatalogs();
    this.buildRouteCarCatalog();
    this.buildRouteCarCatalogImages();
    this.buildRouteCarCatalogImage();
    return this.router;
  }

  protected buildRouteCarCatalogs(): void {
    this.router.get(`/${ServerRoute.REST_CAR_CATALOGS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(CarService.handleGetCarCatalogs.bind(this), ServerAction.CAR_CATALOGS, req, res, next);
    });
  }

  protected buildRouteCarCatalog(): void {
    this.router.get(`/${ServerRoute.REST_CAR_CATALOG}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(CarService.handleGetCarCatalog.bind(this), ServerAction.CAR_CATALOG, req, res, next);
    });
  }

  protected buildRouteCarCatalogImages(): void {
    this.router.get(`/${ServerRoute.REST_CAR_CATALOG_IMAGES}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(CarService.handleGetCarCatalogImages.bind(this), ServerAction.CAR_CATALOG_IMAGES, req, res, next);
    });
  }

  protected buildRouteCarCatalogImage(): void {
    this.router.get(`/${ServerRoute.REST_CAR_CATALOG_IMAGE}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(CarService.handleGetCarCatalogImage.bind(this), ServerAction.CAR_CATALOG_IMAGE, req, res, next);
    });
  }
}
