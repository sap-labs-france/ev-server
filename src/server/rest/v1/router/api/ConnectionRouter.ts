import { RESTServerRoute, ServerAction } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import ConnectionService from '../../service/ConnectionService';
import RouterUtils from '../../../../../utils/RouterUtils';
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
    this.router.get(`/${RESTServerRoute.REST_CONNECTIONS}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(ConnectionService.handleGetConnections.bind(this), ServerAction.INTEGRATION_CONNECTIONS, req, res, next);
    });
  }

  private buildRouteConnection(): void {
    this.router.get(`/${RESTServerRoute.REST_CONNECTION}`, (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = sanitize(req.params.id);
      void RouterUtils.handleRestServerAction(ConnectionService.handleGetConnection.bind(this), ServerAction.INTEGRATION_CONNECTION, req, res, next);
    });
  }

  private buildRouteCreateConnection(): void {
    this.router.post(`/${RESTServerRoute.REST_CONNECTIONS}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(ConnectionService.handleCreateConnection.bind(this), ServerAction.INTEGRATION_CONNECTION_CREATE, req, res, next);
    });
  }

  private buildRouteDeleteConnection(): void {
    this.router.delete(`/${RESTServerRoute.REST_CONNECTION}`, (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = sanitize(req.params.id);
      void RouterUtils.handleRestServerAction(ConnectionService.handleDeleteConnection.bind(this), ServerAction.INTEGRATION_CONNECTION_DELETE, req, res, next);
    });
  }
}
