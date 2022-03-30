/* eslint-disable @typescript-eslint/no-misused-promises */
import { RESTServerRoute, ServerAction } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import RegistrationTokenService from '../../service/RegistrationTokenService';
import RouterUtils from '../../../../../utils/RouterUtils';
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
    this.buildRouteUpdateRegistrationTokens();
    this.buildRouteDeleteRegistrationTokens();
    this.buildRouteRevokeRegistrationTokens();
    return this.router;
  }

  private buildRouteRegistrationTokens(): void {
    this.router.get(`/${RESTServerRoute.REST_REGISTRATION_TOKENS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(RegistrationTokenService.handleGetRegistrationTokens.bind(this), ServerAction.REGISTRATION_TOKENS, req, res, next);
    });
  }

  private buildRouteRegistrationToken(): void {
    this.router.get(`/${RESTServerRoute.REST_REGISTRATION_TOKEN}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = sanitize(req.params.id);
      await RouterUtils.handleServerAction(RegistrationTokenService.handleGetRegistrationToken.bind(this), ServerAction.REGISTRATION_TOKEN, req, res, next);
    });
  }

  private buildRouteCreateRegistrationTokens(): void {
    this.router.post(`/${RESTServerRoute.REST_REGISTRATION_TOKENS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(RegistrationTokenService.handleCreateRegistrationToken.bind(this), ServerAction.REGISTRATION_TOKEN_CREATE, req, res, next);
    });
  }

  private buildRouteUpdateRegistrationTokens(): void {
    this.router.put(`/${RESTServerRoute.REST_REGISTRATION_TOKEN}`, async (req: Request, res: Response, next: NextFunction) => {
      req.body.id = req.params.id;
      await RouterUtils.handleServerAction(RegistrationTokenService.handleUpdateRegistrationToken.bind(this), ServerAction.REGISTRATION_TOKEN_UPDATE, req, res, next);
    });
  }

  private buildRouteDeleteRegistrationTokens(): void {
    this.router.delete(`/${RESTServerRoute.REST_REGISTRATION_TOKEN}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(RegistrationTokenService.handleDeleteRegistrationToken.bind(this), ServerAction.REGISTRATION_TOKEN_DELETE, req, res, next);
    });
  }

  private buildRouteRevokeRegistrationTokens(): void {
    this.router.put(`/${RESTServerRoute.REST_REGISTRATION_TOKEN_REVOKE}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(RegistrationTokenService.handleRevokeRegistrationToken.bind(this), ServerAction.REGISTRATION_TOKEN_REVOKE, req, res, next);
    });
  }
}
