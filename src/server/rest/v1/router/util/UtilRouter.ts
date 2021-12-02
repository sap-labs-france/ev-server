/* eslint-disable @typescript-eslint/no-misused-promises */
import { ServerAction, ServerRoute } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import AssetService from '../../service/AssetService';
import CarService from '../../service/CarService';
import ChargingStationService from '../../service/ChargingStationService';
import CompanyService from '../../service/CompanyService';
import RouterUtils from '../RouterUtils';
import SiteAreaService from '../../service/SiteAreaService';
import SiteService from '../../service/SiteService';
import { StatusCodes } from 'http-status-codes';
import TenantService from '../../service/TenantService';

export default class UtilRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRoutePing();
    this.buildRouteGetCarCatalogImage();
    this.buildRouteGetAssetImage();
    this.buildRouteGetCompanyLogo();
    this.buildRouteGetSiteAreaImage();
    this.buildRouteChargingStationDownloadFirmware();
    this.buildRouteGetSiteImage();
    this.buildRouteGetTenantLogo();
    return this.router;
  }

  private buildRoutePing(): void {
    this.router.get(`/${ServerRoute.REST_PING}`, (req: Request, res: Response, next: NextFunction) => {
      res.sendStatus(StatusCodes.OK);
      next();
    });
  }

  private buildRouteGetTenantLogo(): void {
    this.router.get(`/${ServerRoute.REST_TENANT_LOGO}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(TenantService.handleGetTenantLogo.bind(this), ServerAction.TENANT_LOGO, req, res, next);
    });
  }

  private buildRouteGetCarCatalogImage(): void {
    this.router.get(`/${ServerRoute.REST_CAR_CATALOG_IMAGE}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(CarService.handleGetCarCatalogImage.bind(this), ServerAction.CAR_CATALOG_IMAGE, req, res, next);
    });
  }

  private buildRouteGetAssetImage(): void {
    this.router.get(`/${ServerRoute.REST_ASSET_IMAGE}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(AssetService.handleGetAssetImage.bind(this), ServerAction.ASSET_IMAGE, req, res, next);
    });
  }

  private buildRouteGetCompanyLogo(): void {
    this.router.get(`/${ServerRoute.REST_COMPANY_LOGO}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(CompanyService.handleGetCompanyLogo.bind(this), ServerAction.COMPANY_LOGO, req, res, next);
    });
  }

  private buildRouteGetSiteAreaImage(): void {
    this.router.get(`/${ServerRoute.REST_SITE_AREA_IMAGE}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(SiteAreaService.handleGetSiteAreaImage.bind(this), ServerAction.SITE_AREA_IMAGE, req, res, next);
    });
  }

  private buildRouteChargingStationDownloadFirmware(): void {
    this.router.get(`/${ServerRoute.REST_CHARGING_STATIONS_DOWNLOAD_FIRMWARE}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(ChargingStationService.handleGetFirmware.bind(this), ServerAction.FIRMWARE_DOWNLOAD, req, res, next);
    });
  }

  private buildRouteGetSiteImage(): void {
    this.router.get(`/${ServerRoute.REST_SITE_IMAGE}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(SiteService.handleGetSiteImage.bind(this), ServerAction.SITE_IMAGE, req, res, next);
    });
  }
}
