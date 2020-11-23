import { OCPISession, OCPISessionStatus } from '../../../../types/ocpi/OCPISession';
import Transaction, { InactivityStatus } from '../../../../types/Transaction';

import AppError from '../../../../exception/AppError';
import { ChargePointStatus } from '../../../../types/ocpp/OCPPServer';
import ChargingStationStorage from '../../../../storage/mongodb/ChargingStationStorage';
import Constants from '../../../../utils/Constants';
import Consumption from '../../../../types/Consumption';
import ConsumptionStorage from '../../../../storage/mongodb/ConsumptionStorage';
import { HTTPError } from '../../../../types/HTTPError';
import Logging from '../../../../utils/Logging';
import { OCPICdr } from '../../../../types/ocpi/OCPICdr';
import { OCPILocation } from '../../../../types/ocpi/OCPILocation';
import { OCPIStatusCode } from '../../../../types/ocpi/OCPIStatusCode';
import OCPIUtils from '../../OCPIUtils';
import { ServerAction } from '../../../../types/Server';
import { StatusCodes } from 'http-status-codes';
import TransactionStorage from '../../../../storage/mongodb/TransactionStorage';
import UserStorage from '../../../../storage/mongodb/UserStorage';
import Utils from '../../../../utils/Utils';
import moment from 'moment';

const MODULE_NAME = 'EMSPSessionsEndpoint';

export default class OCPISessionsService {

