/* eslint-disable @typescript-eslint/no-misused-promises */
import { OCPIServerRoute, ServerAction } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import EMSPTokensService from '../../../service/emsp/v2.1.1/EMSPTokensService';
import RouterUtils from '../../../../../utils/RouterUtils';

export default class EMSPTokensRouterV211 {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteAuthorizeToken();
    this.buildRouteGetTokens();
    return this.router;
  }

  protected buildRouteAuthorizeToken(): void {
    this.router.post(`/${OCPIServerRoute.OCPI_TOKENS}*`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleOCPIServerAction(EMSPTokensService.handleAuthorizeToken.bind(this), ServerAction.OCPI_EMSP_AUTHORIZE_TOKEN, req, res, next);
    });
  }

  protected buildRouteGetTokens(): void {
    this.router.get(`/${OCPIServerRoute.OCPI_TOKENS}*`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleOCPIServerAction(EMSPTokensService.handleGetTokens.bind(this), ServerAction.OCPI_EMSP_GET_TOKENS, req, res, next);
    });
  }
}
