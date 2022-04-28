import { RESTServerRoute, ServerAction } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import AssetService from '../../service/AssetService';
import RouterUtils from '../../../../../utils/RouterUtils';

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
    this.buildRouteGetAssetsInError();
    this.buildRouteCheckAssetConnection();
    this.buildRouteGetAssetLastConsumption();
    this.buildRouteGetAssetConsumptions();
    this.buildRouteUpdateAsset();
    this.buildRouteDeleteAsset();
    return this.router;
  }

  private buildRouteCreateAssetConsumption(): void {
    this.router.post(`/${RESTServerRoute.REST_ASSET_CONSUMPTIONS}`, (req: Request, res: Response, next: NextFunction) => {
      req.query.assetID = req.params.id;
      void RouterUtils.handleRestServerAction(AssetService.handleCreateAssetConsumption.bind(this), ServerAction.ASSET_CONSUMPTION, req, res, next);
    });
  }

  private buildRouteCreateAsset(): void {
    this.router.post(`/${RESTServerRoute.REST_ASSETS}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(AssetService.handleCreateAsset.bind(this), ServerAction.ASSET_CREATE, req, res, next);
    });
  }

  private buildRouteGetAssets(): void {
    this.router.get(`/${RESTServerRoute.REST_ASSETS}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(AssetService.handleGetAssets.bind(this), ServerAction.ASSETS, req, res, next);
    });
  }

  private buildRouteGetAsset(): void {
    this.router.get(`/${RESTServerRoute.REST_ASSET}`, (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      void RouterUtils.handleRestServerAction(AssetService.handleGetAsset.bind(this), ServerAction.ASSET, req, res, next);
    });
  }

  private buildRouteGetAssetsInError(): void {
    this.router.get(`/${RESTServerRoute.REST_ASSETS_IN_ERROR}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(AssetService.handleGetAssetsInError.bind(this), ServerAction.ASSETS_IN_ERROR, req, res, next);
    });
  }

  private buildRouteCheckAssetConnection(): void {
    this.router.get(`/${RESTServerRoute.REST_ASSET_CHECK_CONNECTION}`, (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      void RouterUtils.handleRestServerAction(AssetService.handleCheckAssetConnection.bind(this), ServerAction.CHECK_ASSET_CONNECTION, req, res, next);
    });
  }

  private buildRouteGetAssetLastConsumption(): void {
    this.router.get(`/${RESTServerRoute.REST_ASSET_RETRIEVE_CONSUMPTION}`, (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      void RouterUtils.handleRestServerAction(AssetService.handleRetrieveConsumption.bind(this), ServerAction.RETRIEVE_ASSET_CONSUMPTION, req, res, next);
    });
  }

  private buildRouteGetAssetConsumptions(): void {
    this.router.get(`/${RESTServerRoute.REST_ASSET_CONSUMPTIONS}`, (req: Request, res: Response, next: NextFunction) => {
      req.query.AssetID = req.params.id;
      void RouterUtils.handleRestServerAction(AssetService.handleGetAssetConsumption.bind(this), ServerAction.ASSET_CONSUMPTION, req, res, next);
    });
  }

  private buildRouteUpdateAsset(): void {
    this.router.put(`/${RESTServerRoute.REST_ASSET}`, (req: Request, res: Response, next: NextFunction) => {
      req.body.id = req.params.id;
      void RouterUtils.handleRestServerAction(AssetService.handleUpdateAsset.bind(this), ServerAction.ASSET_UPDATE, req, res, next);
    });
  }

  private buildRouteDeleteAsset(): void {
    this.router.delete(`/${RESTServerRoute.REST_ASSET}`, (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      void RouterUtils.handleRestServerAction(AssetService.handleDeleteAsset.bind(this), ServerAction.ASSET_DELETE, req, res, next);
    });
  }
}
