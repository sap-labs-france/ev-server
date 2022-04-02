/* eslint-disable @typescript-eslint/no-misused-promises */
import { OCPIServerRoute, ServerAction } from '../../../../../types/Server';
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
    this.router.get(`/${OCPIServerRoute.OCPI_TOKENS}*`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleOCPIServerAction(CPOTokensService.handleGetToken.bind(this), ServerAction.OCPI_CPO_GET_TOKEN, req, res, next);
    });
  }

  protected buildRoutePutTokens(): void {
    this.router.put(`/${OCPIServerRoute.OCPI_TOKENS}*`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleOCPIServerAction(CPOTokensService.handlePutToken.bind(this), ServerAction.OCPI_CPO_UPDATE_TOKEN, req, res, next);
    });
  }

  protected buildRoutePatchTokens(): void {
    this.router.patch(`/${OCPIServerRoute.OCPI_TOKENS}*`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleOCPIServerAction(CPOTokensService.handlePatchToken.bind(this), ServerAction.OCPI_CPO_UPDATE_TOKEN, req, res, next);
    });
  }
}
