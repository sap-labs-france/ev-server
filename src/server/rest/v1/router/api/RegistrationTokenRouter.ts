/* eslint-disable @typescript-eslint/no-misused-promises */
import { ServerAction, ServerRoute } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import RegistrationTokenService from '../../service/RegistrationTokenService';
import RouterUtils from '../RouterUtils';
import sanitize from 'mongo-sanitize';

export default class RegistrationTokenRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteRegistrationTokens();
    this.buildRouteRegistrationToken();
    this.buildRouteCreateRegistrationTokens();
    return this.router;
  }

  protected buildRouteRegistrationTokens(): void {
    this.router.get(`/${ServerRoute.REST_REGISTRATION_TOKENS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(RegistrationTokenService.handleGetRegistrationTokens.bind(this), ServerAction.REGISTRATION_TOKENS, req, res, next);
    });
  }

  protected buildRouteRegistrationToken(): void {
    this.router.get(`/${ServerRoute.REST_REGISTRATION_TOKEN}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = sanitize(req.params.id);
      await RouterUtils.handleServerAction(RegistrationTokenService.handleGetRegistrationToken.bind(this), ServerAction.REGISTRATION_TOKEN, req, res, next);
    });
  }

  protected buildRouteCreateRegistrationTokens(): void {
    this.router.post(`/${ServerRoute.REST_REGISTRATION_TOKENS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(RegistrationTokenService.handleCreateRegistrationToken.bind(this), ServerAction.REGISTRATION_TOKEN_CREATE, req, res, next);
    });
  }
}
