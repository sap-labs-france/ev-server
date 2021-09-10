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
    this.buildRoutePricingDefinitions();
    this.buildRoutePricingDefinition();
    this.buildRouteCreatePricingDefinition();
    this.buildRouteDeletePricingDefinition();
    this.buildRouteUpdatePricingDefinition();
    return this.router;
  }

  protected buildRoutePricingDefinitions(): void {
    this.router.get(`/${ServerRoute.REST_PRICING_DEFINITIONS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(PricingService.handleGetPricingDefinitions.bind(this), ServerAction.PRICING_DEFINITIONS, req, res, next);
    });
  }

  protected buildRoutePricingDefinition(): void {
    this.router.get(`/${ServerRoute.REST_PRICING_DEFINITION}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(PricingService.handleGetPricingDefinition.bind(this), ServerAction.PRICING_DEFINITION, req, res, next);
    });
  }

  protected buildRouteCreatePricingDefinition(): void {
    this.router.post(`/${ServerRoute.REST_PRICING_DEFINITIONS}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(PricingService.handleCreatePricingDefinition.bind(this), ServerAction.PRICING_DEFINITION_CREATE, req, res, next);
    });
  }

  protected buildRouteDeletePricingDefinition(): void {
    this.router.delete(`/${ServerRoute.REST_PRICING_DEFINITION}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(PricingService.handleDeletePricingDefinition.bind(this), ServerAction.PRICING_DEFINITION_DELETE, req, res, next);
    });
  }

  protected buildRouteUpdatePricingDefinition(): void {
    this.router.put(`/${ServerRoute.REST_PRICING_DEFINITION}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(PricingService.handleUpdatePricingDefinition.bind(this), ServerAction.PRICING_DEFINITION_UPDATE, req, res, next);
    });
  }
}
