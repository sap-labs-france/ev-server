/* eslint-disable @typescript-eslint/no-misused-promises */
import { RESTServerRoute, ServerAction } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import OICPEndpointService from '../../service/OICPEndpointService';
import RouterUtils from '../../../../../utils/RouterUtils';

export default class OICPEndpointRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteOicpEndpointCreate();
    this.buildRouteOicpEndpointPing();
    this.buildRouteOicpEndpointSendEvseStatuses();
    this.buildRouteOicpEndpointSendEvses();
    this.buildRouteOicpEndpoints();
    this.buildRouteOicpEndpoint();
    this.buildRouteOicpEndpointUpdate();
    this.buildRouteOicpEndpointUnregister();
    this.buildRouteOicpEndpointRegister();
    this.buildRouteOicpEndpointDelete();
    return this.router;
  }

  private buildRouteOicpEndpointCreate(): void {
    this.router.post(`/${RESTServerRoute.REST_OICP_ENDPOINTS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleRestServerAction(OICPEndpointService.handleCreateOicpEndpoint.bind(this), ServerAction.OICP_ENDPOINT_CREATE, req, res, next);
    });
  }

  private buildRouteOicpEndpointPing(): void {
    this.router.put(`/${RESTServerRoute.REST_OICP_ENDPOINT_PING}`, async (req: Request, res: Response, next: NextFunction) => {
      req.body.id = req.params.id;
      await RouterUtils.handleRestServerAction(OICPEndpointService.handlePingOicpEndpoint.bind(this), ServerAction.OICP_ENDPOINT_PING, req, res, next);
    });
  }

  private buildRouteOicpEndpointSendEvseStatuses(): void {
    this.router.put(`/${RESTServerRoute.REST_OICP_ENDPOINT_SEND_EVSE_STATUSES}`, async (req: Request, res: Response, next: NextFunction) => {
      req.params.ID = req.params.id;
      await RouterUtils.handleRestServerAction(OICPEndpointService.handleSendEVSEStatusesOicpEndpoint.bind(this), ServerAction.OICP_ENDPOINT_SEND_EVSE_STATUSES, req, res, next);
    });
  }

  private buildRouteOicpEndpointSendEvses(): void {
    this.router.put(`/${RESTServerRoute.REST_OICP_ENDPOINT_SEND_EVSES}`, async (req: Request, res: Response, next: NextFunction) => {
      req.params.ID = req.params.id;
      await RouterUtils.handleRestServerAction(OICPEndpointService.handleSendEVSEsOicpEndpoint.bind(this), ServerAction.OICP_ENDPOINT_SEND_EVSES, req, res, next);
    });
  }

  private buildRouteOicpEndpoints(): void {
    this.router.get(`/${RESTServerRoute.REST_OICP_ENDPOINTS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleRestServerAction(OICPEndpointService.handleGetOicpEndpoints.bind(this), ServerAction.OICP_ENDPOINTS, req, res, next);
    });
  }

  private buildRouteOicpEndpoint(): void {
    this.router.get(`/${RESTServerRoute.REST_OICP_ENDPOINT}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleRestServerAction(OICPEndpointService.handleGetOicpEndpoint.bind(this), ServerAction.OICP_ENDPOINT, req, res, next);
    });
  }

  private buildRouteOicpEndpointUpdate(): void {
    this.router.put(`/${RESTServerRoute.REST_OICP_ENDPOINT}`, async (req: Request, res: Response, next: NextFunction) => {
      req.body.id = req.params.id;
      await RouterUtils.handleRestServerAction(OICPEndpointService.handleUpdateOicpEndpoint.bind(this), ServerAction.OICP_ENDPOINT_UPDATE, req, res, next);
    });
  }

  private buildRouteOicpEndpointUnregister(): void {
    this.router.put(`/${RESTServerRoute.REST_OICP_ENDPOINT_UNREGISTER}`, async (req: Request, res: Response, next: NextFunction) => {
      req.params.ID = req.params.id;
      await RouterUtils.handleRestServerAction(OICPEndpointService.handleUnregisterOicpEndpoint.bind(this), ServerAction.OICP_ENDPOINT_UNREGISTER, req, res, next);
    });
  }

  private buildRouteOicpEndpointRegister(): void {
    this.router.put(`/${RESTServerRoute.REST_OICP_ENDPOINT_REGISTER}`, async (req: Request, res: Response, next: NextFunction) => {
      req.params.ID = req.params.id;
      await RouterUtils.handleRestServerAction(OICPEndpointService.handleRegisterOicpEndpoint.bind(this), ServerAction.OICP_ENDPOINT_REGISTER, req, res, next);
    });
  }

  private buildRouteOicpEndpointDelete(): void {
    this.router.delete(`/${RESTServerRoute.REST_OICP_ENDPOINT}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleRestServerAction(OICPEndpointService.handleDeleteOicpEndpoint.bind(this), ServerAction.OICP_ENDPOINT_DELETE, req, res, next);
    });
  }
}
