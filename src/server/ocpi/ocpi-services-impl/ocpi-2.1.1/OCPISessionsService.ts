import { OCPISession, OCPISessionStatus } from '../../../../types/ocpi/OCPISession';
import { OCPILocation } from '../../../../types/ocpi/OCPILocation';
import Transaction, { InactivityStatus } from '../../../../types/Transaction';
import TransactionStorage from '../../../../storage/mongodb/TransactionStorage';
import UserStorage from '../../../../storage/mongodb/UserStorage';
import AppError from '../../../../exception/AppError';
import Constants from '../../../../utils/Constants';
import OCPIUtils from '../../OCPIUtils';
import ChargingStationStorage from '../../../../storage/mongodb/ChargingStationStorage';
import Utils from '../../../../utils/Utils';
import moment from 'moment';
import Consumption from '../../../../types/Consumption';
import ConsumptionStorage from '../../../../storage/mongodb/ConsumptionStorage';
import HttpStatusCodes from 'http-status-codes';
import Logging from '../../../../utils/Logging';

const MODULE_NAME = 'EMSPSessionsEndpoint';

export default class OCPISessionsService {

  public static async updateSession(tenantId: string, session: OCPISession) {
    if (!OCPISessionsService.validateSession(session)) {
      throw new AppError({
        source: Constants.OCPI_SERVER,
        module: MODULE_NAME,
        method: 'updateSession',
        errorCode: HttpStatusCodes.BAD_REQUEST,
        message: 'Session object is invalid',
        detailedMessages: session,
        ocpiError: Constants.OCPI_STATUS_CODE.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }

    if (!session.total_cost) {
      session.total_cost = 0;
    }

    let transaction: Transaction = await TransactionStorage.getOCPITransaction(tenantId, session.id);
    if (!transaction) {
      const user = await UserStorage.getUser(tenantId, session.auth_id);
      if (!user) {
        throw new AppError({
          source: Constants.OCPI_SERVER,
          module: MODULE_NAME,
          method: 'updateSession',
          errorCode: Constants.HTTP_GENERAL_ERROR,
          message: `No user found for auth_id ${session.auth_id}`,
          detailedMessages: session,
          ocpiError: Constants.OCPI_STATUS_CODE.CODE_2001_INVALID_PARAMETER_ERROR
        });
      }

      const evse = session.location.evses[0];
      const chargingStationId = OCPIUtils.buildChargingStationId(session.location.id, evse.uid);
      const chargingStation = await ChargingStationStorage.getChargingStation(tenantId, chargingStationId);
      if (!chargingStation) {
        throw new AppError({
          source: Constants.OCPI_SERVER,
          module: MODULE_NAME,
          method: 'updateSession',
          errorCode: Constants.HTTP_GENERAL_ERROR,
          message: `No charging station found for evse uid ${evse.uid}`,
          detailedMessages: session,
          ocpiError: Constants.OCPI_STATUS_CODE.CODE_2003_UNKNOW_LOCATION_ERROR
        });
      }
      if (chargingStation.issuer) {
        throw new AppError({
          source: Constants.OCPI_SERVER,
          module: MODULE_NAME,
          method: 'updateSession',
          errorCode: Constants.HTTP_GENERAL_ERROR,
          message: `OCPI Session is not authorized on charging station ${evse.uid} issued locally`,
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
    } else if (moment(session.last_updated).isBefore(transaction.lastMeterValue.timestamp)) {
      Logging.logDebug({
        tenantID: tenantId,
        source: Constants.OCPI_SERVER,
        module: MODULE_NAME,
        method: 'updateSession',
        message: `Ignore session update session.last_updated < transaction.lastUpdate for transaction ${transaction.id}`,
        detailedMessages: session
      });
      return;
    }

    if (session.kwh > 0) {
      await OCPISessionsService.computeConsumption(tenantId, transaction, session);
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

    await TransactionStorage.saveTransaction(tenantId, transaction);
  }

  private static async computeConsumption(tenantId: string, transaction: Transaction, session: OCPISession) {
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

  private static validateLocation(location: OCPILocation): boolean {
    if (!location.evses || location.evses.length !== 1 || !location.evses[0].uid) {
      return false;
    }
    return true;
  }
}
