import AbstractEndpoint from '../AbstractEndpoint';
import Constants from '../../../../utils/Constants';
import OCPIUtils from '../../OCPIUtils';
import { NextFunction, Request, Response } from 'express';
import Tenant from '../../../../types/Tenant';
import AppError from '../../../../exception/AppError';
import AbstractOCPIService from '../../AbstractOCPIService';
import UserStorage from '../../../../storage/mongodb/UserStorage';
import TransactionStorage from '../../../../storage/mongodb/TransactionStorage';
import { OCPISession, OCPISessionStatus } from '../../../../types/ocpi/OCPISession';
import Transaction, { InactivityStatus } from '../../../../types/Transaction';
import moment from 'moment';
import ChargingStationStorage from '../../../../storage/mongodb/ChargingStationStorage';
import { OCPILocation } from '../../../../types/ocpi/OCPILocation';

const EP_IDENTIFIER = 'sessions';
const MODULE_NAME = 'EMSPSessionsEndpoint';

const RECORDS_LIMIT = 100;
/**
 * EMSP Tokens Endpoint
 */
export default class EMSPSessionsEndpoint extends AbstractEndpoint {
  // Create OCPI Service
  constructor(ocpiService: AbstractOCPIService) {
    super(ocpiService, EP_IDENTIFIER);
  }

  /**
   * Main Process Method for the endpoint
   */
  async process(req: Request, res: Response, next: NextFunction, tenant: Tenant, options: { countryID: string; partyID: string; addChargeBoxID?: boolean }) {
    switch (req.method) {
      case 'GET':
        await this.getSessionRequest(req, res, next, tenant);
        break;
      case 'PATCH':
        await this.patchSessionRequest(req, res, next, tenant);
        break;
      case 'PUT':
        await this.putSessionRequest(req, res, next, tenant);
        break;
      default:
        res.sendStatus(501);
        break;
    }
  }

