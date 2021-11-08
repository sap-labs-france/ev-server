/* eslint-disable @typescript-eslint/no-misused-promises */
import { ServerAction, ServerRoute } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import OICPEndpointService from '../../service/OICPEndpointService';
import RouterUtils from '../RouterUtils';

export default class OICPEndpointRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteOicpEndpointCreate();
    this.buildRouteOicpEndpointPing();
    this.buildRouteOicpEndpointSendEvseStatues();
    this.buildRouteOicpEndpointSendEvses();
    return this.router;
  }

  private buildRouteOicpEndpointCreate(): void {
    this.router.post(`/${ServerRoute.REST_OICP_ENDPOINTS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(OICPEndpointService.handleCreateOicpEndpoint.bind(this), ServerAction.OICP_ENDPOINT_CREATE, req, res, next);
    });
  }

  private buildRouteOicpEndpointPing(): void {
    this.router.put(`/${ServerRoute.REST_OICP_ENDPOINT_PING}`, async (req: Request, res: Response, next: NextFunction) => {
      req.body.id = req.params.id;
      await RouterUtils.handleServerAction(OICPEndpointService.handlePingOicpEndpoint.bind(this), ServerAction.OICP_ENDPOINT_PING, req, res, next);
    });
  }

  private buildRouteOicpEndpointSendEvseStatues(): void {
    this.router.put(`/${ServerRoute.REST_OICP_ENDPOINT_SEND_EVSE_STATUSES}`, async (req: Request, res: Response, next: NextFunction) => {
      req.body.id = req.params.id;
      await RouterUtils.handleServerAction(OICPEndpointService.handleSendEVSEStatusesOicpEndpoint.bind(this), ServerAction.OICP_ENDPOINT_SEND_EVSE_STATUSES, req, res, next);
    });
  }

  private buildRouteOicpEndpointSendEvses(): void {
    this.router.put(`/${ServerRoute.REST_OICP_ENDPOINT_SEND_EVSES}`, async (req: Request, res: Response, next: NextFunction) => {
      req.body.id = req.params.id;
      await RouterUtils.handleServerAction(OICPEndpointService.handleSendEVSEsOicpEndpoint.bind(this), ServerAction.OICP_ENDPOINT_SEND_EVSES, req, res, next);
    });
  }
}
