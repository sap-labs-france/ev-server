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
import Utils from '../../../../utils/Utils';
import { OCPIResponse } from '../../../../types/ocpi/OCPIResponse';
import Consumption from '../../../../types/Consumption';
import ConsumptionStorage from '../../../../storage/mongodb/ConsumptionStorage';
import OCPIEndpoint from '../../../../types/ocpi/OCPIEndpoint';

const EP_IDENTIFIER = 'sessions';
const MODULE_NAME = 'EMSPSessionsEndpoint';
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
  async process(req: Request, res: Response, next: NextFunction, tenant: Tenant, ocpiEndpoint: OCPIEndpoint, options: { countryID: string; partyID: string; addChargeBoxID?: boolean }): Promise<OCPIResponse> {
    switch (req.method) {
      case 'GET':
        return await this.getSessionRequest(req, res, next, tenant);
      case 'PATCH':
        return await this.patchSessionRequest(req, res, next, tenant);
      case 'PUT':
        return await this.putSessionRequest(req, res, next, tenant);
    }
  }

  /**
   * Get the Session object from the eMSP system by its id {session_id}.
   *
   * /sessions/{country_code}/{party_id}/{session_id}
   *
   */
  private async getSessionRequest(req: Request, res: Response, next: NextFunction, tenant: Tenant): Promise<OCPIResponse> {
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

    const transaction: Transaction = await TransactionStorage.getOCPITransaction(tenant.id, sessionId);
    if (!transaction) {
      throw new AppError({
        source: Constants.OCPI_SERVER,
        module: MODULE_NAME,
        method: 'getSessionRequest',
        errorCode: Constants.HTTP_GENERAL_ERROR,
        message: `No transaction found for ocpi session ${sessionId}`,
        ocpiError: Constants.OCPI_STATUS_CODE.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }

    return OCPIUtils.success(transaction.ocpiSession);
  }

  /**
   * Send a new/updated Session object.
   *
   * /sessions/{country_code}/{party_id}/{session_id}
   */
  private async putSessionRequest(req: Request, res: Response, next: NextFunction, tenant: Tenant): Promise<OCPIResponse> {
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

    let transaction: Transaction = await TransactionStorage.getOCPITransaction(tenant.id, sessionId);
    if (!transaction) {
      const user = await UserStorage.getUser(tenant.id, session.auth_id);
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

      const evse = session.location.evses[0];
      const chargingStation = await ChargingStationStorage.getChargingStation(tenant.id, evse.evse_id);
      if (!chargingStation) {
        throw new AppError({
          source: Constants.OCPI_SERVER,
          module: MODULE_NAME,
          method: 'putSessionRequest',
          errorCode: Constants.HTTP_GENERAL_ERROR,
          message: `No charging station found for evse_id ${evse.evse_id}`,
          detailedMessages: session,
          ocpiError: Constants.OCPI_STATUS_CODE.CODE_2003_UNKNOW_LOCATION_ERROR
        });
      }
      if (chargingStation.issuer) {
        throw new AppError({
          source: Constants.OCPI_SERVER,
          module: MODULE_NAME,
          method: 'putSessionRequest',
          errorCode: Constants.HTTP_GENERAL_ERROR,
          message: `OCPI Session is not authorized on charging station ${evse.evse_id} issued locally`,
          detailedMessages: session,
          ocpiError: Constants.OCPI_STATUS_CODE.CODE_2003_UNKNOW_LOCATION_ERROR
        });
      }

      let connectorId = 1;
      if (evse.connectors && evse.connectors.length === 1) {
        const evseConnectorId = evse.connectors[0].id;
        chargingStation.connectors.forEach((connector) => {
          if (evseConnectorId === connector.id) {
            connectorId = connector.connectorId;
          }
        });
      }

      transaction = {
        userID: user.id,
        tagID: session.auth_id,
        timestamp: session.start_datetime,
        chargeBoxID: chargingStation.id,
        timezone: Utils.getTimezone(chargingStation.coordinates),
        connectorId: connectorId,
        meterStart: 0,
        stateOfCharge: 0,
        currentStateOfCharge: 0,
        currentTotalInactivitySecs: 0,
        pricingSource: 'ocpi',
        currentInactivityStatus: InactivityStatus.INFO,
        currentConsumption: 0,
        currentConsumptionWh: 0,
        lastMeterValue: {
          value: 0,
          timestamp: session.start_datetime
        },
        signedData: '',
      } as Transaction;
    }

    if (session.kwh > 0) {
      await this.computeConsumption(tenant, transaction, session);
    }

    transaction.ocpiSession = session;
    transaction.lastUpdate = session.last_updated;
    transaction.price = session.total_cost;
    transaction.priceUnit = session.currency;
    transaction.roundedPrice = Utils.convertToFloat(session.total_cost.toFixed(2));

    transaction.lastMeterValue = {
      value: session.kwh * 1000,
      timestamp: session.last_updated
    };

    if (session.end_datetime || session.status === OCPISessionStatus.COMPLETED) {
      const stopTimestamp = session.end_datetime ? session.end_datetime : new Date();
      transaction.stop = {
        extraInactivityComputed: false,
        extraInactivitySecs: 0,
        meterStop: session.kwh * 1000,
        price: session.total_cost,
        priceUnit: session.currency,
        pricingSource: 'ocpi',
        roundedPrice: Utils.convertToFloat(session.total_cost.toFixed(2)),
        stateOfCharge: 0,
        tagID: session.auth_id,
        timestamp: stopTimestamp,
        totalConsumption: session.kwh * 1000,
        totalDurationSecs: Math.round(moment.duration(moment(stopTimestamp).diff(moment(transaction.timestamp))).asSeconds()),
        totalInactivitySecs: transaction.currentTotalInactivitySecs,
        inactivityStatus: transaction.currentInactivityStatus,
        userID: transaction.userID
      };
    }

    await TransactionStorage.saveTransaction(tenant.id, transaction);

    return OCPIUtils.success({});
  }

  /**
   * Update the Session object of id {session_id}.
   *
   * /sessions/{country_code}/{party_id}/{session_id}
   */
  private async patchSessionRequest(req: Request, res: Response, next: NextFunction, tenant: Tenant): Promise<OCPIResponse> {
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

    const transaction: Transaction = await TransactionStorage.getOCPITransaction(tenant.id, sessionId);
    if (!transaction) {
      throw new AppError({
        source: Constants.OCPI_SERVER,
        module: MODULE_NAME,
        method: 'getSessionRequest',
        errorCode: Constants.HTTP_GENERAL_ERROR,
        message: `No transaction found for ocpi session ${sessionId}`,
        ocpiError: Constants.OCPI_STATUS_CODE.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }

    let patched = false;

    const session: Partial<OCPISession> = req.body as Partial<OCPISession>;
    if (session.status) {
      transaction.ocpiSession.status = session.status;
    }
    if (session.end_datetime || session.status === OCPISessionStatus.COMPLETED) {
      if (session.end_datetime) {
        transaction.ocpiSession.end_datetime = session.end_datetime;
      }
      transaction.stop = {
        extraInactivityComputed: false,
        extraInactivitySecs: 0,
        meterStop: transaction.currentTotalConsumption,
        price: transaction.price,
        priceUnit: transaction.priceUnit,
        pricingSource: 'ocpi',
        roundedPrice: transaction.roundedPrice,
        stateOfCharge: 0,
        tagID: transaction.ocpiSession.auth_id,
        timestamp: session.end_datetime ? session.end_datetime : new Date(),
        totalConsumption: transaction.currentTotalConsumption,
        totalDurationSecs: Math.round(moment.duration(moment(transaction.stop.timestamp).diff(moment(transaction.timestamp))).asSeconds()),
        totalInactivitySecs: 0,
        userID: transaction.userID
      };
      patched = true;
    }

    if (session.kwh) {
      transaction.ocpiSession.kwh = session.kwh;
      transaction.currentTotalConsumption = session.kwh * 1000;
      transaction.lastMeterValue = {
        value: session.kwh * 1000,
        timestamp: session.last_updated ? session.last_updated : new Date()
      };
      if (transaction.stop) {
        transaction.stop.meterStop = transaction.currentTotalConsumption;
        transaction.stop.totalConsumption = transaction.currentTotalConsumption;
      }
      patched = true;
    }

    if (session.currency) {
      transaction.ocpiSession.currency = session.currency;
      transaction.priceUnit = session.currency;
      if (transaction.stop) {
        transaction.stop.priceUnit = session.currency;
      }
      patched = true;
    }

    if (session.total_cost) {
      transaction.ocpiSession.total_cost = session.total_cost;
      transaction.price = session.total_cost;
      transaction.roundedPrice = Utils.convertToFloat(session.total_cost.toFixed(2));
      if (transaction.stop) {
        transaction.stop.price = session.total_cost;
        transaction.stop.roundedPrice = Utils.convertToFloat(session.total_cost.toFixed(2));
      }
      patched = true;
    }

    if (!patched) {
      throw new AppError({
        source: Constants.OCPI_SERVER,
        module: MODULE_NAME,
        method: 'getSessionRequest',
        errorCode: Constants.HTTP_GENERAL_ERROR,
        message: 'Missing request parameters',
        detailedMessages: session,
        ocpiError: Constants.OCPI_STATUS_CODE.CODE_2002_NOT_ENOUGH_INFORMATION_ERROR
      });
    }

    await this.computeConsumption(tenant, transaction, transaction.ocpiSession);

    await TransactionStorage.saveTransaction(tenant.id, transaction);
    return OCPIUtils.success({});
  }

  private validateSession(session: OCPISession): boolean {
    if (!session.id
      || !session.start_datetime
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

  private async computeConsumption(tenant: Tenant, transaction: Transaction, session: OCPISession) {
    const consumptionWh = session.kwh * 1000 - Utils.convertToFloat(transaction.lastMeterValue.value);
    const duration = moment(session.last_updated).diff(transaction.lastMeterValue.timestamp, 'milliseconds') / 1000;
    if (consumptionWh > 0 || duration > 0) {
      const sampleMultiplier = duration > 0 ? 3600 / duration : 0;
      const currentConsumption = consumptionWh > 0 ? consumptionWh * sampleMultiplier : 0;
      const amount = session.total_cost - transaction.price;

      transaction.currentConsumption = currentConsumption;
      transaction.currentConsumptionWh = consumptionWh > 0 ? consumptionWh : 0;
      transaction.currentTotalConsumption = transaction.currentTotalConsumption + transaction.currentConsumptionWh;

      if (consumptionWh <= 0) {
        transaction.currentTotalInactivitySecs = transaction.currentTotalInactivitySecs + duration;
        transaction.currentInactivityStatus = Utils.getInactivityStatusLevel(
          transaction.chargeBox, transaction.connectorId, transaction.currentTotalInactivitySecs);
      }

      const consumption: Consumption = {
        transactionId: transaction.id,
        connectorId: transaction.connectorId,
        chargeBoxID: transaction.chargeBoxID,
        userID: transaction.userID,
        startedAt: new Date(transaction.lastMeterValue.timestamp),
        endedAt: new Date(session.last_updated),
        consumption: transaction.currentConsumptionWh,
        instantPower: Math.round(transaction.currentConsumption),
        cumulatedConsumption: transaction.currentTotalConsumption,
        totalInactivitySecs: transaction.currentTotalInactivitySecs,
        totalDurationSecs: transaction.stop ?
          moment.duration(moment(transaction.stop.timestamp).diff(moment(transaction.timestamp))).asSeconds() :
          moment.duration(moment(transaction.lastMeterValue.timestamp).diff(moment(transaction.timestamp))).asSeconds(),
        stateOfCharge: transaction.currentStateOfCharge,
        amount: amount,
        currencyCode: session.currency,
        cumulatedAmount: session.total_cost
      } as Consumption;

      await ConsumptionStorage.saveConsumption(tenant.id, consumption);
    }
  }
}

