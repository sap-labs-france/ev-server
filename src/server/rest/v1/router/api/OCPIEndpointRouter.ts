/* eslint-disable @typescript-eslint/no-misused-promises */
import { RESTServerRoute, ServerAction } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import OCPIEndpointService from '../../service/OCPIEndpointService';
import RouterUtils from '../../../../../utils/RouterUtils';

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
    this.buildRouteOcpiEndpointPullTokens();
    this.buildRouteOcpiEndpointSendEVSEStatuses();
    this.buildRouteOcpiEndpointSendTokens();
    this.buildRouteOcpiEndpointGenerateTokens();
    this.buildRouteOcpiEndpoints();
    this.buildRouteOcpiEndpoint();
    this.buildRouteOcpiEndpointUpdate();
    this.buildRouteOcpiEndpointRegister();
    this.buildRouteOcpiEndpointUnregister();
    this.buildRouteOcpiEndpointCredentialsUpdate();
    this.buildRouteOcpiEndpointDelete();
    return this.router;
  }

  private buildRouteOcpiEndpointCreate(): void {
    this.router.post(`/${RESTServerRoute.REST_OCPI_ENDPOINTS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleRestServerAction(OCPIEndpointService.handleCreateOcpiEndpoint.bind(this), ServerAction.OCPI_ENDPOINT_CREATE, req, res, next);
    });
  }

  private buildRouteOcpiEndpointPing(): void {
    this.router.put(`/${RESTServerRoute.REST_OCPI_ENDPOINT_PING}`, async (req: Request, res: Response, next: NextFunction) => {
      req.body.id = req.params.id;
      await RouterUtils.handleRestServerAction(OCPIEndpointService.handlePingOcpiEndpoint.bind(this), ServerAction.OCPI_ENDPOINT_PING, req, res, next);
    });
  }

  private buildRouteOcpiEndpointCheckCDRs(): void {
    this.router.put(`/${RESTServerRoute.REST_OCPI_ENDPOINT_CHECK_CDRS}`, async (req: Request, res: Response, next: NextFunction) => {
      req.body.id = req.params.id;
      await RouterUtils.handleRestServerAction(OCPIEndpointService.handleCheckCdrsEndpoint.bind(this), ServerAction.OCPI_ENDPOINT_CHECK_CDRS, req, res, next);
    });
  }

  private buildRouteOcpiEndpointCheckLocations(): void {
    this.router.put(`/${RESTServerRoute.REST_OCPI_ENDPOINT_CHECK_LOCATIONS}`, async (req: Request, res: Response, next: NextFunction) => {
      req.body.id = req.params.id;
      await RouterUtils.handleRestServerAction(OCPIEndpointService.handleCheckLocationsEndpoint.bind(this), ServerAction.OCPI_ENDPOINT_CHECK_LOCATIONS, req, res, next);
    });
  }

  private buildRouteOcpiEndpointCheckSessions(): void {
    this.router.put(`/${RESTServerRoute.REST_OCPI_ENDPOINT_CHECK_SESSIONS}`, async (req: Request, res: Response, next: NextFunction) => {
      req.body.id = req.params.id;
      await RouterUtils.handleRestServerAction(OCPIEndpointService.handleCheckSessionsEndpoint.bind(this), ServerAction.OCPI_ENDPOINT_CHECK_SESSIONS, req, res, next);
    });
  }

  private buildRouteOcpiEndpointPullCDRs(): void {
    this.router.put(`/${RESTServerRoute.REST_OCPI_ENDPOINT_PULL_CDRS}`, async (req: Request, res: Response, next: NextFunction) => {
      req.body.id = req.params.id;
      await RouterUtils.handleRestServerAction(OCPIEndpointService.handlePullCdrsEndpoint.bind(this), ServerAction.OCPI_EMSP_GET_CDR, req, res, next);
    });
  }

  private buildRouteOcpiEndpointPullLocations(): void {
    this.router.put(`/${RESTServerRoute.REST_OCPI_ENDPOINT_PULL_LOCATIONS}`, async (req: Request, res: Response, next: NextFunction) => {
      req.body.id = req.params.id;
      await RouterUtils.handleRestServerAction(OCPIEndpointService.handlePullLocationsEndpoint.bind(this), ServerAction.OCPI_EMSP_GET_LOCATIONS, req, res, next);
    });
  }

  private buildRouteOcpiEndpointPullSessions(): void {
    this.router.put(`/${RESTServerRoute.REST_OCPI_ENDPOINT_PULL_SESSIONS}`, async (req: Request, res: Response, next: NextFunction) => {
      req.body.id = req.params.id;
      await RouterUtils.handleRestServerAction(OCPIEndpointService.handlePullSessionsEndpoint.bind(this), ServerAction.OCPI_EMSP_GET_SESSION, req, res, next);
    });
  }

  private buildRouteOcpiEndpointPullTokens(): void {
    this.router.put(`/${RESTServerRoute.REST_OCPI_ENDPOINT_PULL_TOKENS}`, async (req: Request, res: Response, next: NextFunction) => {
      req.body.id = req.params.id;
      await RouterUtils.handleRestServerAction(OCPIEndpointService.handlePullTokensEndpoint.bind(this), ServerAction.OCPI_CPO_GET_TOKENS, req, res, next);
    });
  }

  private buildRouteOcpiEndpointSendEVSEStatuses(): void {
    this.router.put(`/${RESTServerRoute.REST_OCPI_ENDPOINT_SEND_EVSE_STATUSES}`, async (req: Request, res: Response, next: NextFunction) => {
      req.body.id = req.params.id;
      await RouterUtils.handleRestServerAction(OCPIEndpointService.handlePushEVSEStatusesOcpiEndpoint.bind(this), ServerAction.OCPI_ENDPOINT_SEND_EVSE_STATUSES, req, res, next);
    });
  }

  private buildRouteOcpiEndpointSendTokens(): void {
    this.router.put(`/${RESTServerRoute.REST_OCPI_ENDPOINT_SEND_TOKENS}`, async (req: Request, res: Response, next: NextFunction) => {
      req.body.id = req.params.id;
      await RouterUtils.handleRestServerAction(OCPIEndpointService.handlePushTokensOcpiEndpoint.bind(this), ServerAction.OCPI_ENDPOINT_SEND_TOKENS, req, res, next);
    });
  }

  private buildRouteOcpiEndpointGenerateTokens(): void {
    this.router.put(`/${RESTServerRoute.REST_OCPI_ENDPOINT_GENERATE_LOCAL_TOKEN}`, async (req: Request, res: Response, next: NextFunction) => {
      req.body.id = req.params.id;
      await RouterUtils.handleRestServerAction(OCPIEndpointService.handleGenerateLocalTokenOcpiEndpoint.bind(this), ServerAction.OCPI_ENDPOINT_GENERATE_LOCAL_TOKEN, req, res, next);
    });
  }

  private buildRouteOcpiEndpoints(): void {
    this.router.get(`/${RESTServerRoute.REST_OCPI_ENDPOINTS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleRestServerAction(OCPIEndpointService.handleGetOcpiEndpoints.bind(this), ServerAction.OCPI_ENDPOINTS, req, res, next);
    });
  }

  private buildRouteOcpiEndpoint(): void {
    this.router.get(`/${RESTServerRoute.REST_OCPI_ENDPOINT}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleRestServerAction(OCPIEndpointService.handleGetOcpiEndpoint.bind(this), ServerAction.OCPI_ENDPOINT, req, res, next);
    });
  }

  private buildRouteOcpiEndpointUpdate(): void {
    this.router.put(`/${RESTServerRoute.REST_OCPI_ENDPOINT}`, async (req: Request, res: Response, next: NextFunction) => {
      req.body.id = req.params.id;
      await RouterUtils.handleRestServerAction(OCPIEndpointService.handleUpdateOcpiEndpoint.bind(this), ServerAction.OCPI_ENDPOINT_UPDATE, req, res, next);
    });
  }

  private buildRouteOcpiEndpointRegister(): void {
    this.router.put(`/${RESTServerRoute.REST_OCPI_ENDPOINT_REGISTER}`, async (req: Request, res: Response, next: NextFunction) => {
      req.body.id = req.params.id;
      await RouterUtils.handleRestServerAction(OCPIEndpointService.handleRegisterOcpiEndpoint.bind(this), ServerAction.OCPI_ENDPOINT_REGISTER, req, res, next);
    });
  }

  private buildRouteOcpiEndpointUnregister(): void {
    this.router.put(`/${RESTServerRoute.REST_OCPI_ENDPOINT_UNREGISTER}`, async (req: Request, res: Response, next: NextFunction) => {
      req.body.id = req.params.id;
      await RouterUtils.handleRestServerAction(OCPIEndpointService.handleUnregisterOcpiEndpoint.bind(this), ServerAction.OCPI_ENDPOINT_UNREGISTER, req, res, next);
    });
  }

  private buildRouteOcpiEndpointCredentialsUpdate(): void {
    this.router.put(`/${RESTServerRoute.REST_OCPI_ENDPOINT_CREDENTIALS}`, async (req: Request, res: Response, next: NextFunction) => {
      req.body.id = req.params.id;
      await RouterUtils.handleRestServerAction(OCPIEndpointService.handleUpdateCredentialsOcpiEndpoint.bind(this), ServerAction.OCPI_ENDPOINT_CREDENTIALS, req, res, next);
    });
  }

  private buildRouteOcpiEndpointDelete(): void {
    this.router.delete(`/${RESTServerRoute.REST_OCPI_ENDPOINT}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleRestServerAction(OCPIEndpointService.handleDeleteOcpiEndpoint.bind(this), ServerAction.OCPI_ENDPOINT_DELETE, req, res, next);
    });
  }
}
