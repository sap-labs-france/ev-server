import { OCPIServerRoute, ServerAction } from '../../../../../types/Server';
/* eslint-disable @typescript-eslint/no-misused-promises */
import express, { NextFunction, Request, Response } from 'express';

import CPOTokensService from '../../../service/cpo/v2.1.1/CPOTokensService';
import RouterUtils from '../../../../../utils/RouterUtils';

export default class CPOTokensRouterV211 {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteGetTokens();
    this.buildRoutePutTokens();
    this.buildRoutePatchTokens();
    return this.router;
  }

  protected buildRouteGetTokens(): void {
    this.router.get(`/${OCPIServerRoute.OCPI_TOKENS}/*`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(CPOTokensService.handleGetToken.bind(this), ServerAction.OCPI_CPO_GET_TOKEN, req, res, next);
    });
  }

  protected buildRoutePutTokens(): void {
    this.router.put(`/${OCPIServerRoute.OCPI_TOKENS}/*`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(CPOTokensService.handlePutToken.bind(this), ServerAction.OCPI_CPO_PUT_TOKEN, req, res, next);
    });
  }

  protected buildRoutePatchTokens(): void {
    this.router.patch(`/${OCPIServerRoute.OCPI_TOKENS}/*`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(CPOTokensService.handlePatchToken.bind(this), ServerAction.OCPI_CPO_PATCH_TOKEN, req, res, next);
    });
  }
}
