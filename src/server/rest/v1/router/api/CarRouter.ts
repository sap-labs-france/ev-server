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
    this.buildRouteGetCarCatalogs();
    this.buildRouteGetCarCatalog();
    this.buildRouteGetCarCatalogImages();
    this.buildRouteGetCarCatalogImage();
    this.buildRouteCarCatalogsSynchronize();
    this.buildRouteGetCarMakers();
    this.buildRouteCreateCar();
    this.buildRouteGetCars();
    return this.router;
  }

  protected buildRouteGetCarCatalogs(): void {
    this.router.get(`/${ServerRoute.REST_CAR_CATALOGS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(CarService.handleGetCarCatalogs.bind(this), ServerAction.CAR_CATALOGS, req, res, next);
    });
  }

  protected buildRouteGetCarCatalog(): void {
    this.router.get(`/${ServerRoute.REST_CAR_CATALOG}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(CarService.handleGetCarCatalog.bind(this), ServerAction.CAR_CATALOG, req, res, next);
    });
  }

  protected buildRouteGetCarCatalogImages(): void {
    this.router.get(`/${ServerRoute.REST_CAR_CATALOG_IMAGES}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(CarService.handleGetCarCatalogImages.bind(this), ServerAction.CAR_CATALOG_IMAGES, req, res, next);
    });
  }

  protected buildRouteGetCarCatalogImage(): void {
    this.router.get(`/${ServerRoute.REST_CAR_CATALOG_IMAGE}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(CarService.handleGetCarCatalogImage.bind(this), ServerAction.CAR_CATALOG_IMAGE, req, res, next);
    });
  }

  protected buildRouteCarCatalogsSynchronize(): void {
    this.router.put(`/${ServerRoute.REST_CAR_CATALOG_SYNCHRONIZE}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(CarService.handleSynchronizeCarCatalogs.bind(this), ServerAction.CAR_CATALOG_SYNCHRONIZATION, req, res, next);
    });
  }

  protected buildRouteGetCarMakers(): void {
    this.router.get(`/${ServerRoute.REST_CAR_MAKERS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(CarService.handleGetCarMakers.bind(this), ServerAction.CAR_MAKERS, req, res, next);
    });
  }

  protected buildRouteCreateCar(): void {
    this.router.post(`/${ServerRoute.REST_CARS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(CarService.handleCreateCar.bind(this), ServerAction.CAR_CREATE, req, res, next);
    });
  }

  protected buildRouteGetCars(): void {
    this.router.get(`/${ServerRoute.REST_CARS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(CarService.handleGetCars.bind(this), ServerAction.CARS, req, res, next);
    });
  }
}
