import { RESTServerRoute, ServerAction } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import PricingService from '../../service/PricingService';
import RouterUtils from '../../../../../utils/RouterUtils';

export default class PricingRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRoutePricingDefinitions();
    this.buildRoutePricingDefinition();
    this.buildRouteCreatePricingDefinition();
    this.buildRouteDeletePricingDefinition();
    this.buildRouteUpdatePricingDefinition();
    this.buildRouteResolvePricingModel();
    return this.router;
  }

  protected buildRoutePricingDefinitions(): void {
    this.router.get(`/${RESTServerRoute.REST_PRICING_DEFINITIONS}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(PricingService.handleGetPricingDefinitions.bind(this), ServerAction.PRICING_DEFINITIONS, req, res, next);
    });
  }

  protected buildRoutePricingDefinition(): void {
    this.router.get(`/${RESTServerRoute.REST_PRICING_DEFINITION}`, (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      void RouterUtils.handleRestServerAction(PricingService.handleGetPricingDefinition.bind(this), ServerAction.PRICING_DEFINITION, req, res, next);
    });
  }

  protected buildRouteCreatePricingDefinition(): void {
    this.router.post(`/${RESTServerRoute.REST_PRICING_DEFINITIONS}`, (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      void RouterUtils.handleRestServerAction(PricingService.handleCreatePricingDefinition.bind(this), ServerAction.PRICING_DEFINITION_CREATE, req, res, next);
    });
  }

  protected buildRouteDeletePricingDefinition(): void {
    this.router.delete(`/${RESTServerRoute.REST_PRICING_DEFINITION}`, (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      void RouterUtils.handleRestServerAction(PricingService.handleDeletePricingDefinition.bind(this), ServerAction.PRICING_DEFINITION_DELETE, req, res, next);
    });
  }

  protected buildRouteUpdatePricingDefinition(): void {
    this.router.put(`/${RESTServerRoute.REST_PRICING_DEFINITION}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(PricingService.handleUpdatePricingDefinition.bind(this), ServerAction.PRICING_DEFINITION_UPDATE, req, res, next);
    });
  }

  protected buildRouteResolvePricingModel(): void {
    this.router.get(`/${RESTServerRoute.REST_PRICING_MODEL_RESOLVE}`, (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      void RouterUtils.handleRestServerAction(PricingService.handleResolvePricingModel.bind(this), ServerAction.PRICING_MODEL_RESOLVE, req, res, next);
    });
  }

}
