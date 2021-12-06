/* eslint-disable @typescript-eslint/no-misused-promises */
import { ServerAction, ServerRoute } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import NotificationService from '../../service/NotificationService';
import RouterUtils from '../RouterUtils';

export default class NotificationRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteNotifications();
    this.buildRouteEndUserReportError();
    return this.router;
  }

  private buildRouteNotifications(): void {
    this.router.get(`/${ServerRoute.REST_NOTIFICATIONS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(NotificationService.handleGetNotifications.bind(this), ServerAction.NOTIFICATIONS, req, res, next);
    });
  }

  private buildRouteEndUserReportError(): void {
    this.router.post(`/${ServerRoute.REST_NOTIFICATIONS_END_USER_REPORT_ERROR}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(NotificationService.handleEndUserReportError.bind(this), ServerAction.END_USER_REPORT_ERROR, req, res, next);
    });
  }
}
