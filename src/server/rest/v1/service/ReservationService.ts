import { NextFunction, Request, Response } from 'express';
import moment from 'moment';

import AuthorizationService from './AuthorizationService';
import UtilsService from './UtilsService';
import ChargingStationClient from '../../../../client/ocpp/ChargingStationClient';
import ChargingStationClientFactory from '../../../../client/ocpp/ChargingStationClientFactory';
import AppAuthError from '../../../../exception/AppAuthError';
import AppError from '../../../../exception/AppError';
import BackendError from '../../../../exception/BackendError';
import ChargingStationStorage from '../../../../storage/mongodb/ChargingStationStorage';
import ReservationStorage from '../../../../storage/mongodb/ReservationStorage';
import UserStorage from '../../../../storage/mongodb/UserStorage';
import { Action, Entity } from '../../../../types/Authorization';
import ChargingStation, { Connector } from '../../../../types/ChargingStation';
import { ReservationDataResult } from '../../../../types/DataResult';
import { ActionsResponse } from '../../../../types/GlobalType';
import { HTTPAuthError, HTTPError } from '../../../../types/HTTPError';
import {
  OCPPCancelReservationResponse,
  OCPPReserveNowResponse,
} from '../../../../types/ocpp/OCPPClient';
import { ChargePointStatus } from '../../../../types/ocpp/OCPPServer';
import {
  HttpReservationCancelRequest,
  HttpReservationCreateRequest,
  HttpReservationDeleteRequest,
  HttpReservationGetRequest,
  HttpReservationUpdateRequest,
  HttpReservationsDeleteRequest,
  HttpReservationsGetRequest,
} from '../../../../types/requests/HttpReservationRequest';
import Reservation, {
  ReservationStatus,
  ReservationStatusEnum,
  ReservationType,
} from '../../../../types/Reservation';
import { ServerAction } from '../../../../types/Server';
import Tag from '../../../../types/Tag';
import Tenant, { TenantComponents } from '../../../../types/Tenant';
import Constants from '../../../../utils/Constants';
import I18nManager from '../../../../utils/I18nManager';
import Logging from '../../../../utils/Logging';
import LoggingHelper from '../../../../utils/LoggingHelper';
import NotificationHelper from '../../../../utils/NotificationHelper';
import Utils from '../../../../utils/Utils';
import ReservationValidatorRest from '../validator/ReservationValidatorRest';

const MODULE_NAME = 'ReservationService';

export default class ReservationService {
  public static async handleGetReservation(
    action: ServerAction,
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    UtilsService.assertComponentIsActiveFromToken(
      req.user,
      TenantComponents.RESERVATION,
      Action.READ,
      Entity.RESERVATION,
      MODULE_NAME,
      'handleGetReservation'
    );
    const filteredRequest = ReservationValidatorRest.getInstance().validateReservationGetReq(
      req.query
    );
    const reservation = await ReservationService.getReservation(
      req,
      filteredRequest,
      action,
      Action.READ
    );
    res.json(reservation);
    next();
  }

  public static async handleGetReservations(
    action: ServerAction,
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    UtilsService.assertComponentIsActiveFromToken(
      req.user,
      TenantComponents.RESERVATION,
      Action.LIST,
      Entity.RESERVATION,
      MODULE_NAME,
      ReservationService.handleGetReservations.name
    );
    const filteredRequest = ReservationValidatorRest.getInstance().validateReservationsGetReq(
      req.query
    );
    const reservations = await ReservationService.getReservations(
      req,
      filteredRequest,
      Action.LIST
    );
    res.json(reservations);
    next();
  }

  public static async handleCreateReservation(
    action: ServerAction,
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    UtilsService.assertComponentIsActiveFromToken(
      req.user,
      TenantComponents.RESERVATION,
      Action.CREATE,
      Entity.RESERVATION,
      MODULE_NAME,
      ReservationService.handleCreateReservation.name
    );
    const filteredRequest = ReservationValidatorRest.getInstance().validateReservationCreateReq(
      req.body
    );
    const reservation = await ReservationService.saveReservation(
      req,
      action,
      Action.CREATE,
      filteredRequest
    );
    const user = await UserStorage.getUserByTagID(req.tenant, reservation.idTag);
    NotificationHelper.notifyReservationCreated(req.tenant, user, reservation);
    const response = reservation
      ? Object.assign({ id: reservation.id }, Constants.REST_RESPONSE_SUCCESS)
      : { status: HTTPError.RESERVATION_REJECTED_ERROR };
    res.json(response);
    next();
  }

