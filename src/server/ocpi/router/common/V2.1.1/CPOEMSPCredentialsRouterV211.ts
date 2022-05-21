/* eslint-disable @typescript-eslint/no-misused-promises */
import { OCPIServerRoute, ServerAction } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import CPOEMSPCredentialsService from '../../../service/common/v2.1.1/CPOEMSPCredentialsService';
import RouterUtils from '../../../../../utils/RouterUtils';

export default class CPOEMSPCredentialsRouterV211 {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteCreateCredentials();
    this.buildRouteUpdateCredentials();
    this.buildRouteDeleteCredentials();
    return this.router;
  }

  protected buildRouteCreateCredentials(): void {
    this.router.post(`/${OCPIServerRoute.OCPI_CREDENTIALS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleOCPIServerAction(CPOEMSPCredentialsService.handleUpdateCreateCredentials.bind(this), ServerAction.OCPI_CREATE_CREDENTIALS, req, res, next);
    });
  }

  protected buildRouteUpdateCredentials(): void {
    this.router.put(`/${OCPIServerRoute.OCPI_CREDENTIALS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleOCPIServerAction(CPOEMSPCredentialsService.handleUpdateCreateCredentials.bind(this), ServerAction.OCPI_UPDATE_CREDENTIALS, req, res, next);
    });
  }

  protected buildRouteDeleteCredentials(): void {
    this.router.delete(`/${OCPIServerRoute.OCPI_CREDENTIALS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleOCPIServerAction(CPOEMSPCredentialsService.handleDeleteCredentials.bind(this), ServerAction.OCPI_DELETE_CREDENTIALS, req, res, next);
    });
  }
}
