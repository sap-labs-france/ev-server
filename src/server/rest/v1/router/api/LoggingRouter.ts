/* eslint-disable @typescript-eslint/no-misused-promises */
import { ServerAction, ServerRoute } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import LoggingService from '../../service/LoggingService';
import RouterUtils from '../RouterUtils';

export default class LoggingRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteLoggings();
    this.buildRouteLogging();
    this.buildRouteLoggingsExport();
    return this.router;
  }

  private buildRouteLoggings(): void {
    this.router.get(`/${ServerRoute.REST_LOGGINGS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(LoggingService.handleGetLogs.bind(this), ServerAction.LOGGINGS, req, res, next);
    });
  }

  private buildRouteLogging(): void {
    this.router.get(`/${ServerRoute.REST_LOGGING}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(LoggingService.handleGetLog.bind(this), ServerAction.LOGGING, req, res, next);
    });
  }

  private buildRouteLoggingsExport(): void {
    this.router.get(`/${ServerRoute.REST_LOGGINGS_EXPORT}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(LoggingService.handleExportLogs.bind(this), ServerAction.LOGGINGS_EXPORT, req, res, next);
    });
  }
}