  public static async updateTransaction(tenantId: string, session: OCPISession): Promise<void> {
    if (!OCPISessionsService.validateSession(session)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'updateTransaction',
        errorCode: StatusCodes.BAD_REQUEST,
        message: 'Session object is invalid',
        detailedMessages: { session },
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    if (!session.total_cost) {
      session.total_cost = 0;
    }
    if (!session.kwh) {
      session.kwh = 0;
    }
    let transaction: Transaction = await TransactionStorage.getOCPITransaction(tenantId, session.id);
    if (!transaction) {
      const user = await UserStorage.getUser(tenantId, session.auth_id);
      if (!user) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'updateTransaction',
          errorCode: HTTPError.GENERAL_ERROR,
          message: `No User found for auth_id ${session.auth_id}`,
          detailedMessages: { session },
          ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
        });
      }
      const evse = session.location.evses[0];
      const chargingStationId = OCPIUtils.buildChargingStationId(session.location.id, evse.uid);
      const chargingStation = await ChargingStationStorage.getChargingStation(tenantId, chargingStationId);
      if (!chargingStation) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'updateTransaction',
          errorCode: HTTPError.GENERAL_ERROR,
          message: `No Charging Station found for ID '${evse.uid}'`,
          detailedMessages: { session },
          ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR
        });
      }
      if (chargingStation.issuer) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'updateTransaction',
          errorCode: HTTPError.GENERAL_ERROR,
          message: `OCPI Transaction is not authorized on charging station ${evse.uid} issued locally`,
          detailedMessages: { session },
          ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR
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
        issuer: false,
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
        currentInstantWatts: 0,
        currentConsumptionWh: 0,
        lastConsumption: {
          value: 0,
          timestamp: session.start_datetime
        },
        signedData: '',
      } as Transaction;
    }
    if (!transaction.lastConsumption) {
      transaction.lastConsumption = {
        value: transaction.meterStart,
        timestamp: transaction.timestamp
      };
    }
    if (moment(session.last_updated).isBefore(transaction.lastConsumption.timestamp)) {
      Logging.logDebug({
        tenantID: tenantId,
        action: ServerAction.OCPI_PUSH_SESSION,
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'updateTransaction',
        message: `Ignore session update session.last_updated < transaction.currentTimestamp for transaction ${transaction.id}`,
        detailedMessages: { session }
      });
      return;
    }
    if (session.kwh > 0) {
      await OCPISessionsService.computeConsumption(tenantId, transaction, session);
    }
    if (!transaction.ocpiData) {
      transaction.ocpiData = {};
    }
    transaction.ocpiData.session = session;
    transaction.currentTimestamp = session.last_updated;
    transaction.price = session.total_cost;
    transaction.priceUnit = session.currency;
    transaction.roundedPrice = Utils.convertToFloat(session.total_cost.toFixed(2));
    transaction.lastConsumption = {
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
        totalConsumptionWh: session.kwh * 1000,
        totalDurationSecs: Math.round(moment.duration(moment(stopTimestamp).diff(moment(transaction.timestamp))).asSeconds()),
        totalInactivitySecs: transaction.currentTotalInactivitySecs,
        inactivityStatus: transaction.currentInactivityStatus,
        userID: transaction.userID
      };
    }
    await TransactionStorage.saveTransaction(tenantId, transaction);
    await this.updateConnector(tenantId, transaction);
  }

  public static async processCdr(tenantId: string, cdr: OCPICdr): Promise<void> {
    if (!OCPISessionsService.validateCdr(cdr)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'processCdr',
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Cdr object is invalid',
        detailedMessages: { cdr },
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    const transaction: Transaction = await TransactionStorage.getOCPITransaction(tenantId, cdr.id);
    if (!transaction) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'processCdr',
        errorCode: HTTPError.GENERAL_ERROR,
        message: `No Transaction found for OCPI CDR ID '${cdr.id}'`,
        detailedMessages: { cdr },
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    if (!cdr.total_cost) {
      cdr.total_cost = 0;
    }
    if (!cdr.total_energy) {
      cdr.total_energy = 0;
    }
    if (!cdr.total_time) {
      cdr.total_time = 0;
    }
    if (!cdr.total_parking_time) {
      cdr.total_parking_time = 0;
    }
    transaction.priceUnit = cdr.currency;
    transaction.price = cdr.total_cost;
    transaction.roundedPrice = Utils.convertToFloat(cdr.total_cost.toFixed(2));
    transaction.currentTimestamp = cdr.last_updated;
    transaction.stop = {
      extraInactivityComputed: false,
      extraInactivitySecs: 0,
      meterStop: cdr.total_energy * 1000,
      price: cdr.total_cost,
      priceUnit: cdr.currency,
      pricingSource: 'ocpi',
      roundedPrice: Utils.convertToFloat(cdr.total_cost.toFixed(2)),
      stateOfCharge: 0,
      tagID: cdr.auth_id,
      timestamp: cdr.stop_date_time,
      totalConsumptionWh: cdr.total_energy * 1000,
      totalDurationSecs: cdr.total_time * 3600,
      totalInactivitySecs: cdr.total_parking_time * 3600,
      inactivityStatus: transaction.currentInactivityStatus,
      userID: transaction.userID
    };
    if (!transaction.ocpiData) {
      transaction.ocpiData = {};
    }
    transaction.ocpiData.cdr = cdr;
    await TransactionStorage.saveTransaction(tenantId, transaction);
    await this.updateConnector(tenantId, transaction);
  }

  public static async updateConnector(tenantId: string, transaction: Transaction): Promise<void> {
    const chargingStation = await ChargingStationStorage.getChargingStation(tenantId, transaction.chargeBoxID);
    if (chargingStation && chargingStation.connectors) {
      for (const connector of chargingStation.connectors) {
        if (connector.connectorId === transaction.connectorId && connector.currentTransactionID === 0 || connector.currentTransactionID === transaction.id) {
          if (!transaction.stop) {
            connector.status = transaction.status;
            connector.currentTransactionID = transaction.id;
            connector.currentInactivityStatus = transaction.currentInactivityStatus;
            connector.currentTagID = transaction.tagID;
            connector.currentStateOfCharge = transaction.currentStateOfCharge;
            connector.currentInstantWatts = transaction.currentInstantWatts;
            connector.currentTotalConsumptionWh = transaction.currentTotalConsumptionWh;
            connector.currentTransactionDate = transaction.currentTimestamp;
            connector.currentTotalInactivitySecs = transaction.currentTotalInactivitySecs;
          } else {
            connector.status = ChargePointStatus.AVAILABLE;
            connector.currentTransactionID = 0;
            connector.currentTransactionDate = null;
            connector.currentTagID = null;
            connector.currentTotalConsumptionWh = 0;
            connector.currentStateOfCharge = 0;
            connector.currentTotalInactivitySecs = 0;
            connector.currentInstantWatts = 0;
            connector.currentInactivityStatus = null;
          }
          await ChargingStationStorage.saveChargingStation(tenantId, chargingStation);
        }
      }
    }
  }

  private static async computeConsumption(tenantId: string, transaction: Transaction, session: OCPISession): Promise<void> {
    const consumptionWh = session.kwh * 1000 - Utils.convertToFloat(transaction.lastConsumption.value);
    const duration = moment(session.last_updated).diff(transaction.lastConsumption.timestamp, 'milliseconds') / 1000;
    if (consumptionWh > 0 || duration > 0) {
      const sampleMultiplier = duration > 0 ? 3600 / duration : 0;
      const currentInstantWatts = consumptionWh > 0 ? consumptionWh * sampleMultiplier : 0;
      const amount = session.total_cost - transaction.price;
      transaction.currentInstantWatts = currentInstantWatts;
      transaction.currentConsumptionWh = consumptionWh > 0 ? consumptionWh : 0;
      transaction.currentTotalConsumptionWh = transaction.currentTotalConsumptionWh + transaction.currentConsumptionWh;
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
        startedAt: new Date(transaction.lastConsumption.timestamp),
        endedAt: new Date(session.last_updated),
        consumptionWh: transaction.currentConsumptionWh,
        instantWatts: Math.floor(transaction.currentInstantWatts),
        instantAmps: Math.floor(transaction.currentInstantWatts / 230),
        cumulatedConsumptionWh: transaction.currentTotalConsumptionWh,
        cumulatedConsumptionAmps: Math.floor(transaction.currentTotalConsumptionWh / 230),
        totalInactivitySecs: transaction.currentTotalInactivitySecs,
        totalDurationSecs: transaction.stop ?
          moment.duration(moment(transaction.stop.timestamp).diff(moment(transaction.timestamp))).asSeconds() :
          moment.duration(moment(transaction.lastConsumption.timestamp).diff(moment(transaction.timestamp))).asSeconds(),
        stateOfCharge: transaction.currentStateOfCharge,
        amount: amount,
        currencyCode: session.currency,
        cumulatedAmount: session.total_cost
      } as Consumption;
      await ConsumptionStorage.saveConsumption(tenantId, consumption);
    }
  }

  private static validateSession(session: OCPISession): boolean {
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
    return OCPISessionsService.validateLocation(session.location);
  }

  private static validateCdr(cdr: OCPICdr): boolean {
    if (!cdr.id
      || !cdr.start_date_time
      || !cdr.stop_date_time
      || !cdr.auth_id
      || !cdr.auth_method
      || !cdr.location
      || !cdr.currency
      || !cdr.charging_periods
      || !cdr.last_updated
    ) {
      return false;
    }
    return OCPISessionsService.validateLocation(cdr.location);
  }

  private static validateLocation(location: OCPILocation): boolean {
    if (!location.evses || location.evses.length !== 1 || !location.evses[0].uid) {
      return false;
    }
    return true;
  }
}
