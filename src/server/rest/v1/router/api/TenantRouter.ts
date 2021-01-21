import express, { NextFunction, Request, Response } from 'express';

import RouterUtils from '../RouterUtils';
import { ServerAction } from '../../../../../types/Server';
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
    return this.router;
  }

  protected buildRouteTenants(): void {
    this.router.get(`/${ServerAction.REST_TENANTS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(TenantService.handleGetTenants.bind(this), ServerAction.REST_TENANTS, req, res, next);
    });
  }

  protected buildRouteTenant(): void {
    this.router.get(`/${ServerAction.REST_TENANTS}/:id`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = sanitize(req.params.id);
      await RouterUtils.handleServerAction(TenantService.handleGetTenant.bind(this), ServerAction.REST_TENANTS, req, res, next);
    });
  }
}
