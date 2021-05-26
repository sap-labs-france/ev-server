import express, { NextFunction, Request, Response } from 'express';

import AuthRouter from './auth/AuthRouter';
import AuthService from '../service/AuthService';
import BillingRouter from './api/BillingRouter';
import ChargingStationRouter from './api/ChargingStationRouter';
import { StatusCodes } from 'http-status-codes';
import SwaggerRouter from './doc/SwaggerRouter';
import TagRouter from './api/TagRouter';
import TenantRouter from './api/TenantRouter';
import TransactionRouter from './api/TransactionRouter';
import UserRouter from './api/UserRouter';
import UtilRouter from './util/UtilRouter';
import Configuration from '../../../../utils/Configuration';
import AdvancedConfiguration, { AuthServiceType } from '../../../../types/configuration/AdvancedConfiguration';

export default class GlobalRouter {
  private router: express.Router;
  private advancedConfig: AdvancedConfiguration;

  public constructor() {
    this.router = express.Router();
    this.advancedConfig = Configuration.getAdvancedConfig();
  }

  public buildRoutes(): express.Router {
    this.buildRouteAuth();
    this.buildRouteAPI();
    this.buildRouteUtils();
    this.buildRouteDocs();
    this.buildUnknownRoute();
    return this.router;
  }

  protected buildRouteAuth(): void {
    if(this.advancedConfig.globalAuthenticationService === AuthServiceType.XSUAA) {
      //inject the AuthService.authenticate() call to validate the xsuaa token
      this.router.use('/auth',
        AuthService.authenticate(),
        [
          new AuthRouter().buildRoutes()
        ]);
    } else {
      this.router.use('/auth', new AuthRouter().buildRoutes());
    }
  }

  protected buildRouteAPI(): void {
    this.router.use('/api',
      AuthService.authenticate(),
      AuthService.readSpecialHeader.bind(this),
      AuthService.checkSessionHash.bind(this),
      [
        new ChargingStationRouter().buildRoutes(),
        new TagRouter().buildRoutes(),
        new TenantRouter().buildRoutes(),
        new TransactionRouter().buildRoutes(),
        new UserRouter().buildRoutes(),
        new BillingRouter().buildRoutes(),
      ]);
  }

  protected buildRouteUtils(): void {
    this.router.use('/utils', new UtilRouter().buildRoutes());
  }

  protected buildRouteDocs(): void {
    this.router.use('/docs', new SwaggerRouter().buildRoutes());
  }

  protected buildUnknownRoute(): void {
    this.router.use('*', (req: Request, res: Response, next: NextFunction) => {
      if (!res.headersSent) {
        res.sendStatus(StatusCodes.NOT_FOUND);
        next();
      }
    });
  }
}