  public static async handleUpdateReservation(
    action: ServerAction,
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    UtilsService.assertComponentIsActiveFromToken(
      req.user,
      TenantComponents.RESERVATION,
      Action.UPDATE,
      Entity.RESERVATION,
      MODULE_NAME,
      ReservationService.handleUpdateReservation.name
    );
    const filteredRequest = ReservationValidatorRest.getInstance().validateReservationUpdateReq(
      req.body
    );
    await ReservationService.saveReservation(req, action, Action.UPDATE, filteredRequest);
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleDeleteReservation(
    action: ServerAction,
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    UtilsService.assertComponentIsActiveFromToken(
      req.user,
      TenantComponents.RESERVATION,
      Action.DELETE,
      Entity.RESERVATION,
      MODULE_NAME,
      ReservationService.handleDeleteReservation.name
    );
    const filteredRequest = ReservationValidatorRest.getInstance().validateReservationDeleteReq(
      req.query
    );
    await ReservationService.deleteReservation(req, action, filteredRequest, Action.DELETE);
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleDeleteReservations(
    action: ServerAction,
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    UtilsService.assertComponentIsActiveFromToken(
      req.user,
      TenantComponents.RESERVATION,
      Action.DELETE,
      Entity.RESERVATION,
      MODULE_NAME,
      ReservationService.handleDeleteReservations.name
    );
    const filteredRequest = ReservationValidatorRest.getInstance().validateReservationsDeleteReq(
      req.body
    );
    const result = await ReservationService.deleteReservations(
      req,
      action,
      filteredRequest,
      Action.DELETE
    );
    res.json({ ...result, ...Constants.REST_RESPONSE_SUCCESS });
    next();
  }

  public static async handleCancelReservation(
    action: ServerAction,
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    UtilsService.assertComponentIsActiveFromToken(
      req.user,
      TenantComponents.RESERVATION,
      Action.CANCEL_RESERVATION,
      Entity.RESERVATION,
      MODULE_NAME,
      ReservationService.handleCancelReservation.name
    );
    const filteredRequest = ReservationValidatorRest.getInstance().validateReservationCancelReq(
      req.body
    );
    const reservation = await ReservationService.cancelReservation(
      req,
      action,
      Action.CANCEL_RESERVATION,
      filteredRequest
    );
    const user = await UserStorage.getUserByTagID(req.tenant, reservation.idTag);
    NotificationHelper.notifyReservationCancelled(req.tenant, user, reservation);
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleExportReservations(
    action: ServerAction,
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    req.query.limit = Constants.EXPORT_PAGE_SIZE.toString();
    const filteredRequest = ReservationValidatorRest.getInstance().validateReservationsGetReq(
      req.query
    );
    await AuthorizationService.checkAndGetReservationsAuthorizations(
      req.tenant,
      req.user,
      Action.EXPORT,
      filteredRequest
    );
    await UtilsService.exportToCSV(
      req,
      res,
      'exported-reservations.csv',
      filteredRequest,
      ReservationService.getReservations.bind(this, req, filteredRequest, Action.EXPORT),
      ReservationService.convertToCSV.bind(this)
    );
  }

  public static async handleImportReservations() {
    // TODO: Impl
  }

  public static async updateConnectorWithReservation(
    tenant: Tenant,
    chargingStation: ChargingStation,
    reservation: Partial<Reservation>,
    saveConnector = false
  ) {
    const connector = Utils.getConnectorFromID(chargingStation, reservation.connectorID);
    const user = await UserStorage.getUserByTagID(tenant, reservation.idTag);
    connector.currentUserID = user.id;
    connector.status = ChargePointStatus.RESERVED;
    connector.currentTagID = reservation.idTag;
    connector.reservationID = reservation.id;
    if (saveConnector) {
      await ChargingStationStorage.saveChargingStationConnectors(
        tenant,
        chargingStation.id,
        chargingStation.connectors
      );
    }
  }

  public static async resetConnectorReservation(
    tenant: Tenant,
    chargingStation: ChargingStation,
    connectorID: number,
    saveConnector = false
  ): Promise<Connector> {
    const connector = Utils.getConnectorFromID(chargingStation, connectorID);
    connector.currentUserID = null;
    connector.currentTagID = null;
    connector.reservationID = null;
    connector.status = ChargePointStatus.AVAILABLE;
    connector['reservation'] = null;
    if (saveConnector) {
      await ChargingStationStorage.saveChargingStationConnectors(
        tenant,
        chargingStation.id,
        chargingStation.connectors
      );
    }
    return connector;
  }

  public static async checkForReservationCollisions(
    tenant: Tenant,
    reservation: Partial<Reservation>
  ): Promise<Reservation[]> {
    const reservationsInRange = await ReservationStorage.getReservationsByDate(
      tenant,
      reservation.fromDate,
      reservation.toDate,
      reservation.arrivalTime as Date,
      reservation.departureTime as Date
    );
    const collisions = reservationsInRange.filter(
      (r) =>
        r.id !== reservation.id &&
        r.chargingStationID === reservation.chargingStationID &&
        r.connectorID === reservation.connectorID &&
        [ReservationStatus.IN_PROGRESS, ReservationStatus.SCHEDULED].includes(r.status)
    );
    if (collisions.length > 0) {
      throw new AppError({
        action: ServerAction.RESERVATION_CREATE,
        module: MODULE_NAME,
        method: ReservationService.checkForReservationCollisions.name,
        errorCode: HTTPError.RESERVATION_COLLISION_ERROR,
        message: `Unable to create reservation, because of collision with '${collisions.length} reservations'`,
      });
    }
    return collisions;
  }

  public static async preventMultipleReserveNow(
    tenant: Tenant,
    reservation: Partial<Reservation>,
    userID: string
  ) {
    if (reservation.type !== ReservationType.RESERVE_NOW) {
      return;
    }
    let existingReservations = await ReservationStorage.getReservationsForUser(
      tenant,
      userID,
      ReservationType.RESERVE_NOW,
      ReservationStatusEnum.IN_PROGRESS
    );
    existingReservations = existingReservations.filter((r) => r.id !== reservation.id);
    if (existingReservations.length > 0) {
      throw new AppError({
        action: ServerAction.RESERVATION_CREATE,
        module: MODULE_NAME,
        method: ReservationService.preventMultipleReserveNow.name,
        errorCode: HTTPError.RESERVATION_MULTIPLE_RESERVE_NOW_ERROR,
        message: `Unable to create reservation, because 'RESERVE NOW' reservation for user '${userID}' already exists`,
      });
    }
  }

  protected static checkReservationStatusTransition(
    reservation: Reservation,
    status: ReservationStatusEnum
  ): boolean {
    const fromStatus = reservation.status;
    let transitionAllowed = false;
    if (
      fromStatus === status ||
      Constants.ReservationStatusTransitions.findIndex(
        (transition) => transition.from === fromStatus && transition.to === status
      ) !== -1
    ) {
      transitionAllowed = true;
    } else {
      throw new AppError({
        action: ServerAction.RESERVATION_STATUS_TRANSITION,
        module: MODULE_NAME,
        method: ReservationService.checkReservationStatusTransition.name,
        errorCode: HTTPError.RESERVATION_INVALID_STATUS_TRANSITION_ERROR,
        message: `Transition from status ${fromStatus} to status ${status} is not permitted'`,
      });
    }
    return transitionAllowed;
  }

  private static async getReservation(
    req: Request,
    filteredRequest: HttpReservationGetRequest,
    action: ServerAction = ServerAction.RESERVATION,
    authAction: Action = Action.READ,
    additionalFilters: Record<string, any> = {}
  ): Promise<Reservation> {
    const authorizations = await AuthorizationService.checkAndGetReservationAuthorizations(
      req.tenant,
      req.user,
      filteredRequest,
      authAction
    );
    if (!authorizations.authorized) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: authAction,
        entity: Entity.RESERVATION,
        module: MODULE_NAME,
        method: ReservationService.handleGetReservation.name,
        value: filteredRequest.ID.toString(),
      });
    }
    UtilsService.assertIdIsProvided(
      action,
      filteredRequest.ID,
      MODULE_NAME,
      ReservationService.getReservation.name,
      req.user
    );
    const reservation = await ReservationStorage.getReservation(
      req.tenant,
      filteredRequest.ID as number,
      {
        ...additionalFilters,
        ...authorizations.filters,
        withChargingStation: filteredRequest.WithChargingStation,
        withSite: filteredRequest.WithSite,
        withSiteArea: filteredRequest.WithSiteArea,
        withTag: filteredRequest.WithTag,
        withCar: filteredRequest.WithCar,
        withUser: filteredRequest.WithUser,
      },
      authorizations.projectFields
    );
    if (authorizations.projectFields) {
      reservation.projectFields = authorizations.projectFields;
    }
    if (authorizations.metadata) {
      reservation.metadata = authorizations.metadata;
    }
    await AuthorizationService.addReservationAuthorizations(
      req.tenant,
      req.user,
      reservation,
      authorizations
    );
    return reservation;
  }

