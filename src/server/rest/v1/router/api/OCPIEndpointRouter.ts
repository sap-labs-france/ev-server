/* eslint-disable @typescript-eslint/no-misused-promises */
import { ServerAction, ServerRoute } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import OCPIEndpointService from '../../service/OCPIEndpointService';
import RouterUtils from '../RouterUtils';

export default class OCPIEndpointRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteOcpiEndpointCreate();
    this.buildRouteOcpiEndpointPing();
    this.buildRouteOcpiEndpointCheckCDRs();
    this.buildRouteOcpiEndpointCheckLocations();
    this.buildRouteOcpiEndpointCheckSessions();
    this.buildRouteOcpiEndpointPullCDRs();
    this.buildRouteOcpiEndpointPullLocations();
    this.buildRouteOcpiEndpointPullSessions();
    return this.router;
  }

  protected buildRouteOcpiEndpointCreate(): void {
    this.router.post(`/${ServerRoute.REST_OCPI_ENDPOINT_CREATE}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(OCPIEndpointService.handleCreateOcpiEndpoint.bind(this), ServerAction.OCPI_ENDPOINT_CREATE, req, res, next);
    });
  }

  protected buildRouteOcpiEndpointPing(): void {
    this.router.put(`/${ServerRoute.REST_OCPI_ENDPOINT_PING}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(OCPIEndpointService.handlePingOcpiEndpoint.bind(this), ServerAction.OCPI_ENDPOINT_PING, req, res, next);
    });
  }

  protected buildRouteOcpiEndpointCheckCDRs(): void {
    this.router.put(`/${ServerRoute.REST_OCPI_ENDPOINT_CHECK_CDRS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(OCPIEndpointService.handleCheckCdrsEndpoint.bind(this), ServerAction.OCPI_ENDPOINT_CHECK_CDRS, req, res, next);
    });
  }

  protected buildRouteOcpiEndpointCheckLocations(): void {
    this.router.put(`/${ServerRoute.REST_OCPI_ENDPOINT_CHECK_LOCATIONS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(OCPIEndpointService.handleCheckLocationsEndpoint.bind(this), ServerAction.OCPI_ENDPOINT_CHECK_LOCATIONS, req, res, next);
    });
  }

  protected buildRouteOcpiEndpointCheckSessions(): void {
    this.router.put(`/${ServerRoute.REST_OCPI_ENDPOINT_CHECK_SESSIONS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(OCPIEndpointService.handleCheckSessionsEndpoint.bind(this), ServerAction.OCPI_ENDPOINT_CHECK_SESSIONS, req, res, next);
    });
  }

  protected buildRouteOcpiEndpointPullCDRs(): void {
    this.router.put(`/${ServerRoute.REST_OCPI_ENDPOINT_PULL_CDRS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(OCPIEndpointService.handlePullCdrsEndpoint.bind(this), ServerAction.OCPI_PULL_CDRS, req, res, next);
    });
  }

  protected buildRouteOcpiEndpointPullLocations(): void {
    this.router.put(`/${ServerRoute.REST_OCPI_ENDPOINT_PULL_LOCATIONS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(OCPIEndpointService.handlePullLocationsEndpoint.bind(this), ServerAction.OCPI_PULL_LOCATIONS, req, res, next);
    });
  }

  protected buildRouteOcpiEndpointPullSessions(): void {
    this.router.put(`/${ServerRoute.REST_OCPI_ENDPOINT_PULL_SESSIONS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(OCPIEndpointService.handlePullSessionsEndpoint.bind(this), ServerAction.OCPI_PULL_SESSIONS, req, res, next);
    });
  }
}