  /**
   * Get the Session object from the eMSP system by its id {session_id}.
   *
   * /sessions/{country_code}/{party_id}/{session_id}
   *
   */
  private async getSessionRequest(req: Request, res: Response, next: NextFunction, tenant: Tenant) {
    const urlSegment = req.path.substring(1).split('/');
    // Remove action
    urlSegment.shift();

    // Get filters
    const countryCode = urlSegment.shift();
    const partyId = urlSegment.shift();
    const sessionId = urlSegment.shift();

    if (!countryCode || !partyId || !sessionId) {
      throw new AppError({
        source: Constants.OCPI_SERVER,
        module: MODULE_NAME,
        method: 'getSessionRequest',
        errorCode: Constants.HTTP_GENERAL_ERROR,
        message: 'Missing request parameters',
        ocpiError: Constants.OCPI_STATUS_CODE.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }

    res.json(OCPIUtils.success());
  }

  /**
   * Send a new/updated Session object.
   *
   * /sessions/{country_code}/{party_id}/{session_id}
   */
  private async putSessionRequest(req: Request, res: Response, next: NextFunction, tenant: Tenant) {
    const urlSegment = req.path.substring(1).split('/');
    // Remove action
    urlSegment.shift();

    // Get filters
    const countryCode = urlSegment.shift();
    const partyId = urlSegment.shift();
    const sessionId = urlSegment.shift();

    if (!countryCode || !partyId || !sessionId) {
      throw new AppError({
        source: Constants.OCPI_SERVER,
        module: MODULE_NAME,
        method: 'putSessionRequest',
        errorCode: Constants.HTTP_GENERAL_ERROR,
        message: 'Missing request parameters',
        ocpiError: Constants.OCPI_STATUS_CODE.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }

    const session: OCPISession = req.body as OCPISession;

    if (!this.validateSession(session)) {
      throw new AppError({
        source: Constants.OCPI_SERVER,
        module: MODULE_NAME,
        method: 'putSessionRequest',
        errorCode: Constants.HTTP_GENERAL_ERROR,
        message: 'Session object is invalid',
        detailedMessages: session,
        ocpiError: Constants.OCPI_STATUS_CODE.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }

    let transaction: Transaction = await TransactionStorage.getOCPITransaction(tenant.id, session.id);
    if (!transaction) {
      const user = await UserStorage.getUserByTagId(tenant.id, session.auth_id);
      if (!user) {
        throw new AppError({
          source: Constants.OCPI_SERVER,
          module: MODULE_NAME,
          method: 'putSessionRequest',
          errorCode: Constants.HTTP_GENERAL_ERROR,
          message: `No user found for auth_id ${session.auth_id}`,
          detailedMessages: session,
          ocpiError: Constants.OCPI_STATUS_CODE.CODE_2001_INVALID_PARAMETER_ERROR
        });
      }

      const chargingStation = await ChargingStationStorage.getChargingStation(tenant.id, session.location.evses[0].evse_id);
      if (!chargingStation) {
        throw new AppError({
          source: Constants.OCPI_SERVER,
          module: MODULE_NAME,
          method: 'putSessionRequest',
          errorCode: Constants.HTTP_GENERAL_ERROR,
          message: `No charging station found for evse_id ${session.location.evses[0].evse_id}`,
          detailedMessages: session,
          ocpiError: Constants.OCPI_STATUS_CODE.CODE_2003_UNKNOW_LOCATION_ERROR
        });
      }

      transaction = {
        userID: user.id,
        tagID: session.auth_id,
        timestamp: session.start_datetime,
        lastUpdate: session.last_updated,
        chargeBoxID: chargingStation.id,
        meterStart: 0,
        currentTotalConsumption: session.kwh,
        stateOfCharge: 0,
        currentStateOfCharge: 0,
        currentTotalInactivitySecs: 0,
        ocpiSession: session
      } as Transaction;
    }
    transaction.ocpiSession = session;
    transaction.lastUpdate = session.last_updated;

    if (session.end_datetime || session.status === OCPISessionStatus.COMPLETED) {
      transaction.stop = {
        extraInactivityComputed: false,
        extraInactivitySecs: 0,
        meterStop: session.kwh,
        price: 0,
        priceUnit: session.currency,
        pricingSource: '',
        roundedPrice: 0,
        stateOfCharge: 0,
        tagID: session.auth_id,
        timestamp: session.end_datetime,
        totalConsumption: session.kwh,
        totalDurationSecs: Math.round(moment.duration(moment(transaction.stop.timestamp).diff(moment(transaction.timestamp))).asSeconds()),
        totalInactivitySecs: 0,
        userID: transaction.userID
      };
    }

    await TransactionStorage.saveTransaction(tenant.id, transaction);

    res.json(OCPIUtils.success({}));
  }

  /**
   * Update the Session object of id {session_id}.
   *
   * /sessions/{country_code}/{party_id}/{session_id}
   */
  private async patchSessionRequest(req: Request, res: Response, next: NextFunction, tenant: Tenant) {
    const urlSegment = req.path.substring(1).split('/');
    // Remove action
    urlSegment.shift();

    // Get filters
    const countryCode = urlSegment.shift();
    const partyId = urlSegment.shift();
    const sessionId = urlSegment.shift();

    if (!countryCode || !partyId || !sessionId) {
      throw new AppError({
        source: Constants.OCPI_SERVER,
        module: MODULE_NAME,
        method: 'getSessionRequest',
        errorCode: Constants.HTTP_GENERAL_ERROR,
        message: 'Missing request parameters',
        ocpiError: Constants.OCPI_STATUS_CODE.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    res.json(OCPIUtils.success({}));
  }

  private validateSession(session: OCPISession): boolean {
    if (!session.id
      || !session.start_datetime
      || !session.kwh
      || !session.auth_id
      || !session.auth_method
      || !session.location
      || !session.currency
      || !session.status
      || !session.last_updated
    ) {
      return false;
    }
    return this.validateLocation(session.location);
  }

  private validateLocation(location: OCPILocation): boolean {
    if (!location.evses || location.evses.length !== 1 || !location.evses[0].evse_id) {
      return false;
    }
    return true;
  }
}

