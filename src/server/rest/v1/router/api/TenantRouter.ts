/* eslint-disable @typescript-eslint/no-misused-promises */
import { RESTServerRoute, ServerAction } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import RouterUtils from '../../../../../utils/RouterUtils';
import TenantService from '../../service/TenantService';
import sanitize from 'mongo-sanitize';

export default class TenantRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteTenants();
    this.buildRouteTenant();
    this.buildRouteCreateTenant();
    this.buildRouteUpdateTenant();
    this.buildRouteDeleteTenant();
    return this.router;
  }

  private buildRouteTenants(): void {
    this.router.get(`/${RESTServerRoute.REST_TENANTS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleRestServerAction(TenantService.handleGetTenants.bind(this), ServerAction.TENANTS, req, res, next);
    });
  }

  private buildRouteTenant(): void {
    this.router.get(`/${RESTServerRoute.REST_TENANT}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = sanitize(req.params.id);
      await RouterUtils.handleRestServerAction(TenantService.handleGetTenant.bind(this), ServerAction.TENANT, req, res, next);
    });
  }

  private buildRouteCreateTenant(): void {
    this.router.post(`/${RESTServerRoute.REST_TENANTS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleRestServerAction(TenantService.handleCreateTenant.bind(this), ServerAction.TENANT_CREATE, req, res, next);
    });
  }

  private buildRouteUpdateTenant(): void {
    this.router.put(`/${RESTServerRoute.REST_TENANT}`, async (req: Request, res: Response, next: NextFunction) => {
      req.body.id = req.params.id;
      await RouterUtils.handleRestServerAction(TenantService.handleUpdateTenant.bind(this), ServerAction.TENANT_UPDATE, req, res, next);
    });
  }

  private buildRouteDeleteTenant(): void {
    this.router.delete(`/${RESTServerRoute.REST_TENANT}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleRestServerAction(TenantService.handleDeleteTenant.bind(this), ServerAction.TENANT_DELETE, req, res, next);
    });
  }
}