  private static async getReservations(
    req: Request,
    filteredRequest: HttpReservationsGetRequest,
    authAction: Action = Action.LIST,
    additionalFilters: Record<string, any> = {}
  ): Promise<ReservationDataResult> {
    const authorizations = await AuthorizationService.checkAndGetReservationsAuthorizations(
      req.tenant,
      req.user,
      authAction,
      filteredRequest,
      false
    );
    if (!authorizations.authorized) {
      return Constants.DB_EMPTY_DATA_RESULT;
    }
    const reservations = await ReservationStorage.getReservations(
      req.tenant,
      {
        search: filteredRequest.Search,
        reservationIDs: filteredRequest.ReservationID
          ? filteredRequest.ReservationID.split('|')
          : null,
        chargingStationIDs: filteredRequest.ChargingStationID
          ? filteredRequest.ChargingStationID.split('|')
          : null,
        connectorIDs: filteredRequest.ConnectorID ? filteredRequest.ConnectorID.split('|') : null,
        userIDs: filteredRequest.UserID ? filteredRequest.UserID.split('|') : null,
        siteIDs: filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : null,
        siteAreaIDs: filteredRequest.SiteAreaID ? filteredRequest.SiteAreaID.split('|') : null,
        companyIDs: filteredRequest.CompanyID ? filteredRequest.CompanyID.split('|') : null,
        dateRange: {
          fromDate: filteredRequest.StartDateTime ?? null,
          toDate: filteredRequest.EndDateTime ?? null,
        },
        slot: {
          arrivalTime: filteredRequest.ArrivalTime ?? null,
          departureTime: filteredRequest.DepartureTime ?? null,
        },
        statuses: filteredRequest.Status ? filteredRequest.Status.split('|') : null,
        types: filteredRequest.Type ? filteredRequest.Type.split('|') : null,
        withUser: filteredRequest.WithUser,
        withCar: filteredRequest.WithCar,
        withChargingStation: filteredRequest.WithChargingStation,
        withCompany: filteredRequest.WithCompany,
        withSite: filteredRequest.WithSite,
        withSiteArea: filteredRequest.WithSiteArea,
        withTag: filteredRequest.WithTag,
        ...additionalFilters,
        ...authorizations.filters,
      },
      {
        limit: filteredRequest.Limit,
        sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields),
        skip: filteredRequest.Skip,
        onlyRecordCount: filteredRequest.OnlyRecordCount,
      },
      authorizations.projectFields
    );
    if (authorizations.projectFields) {
      reservations.projectFields = authorizations.projectFields;
    }
    if (filteredRequest.WithAuth) {
      await AuthorizationService.addReservationsAuthorizations(
        req.tenant,
        req.user,
        reservations,
        authorizations
      );
    }
    return reservations;
  }

  private static async saveReservation(
    req: Request,
    action: ServerAction,
    authAction: Action,
    filteredRequest: HttpReservationCreateRequest | HttpReservationUpdateRequest
  ): Promise<Reservation> {
    await AuthorizationService.checkAndGetReservationAuthorizations(
      req.tenant,
      req.user,
      {},
      authAction,
      filteredRequest as Reservation
    );
    const existingReservation = await ReservationService.checkForDuplicates(
      req.tenant,
      filteredRequest as Reservation
    );
    const connector = await ReservationService.cleanUpDanglingReservations(
      req.tenant,
      filteredRequest as Reservation
    );
    // Check for another reservation already ongoing on connector
    // If they have not the same ID backend and CS are desynchronized
    ReservationService.checkForOngoingReservations(connector, filteredRequest as Reservation);
    let tag: Tag;
    if (!filteredRequest.idTag) {
      tag = await UtilsService.checkAndGetTagByVisualIDAuthorization(
        req.tenant,
        req.user,
        filteredRequest.visualTagID,
        Action.READ,
        ServerAction.RESERVATION_CREATE
      );
      filteredRequest.idTag = tag.id;
    }
    const reservationToSave = ReservationService.buildReservation(
      req,
      action,
      filteredRequest,
      existingReservation
    );
    await ReservationService.sanitizeMovedReservation(req, existingReservation, reservationToSave);
    await ReservationService.checkForReservationCollisions(req.tenant, reservationToSave);
    await ReservationService.preventMultipleReserveNow(
      req.tenant,
      { ...filteredRequest },
      tag.userID
    );
    const response = await ReservationService.contactChargingStation(
      req,
      action,
      reservationToSave
    );
    const error = ReservationService.handleReservationResponses(response, reservationToSave);
    if (error) {
      throw error;
    } else {
      await Logging.logInfo({
        ...LoggingHelper.getReservationProperties(reservationToSave),
        tenantID: req.tenant.id,
        user: req.user,
        module: MODULE_NAME,
        method: ReservationService.handleCreateReservation.name,
        message: `'${Utils.buildReservationName(reservationToSave)}' has been saved successfully`,
        action: action,
        detailedMessages: { reservationToSave },
      });
      return await ReservationStorage.saveReservation(req.tenant, reservationToSave);
    }
  }

  private static async deleteReservations(
    req: Request,
    action: ServerAction = ServerAction.RESERVATIONS_DELETE,
    filteredRequest: HttpReservationsDeleteRequest,
    authAction: Action = Action.DELETE
  ) {
    const reservationIDsToDelete = [];
    const result: ActionsResponse = {
      inSuccess: 0,
      inError: 0,
    };

    // Check dynamic auth for each transaction before initiating delete operations
    for (const reservationID of filteredRequest.reservationIDs) {
      await AuthorizationService.checkAndGetReservationAuthorizations(
        req.tenant,
        req.user,
        { ID: reservationID },
        authAction
      );
      reservationIDsToDelete.push(reservationID);
    }
    result.inSuccess = await ReservationStorage.deleteReservations(
      req.tenant,
      reservationIDsToDelete
    );
    await Logging.logActionsResponse(
      req.tenant.id,
      ServerAction.TRANSACTIONS_DELETE,
      MODULE_NAME,
      'deleteReservations',
      result,
      '{{inSuccess}} reservation(s) were successfully deleted',
      '{{inError}} reservation(s) failed to be deleted',
      '{{inSuccess}} reservation(s) were successfully deleted and {{inError}} failed to be deleted',
      'No reservations have been deleted',
      req.user
    );
    return result;
  }

  private static async deleteReservation(
    req: Request,
    action: ServerAction = ServerAction.RESERVATION_DELETE,
    filteredRequest: HttpReservationDeleteRequest,
    authAction: Action = Action.DELETE
  ): Promise<void> {
    await AuthorizationService.checkAndGetReservationAuthorizations(
      req.tenant,
      req.user,
      filteredRequest,
      authAction,
      {}
    );
    UtilsService.assertIdIsProvided(
      action,
      filteredRequest.ID,
      MODULE_NAME,
      ReservationService.deleteReservation.name,
      req.user
    );
    const reservation = await ReservationService.getReservation(req, filteredRequest);
    if ([ReservationStatus.IN_PROGRESS, null].includes(reservation.status)) {
      try {
        await ReservationService.contactChargingStation(req, action, reservation);
      } catch (error) {
        await Logging.logError({
          ...LoggingHelper.getReservationProperties(reservation),
          tenantID: req.tenant.id,
          user: req.user,
          module: MODULE_NAME,
          method: ReservationService.handleDeleteReservation.name,
          message: `'${Utils.buildReservationName(
            reservation
          )}' is not available on charging station`,
          action: action,
          detailedMessages: { reservation },
        });
      }
    }
    await ReservationStorage.deleteReservation(req.tenant, filteredRequest.ID);
  }

  private static async cancelReservation(
    req: Request,
    action: ServerAction = ServerAction.RESERVATION_CANCEL,
    authAction: Action = Action.CANCEL_RESERVATION,
    filteredRequest: HttpReservationCancelRequest
  ): Promise<Reservation> {
    await AuthorizationService.checkAndGetReservationAuthorizations(
      req.tenant,
      req.user,
      filteredRequest,
      authAction,
      filteredRequest.args as Reservation
    );
    UtilsService.assertIdIsProvided(
      action,
      filteredRequest.ID,
      MODULE_NAME,
      ReservationService.cancelReservation.name,
      req.user
    );
    const reservation = await ReservationService.getReservation(req, filteredRequest);
    ReservationService.checkReservationStatusTransition(
      reservation,
      ReservationStatusEnum.CANCELLED
    );
    if (reservation.status === ReservationStatus.IN_PROGRESS) {
      const result = await ReservationService.contactChargingStation(req, action, reservation);
      if (result.status.toUpperCase() !== 'ACCEPTED') {
        throw new AppError({
          action: ServerAction.RESERVATION_CANCEL,
          module: MODULE_NAME,
          method: ReservationService.cancelReservation.name,
          errorCode: HTTPError.RESERVATION_REJECTED_ERROR,
          message: 'Unable to cancel reservation, charging station return rejected',
        });
      }
    }
    reservation.status = ReservationStatus.CANCELLED;
    return await ReservationStorage.saveReservation(req.tenant, reservation);
  }

  private static determineReservationStatus(reservation: Reservation): ReservationStatusEnum {
    if (reservation.type === ReservationType.RESERVE_NOW) {
      return ReservationStatusEnum.IN_PROGRESS;
    }
    const actualDate = moment();
    const [slotStartTime, slotEndTime] = ReservationService.getSlotStartAndEndTime(reservation);
    if (
      actualDate.isBetween(slotStartTime, slotEndTime) &&
      actualDate.isBetween(reservation.fromDate, reservation.toDate)
    ) {
      return ReservationStatusEnum.IN_PROGRESS;
    } else if (actualDate.isBefore(slotStartTime)) {
      return ReservationStatusEnum.SCHEDULED;
    } else if (actualDate.isAfter(slotEndTime) && actualDate.isAfter(reservation.toDate)) {
      return ReservationStatusEnum.EXPIRED;
    }
  }

  private static async contactChargingStation(
    req: Request,
    action: ServerAction,
    reservation: Reservation
  ): Promise<OCPPReserveNowResponse | OCPPCancelReservationResponse> {
    // Get the Charging station
    try {
      reservation.chargingStation = await UtilsService.checkAndGetChargingStationAuthorization(
        req.tenant,
        req.user,
        reservation.chargingStationID,
        Action.READ,
        action,
        null,
        { withSite: true, withSiteArea: true }
      );
      // Get the OCPP Client
      const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(
        req.tenant,
        reservation.chargingStation
      );
      if (!chargingStationClient) {
        throw new BackendError({
          action,
          module: MODULE_NAME,
          method: ReservationService.contactChargingStation.name,
          message: 'Charging Station is not connected to the backend',
        });
      }
      switch (action) {
        case ServerAction.CHARGING_STATION_RESERVE_NOW:
        case ServerAction.RESERVATION_CREATE:
        case ServerAction.RESERVATION_UPDATE:
          return await ReservationService.reserveNow(
            req.tenant,
            chargingStationClient,
            reservation
          );
        case ServerAction.CHARGING_STATION_CANCEL_RESERVATION:
        case ServerAction.RESERVATION_CANCEL:
        case ServerAction.RESERVATION_DELETE:
        case ServerAction.RESERVATION_UNMET:
          return await ReservationService.cancelOCPPReservation(
            req.tenant,
            chargingStationClient,
            reservation
          );
        default:
          break;
      }
    } catch (error) {
      await Logging.logError({
        tenantID: req.tenant.id,
        user: req.user,
        module: MODULE_NAME,
        method: 'contactChargingStation',
        message: 'Unexpected error while contacting charging station',
        action: action,
        detailedMessages: { error: error.stack },
      });
    }
  }

  private static convertToCSV(
    req: Request,
    reservations: Reservation[],
    writeHeader = true
  ): string {
    const getDateCell = (requestedDate: Date, i18nManager: I18nManager) => {
      if (requestedDate) {
        return [
          i18nManager.formatDateTime(requestedDate, 'L') +
            ' ' +
            i18nManager.formatDateTime(requestedDate, 'LT'),
        ];
      }
      return [
        i18nManager.translate('general.invalidDate') +
          ' ' +
          i18nManager.translate('general.invalidTime'),
      ];
    };
    let headers = null;
    const i18nManager = I18nManager.getInstanceForLocale(req.user.locale);
    if (writeHeader) {
      headers = [
        'id',
        'chargingStation',
        'connector',
        'fromDate',
        'toDate',
        'expiryDate',
        'arrivalTime',
        'departureTime',
        'idTag',
        'parentIdTag',
        'car',
        'user',
        'type',
        'status',
        'createdOn',
      ].join(Constants.CSV_SEPARATOR);
    }
    const rows = reservations
      .map((reservation) => {
        const row = [
          reservation.id,
          reservation.chargingStationID,
          reservation.connectorID,
          getDateCell(reservation.fromDate, i18nManager),
          getDateCell(reservation.toDate, i18nManager),
          getDateCell(reservation.expiryDate, i18nManager),
          reservation.arrivalTime ? getDateCell(reservation.arrivalTime as Date, i18nManager) : '',
          reservation.departureTime
            ? getDateCell(reservation.departureTime as Date, i18nManager)
            : '',
          reservation.idTag,
          reservation.parentIdTag ?? '',
          reservation.carID ?? '',
          reservation.userID ?? '',
          reservation.type,
          reservation.status,
          getDateCell(reservation.createdOn, i18nManager),
        ].map((value) => Utils.escapeCsvValue(value));
        return row;
      })
      .join(Constants.CR_LF);
    return Utils.isNullOrUndefined(headers)
      ? Constants.CR_LF + rows
      : [headers, rows].join(Constants.CR_LF);
  }

  private static handleReservationResponses(
    response: OCPPReserveNowResponse | OCPPCancelReservationResponse,
    reservation: Reservation
  ) {
    switch (response?.status.toUpperCase()) {
      case 'REJECTED':
        return new AppError({
          action: ServerAction.RESERVATION_CREATE,
          module: MODULE_NAME,
          method: ReservationService.handleReservationResponses.name,
          errorCode: HTTPError.RESERVATION_REJECTED_ERROR,
          message: `Unable to create reservation, either reservation on connector '${reservation.connectorID}' is not supported or another error occurred'`,
        });
      case 'FAULTED':
        return new AppError({
          action: ServerAction.RESERVATION_CREATE,
          module: MODULE_NAME,
          method: ReservationService.handleReservationResponses.name,
          errorCode: HTTPError.RESERVATION_FAULTED_ERROR,
          message: `Unable to create reservation, charging station '${reservation.chargingStationID}' or connector '${reservation.connectorID}' are in faulted state'`,
        });
      case 'OCCUPIED':
        return new AppError({
          action: ServerAction.RESERVATION_CREATE,
          module: MODULE_NAME,
          method: ReservationService.handleReservationResponses.name,
          errorCode: HTTPError.RESERVATION_OCCUPIED_ERROR,
          message: `Unable to create reservation, connector '${reservation.connectorID}' seems to be occupied'`,
        });
      case 'UNAVAILABLE':
        return new AppError({
          action: ServerAction.RESERVATION_CREATE,
          module: MODULE_NAME,
          method: ReservationService.handleReservationResponses.name,
          errorCode: HTTPError.RESERVATION_UNAVAILABLE_ERROR,
          message: `Unable to create reservation, charging station '${reservation.chargingStationID}' or connector '${reservation.connectorID}' are unavailable now'`,
        });
    }
  }

  private static buildReservation(
    req: Request,
    action: ServerAction,
    filteredRequest: HttpReservationCreateRequest | HttpReservationUpdateRequest,
    oldReservation?: Reservation
  ): Reservation {
    const reservation: Reservation = {
      ...filteredRequest,
    };
    if (action === ServerAction.RESERVATION_UPDATE) {
      reservation.createdBy = oldReservation.createdBy;
      reservation.createdOn = oldReservation.createdOn;
      reservation.lastChangedBy = { id: req.user.id };
      reservation.lastChangedOn = new Date();
    } else {
      reservation.id = Utils.getRandomIntSafe();
      reservation.createdBy = { id: req.user.id };
      reservation.createdOn = new Date();
      reservation.userID = filteredRequest.userID ? filteredRequest.userID : req.user.id;
    }
    reservation.status = ReservationService.determineReservationStatus(reservation);
    return reservation;
  }

  private static getSlotStartTime(reservation: Reservation): Date {
    return Utils.buildDateTimeObject(moment().toDate(), reservation.arrivalTime);
  }

  private static getSlotEndTime(reservation: Reservation): Date {
    return Utils.buildDateTimeObject(moment().toDate(), reservation.departureTime);
  }

  private static getSlotStartAndEndTime(reservation: Reservation): [Date, Date] {
    return [
      ReservationService.getSlotStartTime(reservation),
      ReservationService.getSlotEndTime(reservation),
    ];
  }

  private static async reserveNow(
    tenant: Tenant,
    chargingStationClient: ChargingStationClient,
    reservation: Reservation
  ): Promise<OCPPReserveNowResponse> | null {
    const [slotStartTime, slotEndTime] = ReservationService.getSlotStartAndEndTime(reservation);
    if (
      (moment().isBetween(slotStartTime, slotEndTime) &&
        moment().isBetween(reservation.fromDate, reservation.toDate)) ||
      reservation.type === ReservationType.RESERVE_NOW
    ) {
      const response = await chargingStationClient.reserveNow({
        connectorId: reservation.connectorID,
        expiryDate: slotEndTime,
        idTag: reservation.idTag,
        parentIdTag: reservation.parentIdTag,
        reservationId: reservation.id,
      });
      if (response.status.toUpperCase() === 'ACCEPTED') {
        await ReservationService.updateConnectorWithReservation(
          tenant,
          reservation.chargingStation,
          reservation,
          true
        );
      }
      return response;
    }
  }

  private static async cancelOCPPReservation(
    tenant: Tenant,
    chargingStationClient: ChargingStationClient,
    reservation: Reservation
  ): Promise<OCPPCancelReservationResponse> | null {
    const response = await chargingStationClient.cancelReservation({
      reservationId: reservation.id,
    });

    if (response.status.toUpperCase() === 'ACCEPTED') {
      await ReservationService.resetConnectorReservation(
        tenant,
        reservation.chargingStation,
        reservation.connectorID
      );
    }
    return response;
  }

  private static async checkForDuplicates(
    tenant: Tenant,
    reservation: Reservation
  ): Promise<Reservation> {
    const existingReservation = await ReservationStorage.getReservation(tenant, reservation.id, {
      withTag: true,
    });
    if (
      !Utils.isNullOrUndefined(existingReservation) &&
      existingReservation?.tag.visualID !== reservation.visualTagID
    ) {
      throw new AppError({
        action: ServerAction.RESERVATION_CREATE,
        module: MODULE_NAME,
        method: ReservationService.checkForDuplicates.name,
        errorCode: HTTPError.RESERVATION_ALREADY_EXISTS_ERROR,
        message: 'Unable to create reservation, reservation with same ID exists for another user',
      });
    }
    return existingReservation;
  }

  private static async cleanUpDanglingReservations(tenant: Tenant, reservation: Reservation) {
    const chargingStation = await ChargingStationStorage.getChargingStation(
      tenant,
      reservation.chargingStationID,
      { withReservation: true }
    );
    const connector = Utils.getConnectorFromID(chargingStation, reservation.connectorID);
    if (
      ![ReservationStatus.IN_PROGRESS, ReservationStatus.SCHEDULED].includes(
        connector?.reservation?.status
      )
    ) {
      return await ReservationService.resetConnectorReservation(
        tenant,
        chargingStation,
        connector.connectorId,
        true
      );
    }
  }

  private static checkForOngoingReservations(connector: Connector, reservation?: Reservation) {
    if (
      !Utils.isNullOrUndefined(connector?.reservation) &&
      Number(connector?.reservation.id) !== reservation.id &&
      reservation.type === ReservationType.RESERVE_NOW
    ) {
      throw new AppError({
        action: ServerAction.RESERVATION_CREATE,
        module: MODULE_NAME,
        method: ReservationService.checkForOngoingReservations.name,
        errorCode: HTTPError.RESERVATION_OCCUPIED_ERROR,
        message: 'Unable to create reservation, connector has already a reservation ongoing',
      });
    }
  }

  private static async sanitizeMovedReservation(
    req: Request,
    existing: Reservation,
    updated: Reservation
  ): Promise<void> {
    if (existing) {
      ReservationService.checkReservationStatusTransition(existing, updated.status);
      // In case the updated reservation changed the CS or the time ranges
      const [existingSlotStartTime, existingSlotEndTime] =
        ReservationService.getSlotStartAndEndTime(existing);
      const [newSlotStartTime, newSlotEndTime] =
        ReservationService.getSlotStartAndEndTime(existing);
      if (
        existing.chargingStationID !== updated.chargingStationID ||
        existing.connectorID !== updated.connectorID ||
        moment(updated.fromDate).isAfter(existing.toDate) ||
        moment(existingSlotStartTime).isAfter(newSlotStartTime) ||
        moment(existingSlotEndTime).isAfter(newSlotEndTime)
      ) {
        await ReservationService.contactChargingStation(
          req,
          ServerAction.RESERVATION_CANCEL,
          existing
        );
      }
    }
  }
}
