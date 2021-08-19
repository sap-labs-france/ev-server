/* eslint-disable @typescript-eslint/no-misused-promises */
import { ServerAction, ServerRoute } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import PricingService from '../../service/PricingService';
import RouterUtils from '../RouterUtils';

export default class PricingRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    // -----------------------------------
    // ROUTES for PRICING MODELS
    // -----------------------------------
    this.buildRoutePricingModels();
    this.buildRoutePricingModel();
    this.buildRouteCreatePricingModel();
    this.buildRouteDeletePricingModel();
    this.buildRouteUpdatePricingModel();
    return this.router;
  }

  protected buildRoutePricingModels(): void {
    this.router.get(`/${ServerRoute.REST_PRICING_MODELS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(PricingService.handleGetPricingModels.bind(this), ServerAction.PRICING_MODELS, req, res, next);
    });
  }

  protected buildRoutePricingModel(): void {
    this.router.get(`/${ServerRoute.REST_PRICING_MODEL}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(PricingService.handleGetPricingModel.bind(this), ServerAction.PRICING_MODEL, req, res, next);
    });
  }

  protected buildRouteCreatePricingModel(): void {
    this.router.post(`/${ServerRoute.REST_PRICING_MODELS}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(PricingService.handleCreatePricingModel.bind(this), ServerAction.PRICING_MODEL_CREATE, req, res, next);
    });
  }

  protected buildRouteDeletePricingModel(): void {
    this.router.delete(`/${ServerRoute.REST_PRICING_MODEL}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(PricingService.handleDeletePricingModel.bind(this), ServerAction.PRICING_MODEL_DELETE, req, res, next);
    });
  }

  protected buildRouteUpdatePricingModel(): void {
    this.router.put(`/${ServerRoute.REST_PRICING_MODEL}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(PricingService.handleUpdatePricingModel.bind(this), ServerAction.PRICING_MODEL_UPDATE, req, res, next);
    });
  }
}
