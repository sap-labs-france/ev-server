/* eslint-disable @typescript-eslint/no-misused-promises */
import { ServerAction, ServerRoute } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import AssetService from '../../service/AssetService';
import RouterUtils from '../RouterUtils';

export default class AssetRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteCreateAssetConsumption();
    this.buildRouteCreateAsset();
    this.buildRouteGetAssets();
    this.buildRouteGetAsset();
    return this.router;
  }

  protected buildRouteCreateAssetConsumption(): void {
    this.router.post(`/${ServerRoute.REST_ASSET_CONSUMPTION}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.assetID = req.params.id;
      await RouterUtils.handleServerAction(AssetService.handleCreateAssetConsumption.bind(this), ServerAction.ASSET_CONSUMPTION, req, res, next);
    });
  }

  protected buildRouteCreateAsset(): void {
    this.router.post(`/${ServerRoute.REST_ASSETS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(AssetService.handleCreateAsset.bind(this), ServerAction.ASSET_CREATE, req, res, next);
    });
  }

  protected buildRouteGetAssets(): void {
    this.router.get(`/${ServerRoute.REST_ASSETS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(AssetService.handleGetAssets.bind(this), ServerAction.ASSETS, req, res, next);
    });
  }

  protected buildRouteGetAsset(): void {
    this.router.get(`/${ServerRoute.REST_ASSET}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(AssetService.handleGetAsset.bind(this), ServerAction.ASSET, req, res, next);
    });
  }
}
