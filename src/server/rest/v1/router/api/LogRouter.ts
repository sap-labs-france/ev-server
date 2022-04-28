import { RESTServerRoute, ServerAction } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import LogService from '../../service/LogService';
import RouterUtils from '../../../../../utils/RouterUtils';

export default class LoggingRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteLogs();
    this.buildRouteLog();
    this.buildRouteLogsExport();
    return this.router;
  }

  private buildRouteLogs(): void {
    this.router.get(`/${RESTServerRoute.REST_LOGS}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(LogService.handleGetLogs.bind(this), ServerAction.LOGS, req, res, next);
    });
  }

  private buildRouteLog(): void {
    this.router.get(`/${RESTServerRoute.REST_LOG}`, (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      void RouterUtils.handleRestServerAction(LogService.handleGetLog.bind(this), ServerAction.LOG, req, res, next);
    });
  }

  private buildRouteLogsExport(): void {
    this.router.get(`/${RESTServerRoute.REST_LOGS_EXPORT}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(LogService.handleExportLogs.bind(this), ServerAction.LOGS_EXPORT, req, res, next);
    });
  }
}
