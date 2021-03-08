/* eslint-disable @typescript-eslint/no-misused-promises */
import { ServerAction, ServerRoute } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import RouterUtils from '../RouterUtils';
import TenantService from '../../service/TenantService';
import UserService from '../../service/UserService';
import sanitize from 'mongo-sanitize';

export default class UserRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteUsers();
    return this.router;
  }

  protected buildRouteUsers(): void {
    this.router.get(`/${ServerRoute.REST_USERS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(UserService.handleGetUsers.bind(this), ServerAction.USERS, req, res, next);
    });
  }
}
