import AuthRouter from './auth/AuthRouter';
import AuthService from '../service/AuthService';
import SwaggerRouter from './doc/SwaggerRouter';
import TenantRouter from './api/TenantRouter';
import UtilRouter from './util/UtilRouter';
import express from 'express';

export default class GlobalRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteAuth();
    this.buildRouteAPI();
    this.buildRouteUtils();
    this.buildRouteDocs();
    return this.router;
  }

  protected buildRouteAuth(): void {
    this.router.use('/auth', new AuthRouter().buildRoutes());
  }

  protected buildRouteAPI(): void {
    this.router.use('/api', AuthService.authenticate(), [
      new TenantRouter().buildRoutes()
    ]);
  }

  protected buildRouteUtils(): void {
    this.router.use('/utils', new UtilRouter().buildRoutes());
  }

  protected buildRouteDocs(): void {
    this.router.use('/docs', new SwaggerRouter().buildRoutes());
  }
}
