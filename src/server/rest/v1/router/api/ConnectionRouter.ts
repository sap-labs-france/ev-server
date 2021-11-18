/* eslint-disable @typescript-eslint/no-misused-promises */
import { ServerAction, ServerRoute } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import ConnectionService from '../../service/ConnectionService';
import RouterUtils from '../RouterUtils';
import sanitize from 'mongo-sanitize';

export default class ConnectionRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteConnections();
    this.buildRouteConnection();
    this.buildRouteCreateConnection();
    this.buildRouteDeleteConnection();
    return this.router;
  }

  private buildRouteConnections(): void {
    this.router.get(`/${ServerRoute.REST_CONNECTIONS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(ConnectionService.handleGetConnections.bind(this), ServerAction.INTEGRATION_CONNECTIONS, req, res, next);
    });
  }

  private buildRouteConnection(): void {
    this.router.get(`/${ServerRoute.REST_CONNECTION}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = sanitize(req.params.id);
      await RouterUtils.handleServerAction(ConnectionService.handleGetConnection.bind(this), ServerAction.INTEGRATION_CONNECTION, req, res, next);
    });
  }

  private buildRouteCreateConnection(): void {
    this.router.post(`/${ServerRoute.REST_CONNECTIONS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(ConnectionService.handleCreateConnection.bind(this), ServerAction.INTEGRATION_CONNECTION_CREATE, req, res, next);
    });
  }

  private buildRouteDeleteConnection(): void {
    this.router.delete(`/${ServerRoute.REST_CONNECTION}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = sanitize(req.params.id);
      await RouterUtils.handleServerAction(ConnectionService.handleDeleteConnection.bind(this), ServerAction.INTEGRATION_CONNECTION_DELETE, req, res, next);
    });
  }
}
