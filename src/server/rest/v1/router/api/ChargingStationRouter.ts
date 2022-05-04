import { RESTServerRoute, ServerAction } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import ChargingStationService from '../../service/ChargingStationService';
import RouterUtils from '../../../../../utils/RouterUtils';
import TransactionService from '../../service/TransactionService';

export default class ChargingStationRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteChargingStationsInError();
    this.buildRouteChargingStationsExport();
    this.buildRouteChargingStationGetChargingProfiles();
    this.buildRouteChargingStationRequestOCPPParameters();
    this.buildRouteChargingStationDeleteChargingProfile();
    this.buildRouteChargingStationUpdateChargingProfile();
    this.buildRouteChargingStationCreateChargingProfile();
    this.buildRouteChargingStationChangeAvailability();
    this.buildRouteChargingStationTransactions();
    this.buildRouteChargingStations();
    this.buildRouteChargingStation();
    this.buildRouteChargingStationDelete();
    this.buildRouteChargingStationReset();
    this.buildRouteChargingStationClearCache();
    this.buildRouteChargingStationTriggerDataTransfer();
    this.buildRouteChargingStationRetrieveConfiguration();
    this.buildRouteChargingStationChangeConfiguration();
    this.buildRouteChargingStationRemoteStart();
    this.buildRouteChargingStationRemoteStop();
    this.buildRouteChargingStationUnlockConnector();
    this.buildRouteChargingStationGenerateQRCode();
    this.buildRouteChargingStationGetCompositeSchedule();
    this.buildRouteChargingStationGetDiagnostics();
    this.buildRouteChargingStationUpdateFirmware();
    this.buildRouteChargingStationDownloadQRCode();
    this.buildRouteChargingStationGetOCPPParameters();
    this.buildRouteChargingStationExportOCPPParameters();
    this.buildRouteChargingStationUpdateParameters();
    this.buildRouteChargingStationLimitPower();
    this.buildRouteChargingStationCheckSmartCharging();
    this.buildRouteChargingStationTriggerSmartCharging();
    this.buildRouteChargingStationGetBootNotifications();
    this.buildRouteChargingStationGetStatusNotifications();
    this.buildRouteChargingStationReserveNow();
    this.buildRouteChargingStationCancelReservation();
    return this.router;
  }

  private buildRouteChargingStations(): void {
    this.router.get(`/${RESTServerRoute.REST_CHARGING_STATIONS}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(ChargingStationService.handleGetChargingStations.bind(this), ServerAction.CHARGING_STATIONS, req, res, next);
    });
  }

  private buildRouteChargingStation(): void {
    this.router.get(`/${RESTServerRoute.REST_CHARGING_STATION}`, (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      void RouterUtils.handleRestServerAction(ChargingStationService.handleGetChargingStation.bind(this), ServerAction.CHARGING_STATION, req, res, next);
    });
  }

  private buildRouteChargingStationDelete(): void {
    this.router.delete(`/${RESTServerRoute.REST_CHARGING_STATIONS}/:id`, (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      void RouterUtils.handleRestServerAction(ChargingStationService.handleDeleteChargingStation.bind(this), ServerAction.CHARGING_STATION_DELETE, req, res, next);
    });
  }

  private buildRouteChargingStationReset(): void {
    this.router.put(`/${RESTServerRoute.REST_CHARGING_STATIONS_RESET}`, (req: Request, res: Response, next: NextFunction) => {
      req.body.chargingStationID = req.params.id;
      void RouterUtils.handleRestServerAction(ChargingStationService.handleOcppAction.bind(this), ServerAction.CHARGING_STATION_RESET, req, res, next);
    });
  }

  private buildRouteChargingStationClearCache(): void {
    this.router.put(`/${RESTServerRoute.REST_CHARGING_STATIONS_CACHE_CLEAR}`, (req: Request, res: Response, next: NextFunction) => {
      req.body.chargingStationID = req.params.id;
      void RouterUtils.handleRestServerAction(ChargingStationService.handleOcppAction.bind(this), ServerAction.CHARGING_STATION_CLEAR_CACHE, req, res, next);
    });
  }

  private buildRouteChargingStationTriggerDataTransfer(): void {
    this.router.put(`/${RESTServerRoute.REST_CHARGING_STATIONS_TRIGGER_DATA_TRANSFER}`, (req: Request, res: Response, next: NextFunction) => {
      req.body.chargingStationID = req.params.id;
      void RouterUtils.handleRestServerAction(ChargingStationService.handleOcppAction.bind(this), ServerAction.CHARGING_STATION_TRIGGER_DATA_TRANSFER, req, res, next);
    });
  }

  private buildRouteChargingStationRetrieveConfiguration(): void {
    this.router.put(`/${RESTServerRoute.REST_CHARGING_STATIONS_RETRIEVE_CONFIGURATION}`, (req: Request, res: Response, next: NextFunction) => {
      req.body.chargingStationID = req.params.id;
      void RouterUtils.handleRestServerAction(ChargingStationService.handleOcppAction.bind(this), ServerAction.CHARGING_STATION_GET_CONFIGURATION, req, res, next);
    });
  }

  private buildRouteChargingStationChangeConfiguration(): void {
    this.router.put(`/${RESTServerRoute.REST_CHARGING_STATIONS_CHANGE_CONFIGURATION}`, (req: Request, res: Response, next: NextFunction) => {
      req.body.chargingStationID = req.params.id;
      void RouterUtils.handleRestServerAction(ChargingStationService.handleOcppAction.bind(this), ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION, req, res, next);
    });
  }

  private buildRouteChargingStationRemoteStart(): void {
    this.router.put(`/${RESTServerRoute.REST_CHARGING_STATIONS_REMOTE_START}`, (req: Request, res: Response, next: NextFunction) => {
      req.body.chargingStationID = req.params.id;
      void RouterUtils.handleRestServerAction(ChargingStationService.handleOcppAction.bind(this), ServerAction.CHARGING_STATION_REMOTE_START_TRANSACTION, req, res, next);
    });
  }

  private buildRouteChargingStationRemoteStop(): void {
    this.router.put(`/${RESTServerRoute.REST_CHARGING_STATIONS_REMOTE_STOP}`, (req: Request, res: Response, next: NextFunction) => {
      req.body.chargingStationID = req.params.id;
      void RouterUtils.handleRestServerAction(ChargingStationService.handleOcppAction.bind(this), ServerAction.CHARGING_STATION_REMOTE_STOP_TRANSACTION, req, res, next);
    });
  }

  private buildRouteChargingStationUnlockConnector(): void {
    this.router.put(`/${RESTServerRoute.REST_CHARGING_STATIONS_UNLOCK_CONNECTOR}`, (req: Request, res: Response, next: NextFunction) => {
      req.body.chargingStationID = req.params.id;
      req.body.args = { ...req.body.args, connectorId: req.params.connectorId };
      void RouterUtils.handleRestServerAction(ChargingStationService.handleOcppAction.bind(this), ServerAction.CHARGING_STATION_UNLOCK_CONNECTOR, req, res, next);
    });
  }

  private buildRouteChargingStationGetCompositeSchedule(): void {
    this.router.put(`/${RESTServerRoute.REST_CHARGING_STATIONS_GET_COMPOSITE_SCHEDULE}`, (req: Request, res: Response, next: NextFunction) => {
      req.body.chargingStationID = req.params.id;
      void RouterUtils.handleRestServerAction(ChargingStationService.handleOcppAction.bind(this), ServerAction.CHARGING_STATION_GET_COMPOSITE_SCHEDULE, req, res, next);
    });
  }

  private buildRouteChargingStationGetDiagnostics(): void {
    this.router.put(`/${RESTServerRoute.REST_CHARGING_STATIONS_GET_DIAGNOSTICS}`, (req: Request, res: Response, next: NextFunction) => {
      req.body.chargingStationID = req.params.id;
      void RouterUtils.handleRestServerAction(ChargingStationService.handleOcppAction.bind(this), ServerAction.CHARGING_STATION_GET_DIAGNOSTICS, req, res, next);
    });
  }

  private buildRouteChargingStationUpdateFirmware(): void {
    this.router.put(`/${RESTServerRoute.REST_CHARGING_STATIONS_FIRMWARE_UPDATE}`, (req: Request, res: Response, next: NextFunction) => {
      req.body.chargingStationID = req.params.id;
      void RouterUtils.handleRestServerAction(ChargingStationService.handleOcppAction.bind(this), ServerAction.CHARGING_STATION_UPDATE_FIRMWARE, req, res, next);
    });
  }

  private buildRouteChargingStationChangeAvailability(): void {
    this.router.put(`/${RESTServerRoute.REST_CHARGING_STATIONS_CHANGE_AVAILABILITY}`, (req: Request, res: Response, next: NextFunction) => {
      req.body.chargingStationID = req.params.id;
      void RouterUtils.handleRestServerAction(ChargingStationService.handleOcppAction.bind(this), ServerAction.CHARGING_STATION_CHANGE_AVAILABILITY, req, res, next);
    });
  }

  private buildRouteChargingStationGenerateQRCode(): void {
    this.router.get(`/${RESTServerRoute.REST_CHARGING_STATIONS_QRCODE_GENERATE}`, (req: Request, res: Response, next: NextFunction) => {
      req.query.ChargingStationID = req.params.id;
      req.query.ConnectorID = req.params.connectorId;
      void RouterUtils.handleRestServerAction(ChargingStationService.handleGenerateQrCodeForConnector.bind(this), ServerAction.GENERATE_QR_CODE_FOR_CONNECTOR, req, res, next);
    });
  }

  private buildRouteChargingStationDownloadQRCode(): void {
    this.router.get(`/${RESTServerRoute.REST_CHARGING_STATIONS_QRCODE_DOWNLOAD}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(ChargingStationService.handleDownloadQrCodesPdf.bind(this), ServerAction.CHARGING_STATION_DOWNLOAD_QR_CODE_PDF, req, res, next);
    });
  }

  private buildRouteChargingStationGetOCPPParameters(): void {
    this.router.get(`/${RESTServerRoute.REST_CHARGING_STATION_GET_OCPP_PARAMETERS}`, (req: Request, res: Response, next: NextFunction) => {
      req.query.ChargingStationID = req.params.id;
      void RouterUtils.handleRestServerAction(ChargingStationService.handleGetChargingStationOcppParameters.bind(this),
        ServerAction.CHARGING_STATIONS_OCPP_PARAMETERS, req, res, next);
    });
  }

  private buildRouteChargingStationRequestOCPPParameters(): void {
    this.router.post(`/${RESTServerRoute.REST_CHARGING_STATIONS_REQUEST_OCPP_PARAMETERS}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(ChargingStationService.handleRequestChargingStationOcppParameters.bind(this),
        ServerAction.CHARGING_STATION_REQUEST_OCPP_PARAMETERS, req, res, next);
    });
  }

  private buildRouteChargingStationExportOCPPParameters(): void {
    this.router.get(`/${RESTServerRoute.REST_CHARGING_STATIONS_EXPORT_OCPP_PARAMETERS}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(ChargingStationService.handleExportChargingStationsOCPPParams.bind(this),
        ServerAction.CHARGING_STATIONS_OCPP_PARAMS_EXPORT, req, res, next);
    });
  }

  private buildRouteChargingStationUpdateParameters(): void {
    this.router.put(`/${RESTServerRoute.REST_CHARGING_STATIONS_UPDATE_PARAMETERS}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(ChargingStationService.handleUpdateChargingStationParams.bind(this), ServerAction.CHARGING_STATION_UPDATE_PARAMS, req, res, next);
    });
  }

  private buildRouteChargingStationLimitPower(): void {
    this.router.put(`/${RESTServerRoute.REST_CHARGING_STATIONS_POWER_LIMIT}`, (req: Request, res: Response, next: NextFunction) => {
      req.body.chargingStationID = req.params.id;
      void RouterUtils.handleRestServerAction(ChargingStationService.handleChargingStationLimitPower.bind(this), ServerAction.CHARGING_STATION_LIMIT_POWER, req, res, next);
    });
  }

  private buildRouteChargingStationTransactions(): void {
    this.router.get(`/${RESTServerRoute.REST_CHARGING_STATIONS_TRANSACTIONS}`, (req: Request, res: Response, next: NextFunction) => {
      req.query.ChargingStationID = req.params.id;
      void RouterUtils.handleRestServerAction(TransactionService.handleGetChargingStationTransactions.bind(this), ServerAction.CHARGING_STATION_TRANSACTIONS, req, res, next);
    });
  }

  private buildRouteChargingStationsInError(): void {
    this.router.get(`/${RESTServerRoute.REST_CHARGING_STATIONS_IN_ERROR}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(ChargingStationService.handleGetChargingStationsInError.bind(this), ServerAction.CHARGING_STATIONS_IN_ERROR, req, res, next);
    });
  }

  private buildRouteChargingStationsExport(): void {
    this.router.get(`/${RESTServerRoute.REST_CHARGING_STATIONS_EXPORT}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(ChargingStationService.handleExportChargingStations.bind(this), ServerAction.CHARGING_STATIONS_EXPORT, req, res, next);
    });
  }

  private buildRouteChargingStationCheckSmartCharging(): void {
    this.router.get(`/${RESTServerRoute.REST_CHARGING_STATION_CHECK_SMART_CHARGING_CONNECTION}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(ChargingStationService.handleCheckSmartChargingConnection.bind(this), ServerAction.CHECK_SMART_CHARGING_CONNECTION, req, res, next);
    });
  }

  private buildRouteChargingStationTriggerSmartCharging(): void {
    this.router.get(`/${RESTServerRoute.REST_CHARGING_STATION_TRIGGER_SMART_CHARGING}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(ChargingStationService.handleTriggerSmartCharging.bind(this), ServerAction.TRIGGER_SMART_CHARGING, req, res, next);
    });
  }

  private buildRouteChargingStationGetChargingProfiles(): void {
    this.router.get(`/${RESTServerRoute.REST_CHARGING_PROFILES}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(ChargingStationService.handleGetChargingProfiles.bind(this), ServerAction.CHARGING_PROFILES, req, res, next);
    });
  }

  private buildRouteChargingStationCreateChargingProfile(): void {
    this.router.post(`/${RESTServerRoute.REST_CHARGING_PROFILES}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(ChargingStationService.handleCreateChargingProfile.bind(this), ServerAction.CHARGING_PROFILE_CREATE, req, res, next);
    });
  }

  private buildRouteChargingStationUpdateChargingProfile(): void {
    this.router.put(`/${RESTServerRoute.REST_CHARGING_PROFILE}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(ChargingStationService.handleUpdateChargingProfile.bind(this), ServerAction.CHARGING_PROFILE_UPDATE, req, res, next);
    });
  }

  private buildRouteChargingStationDeleteChargingProfile(): void {
    this.router.delete(`/${RESTServerRoute.REST_CHARGING_PROFILE}`, (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      void RouterUtils.handleRestServerAction(ChargingStationService.handleDeleteChargingProfile.bind(this), ServerAction.CHARGING_PROFILE_DELETE, req, res, next);
    });
  }

  private buildRouteChargingStationGetBootNotifications(): void {
    this.router.get(`/${RESTServerRoute.REST_CHARGING_STATIONS_BOOT_NOTIFICATIONS}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(ChargingStationService.handleGetBootNotifications.bind(this), ServerAction.BOOT_NOTIFICATIONS, req, res, next);
    });
  }

  private buildRouteChargingStationGetStatusNotifications(): void {
    this.router.get(`/${RESTServerRoute.REST_CHARGING_STATIONS_STATUS_NOTIFICATIONS}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(ChargingStationService.handleGetStatusNotifications.bind(this), ServerAction.STATUS_NOTIFICATIONS, req, res, next);
    });
  }

  private buildRouteChargingStationReserveNow(): void {
    this.router.put(`/${RESTServerRoute.REST_CHARGING_STATIONS_RESERVE_NOW}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(ChargingStationService.handleReserveNow.bind(this), ServerAction.CHARGING_STATION_RESERVE_NOW, req, res, next);
    });
  }

  private buildRouteChargingStationCancelReservation(): void {
    this.router.put(`/${RESTServerRoute.REST_CHARGING_STATIONS_CANCEL_RESERVATION}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(ChargingStationService.handleCancelReservation.bind(this), ServerAction.CHARGING_STATION_CANCEL_RESERVATION, req, res, next);
    });
  }
}
