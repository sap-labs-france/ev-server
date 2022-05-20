import { RESTServerRoute, ServerAction } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import NotificationService from '../../service/NotificationService';
import RouterUtils from '../../../../../utils/RouterUtils';

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
    this.router.get(`/${RESTServerRoute.REST_NOTIFICATIONS}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(NotificationService.handleGetNotifications.bind(this), ServerAction.NOTIFICATIONS, req, res, next);
    });
  }

  private buildRouteEndUserReportError(): void {
    this.router.post(`/${RESTServerRoute.REST_NOTIFICATIONS_END_USER_REPORT_ERROR}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(NotificationService.handleEndUserReportError.bind(this), ServerAction.END_USER_REPORT_ERROR, req, res, next);
    });
  }
}
