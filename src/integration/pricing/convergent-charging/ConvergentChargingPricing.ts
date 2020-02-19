import moment from 'moment-timezone';
import ChargingStationClientFactory from '../../../client/ocpp/ChargingStationClientFactory';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import SiteAreaStorage from '../../../storage/mongodb/SiteAreaStorage';
import ChargingStation from '../../../types/ChargingStation';
import Consumption from '../../../types/Consumption';
import { PricedConsumption } from '../../../types/Pricing';
import { ConvergentChargingPricingSetting } from '../../../types/Setting';
import Transaction from '../../../types/Transaction';
import Constants from '../../../utils/Constants';
import Cypher from '../../../utils/Cypher';
import Logging from '../../../utils/Logging';
import Pricing from '../Pricing';
import { ChargeableItemProperty, ConfirmationItem, ReservationItem, Type } from './model/ChargeableItem';
import { StartRateRequest, StopRateRequest, UpdateRateRequest } from './model/RateRequest';
import { RateResult } from './model/RateResult';
import StatefulChargingService from './StatefulChargingService';
import { RefundStatus } from '../../../types/Refund';
import { Action } from '../../../types/Authorization';

export default class ConvergentChargingPricing extends Pricing<ConvergentChargingPricingSetting> {
  public statefulChargingService: StatefulChargingService;

  constructor(tenantId: string, setting: ConvergentChargingPricingSetting, transaction: Transaction) {
    super(tenantId, setting, transaction);
    this.statefulChargingService = new StatefulChargingService(this.setting.url, this.setting.user, Cypher.decrypt(this.setting.password));
  }

  consumptionToChargeableItemProperties(consumptionData: Consumption) {
    const timezone = this.transaction.timezone;
    const startedAt = timezone ? moment.tz(consumptionData.startedAt, timezone) : moment.utc(consumptionData.startedAt).local();
    const endedAt = timezone ? moment.tz(consumptionData.endedAt, timezone) : moment.utc(consumptionData.endedAt).local();
    return [
      new ChargeableItemProperty('userID', Type.string, consumptionData.userID),
      new ChargeableItemProperty('chargeBoxID', Type.string, consumptionData.chargeBoxID),
      new ChargeableItemProperty('siteID', Type.string, consumptionData.siteID),
      new ChargeableItemProperty('siteAreaID', Type.string, consumptionData.siteAreaID),
      new ChargeableItemProperty('connectorId', Type.number, consumptionData.connectorId),
      new ChargeableItemProperty('startedAt', Type.date, startedAt.format('YYYY-MM-DDTHH:mm:ss')),
      new ChargeableItemProperty('endedAt', Type.date, endedAt.format('YYYY-MM-DDTHH:mm:ss')),
      new ChargeableItemProperty('cumulatedConsumption', Type.number, consumptionData.cumulatedConsumption),
      new ChargeableItemProperty('consumption', Type.number, consumptionData.consumption),
      new ChargeableItemProperty('stateOfCharge', Type.number, consumptionData.stateOfCharge),
    ];
  }

  computeSessionId(consumptionData: Consumption) {

    const timestamp = this.transaction.timestamp instanceof Date ? this.transaction.timestamp : new Date(this.transaction.timestamp);
    const dataId = consumptionData.userID + consumptionData.chargeBoxID + consumptionData.connectorId + timestamp.toISOString();

    let hash = 0, i, chr;
    if (dataId.length === 0) {
      return hash;
    }
    for (i = 0; i < dataId.length; i++) {
      chr = dataId.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32bit integer
    }
    return hash;
  }

  async startSession(consumptionData: Consumption): Promise<PricedConsumption | null> {
    const siteArea = await SiteAreaStorage.getSiteArea(this.tenantId, this.transaction.siteAreaID);
    const sessionId = this.computeSessionId(consumptionData);
    const chargeableItemProperties = this.consumptionToChargeableItemProperties(consumptionData);
    chargeableItemProperties.push(new ChargeableItemProperty('status', Type.string, 'start'));
    const reservationItem = new ReservationItem(this.setting.chargeableItemName, chargeableItemProperties);
    const request = new StartRateRequest(reservationItem, sessionId, moment(consumptionData.startedAt).format('YYYY-MM-DDTHH:mm:ss'),
      siteArea.name, consumptionData.userID, RefundStatus.CANCELLED, 30000, 'ALL_TRANSACTION_AND_RECURRING',
      false, 'ALL_TRANSACTION_AND_RECURRING', null);
    const result = await this.statefulChargingService.execute(request);
    if (result.data.startRateResult) {
      const rateResult = new RateResult(result.data.startRateResult);
      await this.handleAlertNotification(consumptionData, rateResult);
      return {
        amount: 0,
        cumulatedAmount: 0,
        currencyCode: rateResult.transactionsToReserve.getCurrencyCode(),
        roundedAmount: 0,
        pricingSource: 'ConvergentCharging'
      };
    }
    await this.handleError(Action.START_TRANSACTION, consumptionData, result);
    return null;

  }

  async updateSession(consumptionData: Consumption): Promise<PricedConsumption | null> {
    const siteArea = await SiteAreaStorage.getSiteArea(this.tenantId, this.transaction.siteAreaID);
    const sessionId = this.computeSessionId(consumptionData);

    const chargeableItemProperties = this.consumptionToChargeableItemProperties(consumptionData);
    chargeableItemProperties.push(new ChargeableItemProperty('status', Type.string, 'update'));
    const confirmationItem = new ConfirmationItem(this.setting.chargeableItemName, chargeableItemProperties);
    const reservationItem = new ReservationItem(this.setting.chargeableItemName, chargeableItemProperties);
    const request = new UpdateRateRequest(confirmationItem, reservationItem, sessionId, moment(consumptionData.endedAt).format('YYYY-MM-DDTHH:mm:ss'),
      siteArea.name, consumptionData.userID, 'ALL_TRANSACTION_AND_RECURRING', false, 'ALL_TRANSACTION_AND_RECURRING');

    const result = await this.statefulChargingService.execute(request);

    if (result.data.updateRateResult) {
      const rateResult = new RateResult(result.data.updateRateResult);
      await this.handleAlertNotification(consumptionData, rateResult);

      return {
        roundedAmount: rateResult.amountToConfirm,
        cumulatedAmount: rateResult.accumulatedAmount,
        currencyCode: rateResult.transactionsToConfirm.getCurrencyCode(),
        amount: rateResult.transactionsToConfirm.getTotalUnroundedAmount(),
        pricingSource: 'ConvergentCharging'
      };
    }
    await this.handleError(Action.STOP_TRANSACTION, consumptionData, result);
    return null;

  }

  async stopSession(consumptionData: Consumption): Promise<PricedConsumption | null> {
    const siteArea = await SiteAreaStorage.getSiteArea(this.tenantId, this.transaction.siteAreaID);
    const sessionId = this.computeSessionId(consumptionData);
    const chargeableItemProperties = this.consumptionToChargeableItemProperties(consumptionData);
    chargeableItemProperties.push(new ChargeableItemProperty('status', Type.string, 'stop'));

    const confirmationItem = new ConfirmationItem(this.setting.chargeableItemName, chargeableItemProperties);

    const request = new StopRateRequest(confirmationItem, sessionId, siteArea.name, consumptionData.userID, 'confirmed',
      'ALL_TRANSACTION_AND_RECURRING', false, 'ALL_TRANSACTION_AND_RECURRING');
    const result = await this.statefulChargingService.execute(request);
    if (result.data.stopRateResult) {
      const rateResult = new RateResult(result.data.stopRateResult);
      await this.handleAlertNotification(consumptionData, rateResult);
      return {
        roundedAmount: rateResult.amountToConfirm,
        cumulatedAmount: rateResult.accumulatedAmount,
        currencyCode: rateResult.transactionsToConfirm.getCurrencyCode(),
        amount: rateResult.transactionsToConfirm.getTotalUnroundedAmount(),
        pricingSource: 'ConvergentCharging'
      };
    }
    await this.handleError(Action.UPDATE_TRANSACTION, consumptionData, result);
    return null;

  }

  async handleError(action: Action, consumptionData: Consumption, result) {
    const chargingResult = result.data.chargingResult;
    const chargingStation: ChargingStation = await ChargingStationStorage.getChargingStation(this.tenantId,this.transaction.chargeBoxID);
    Logging.logError({
      tenantID: this.tenantId,
      source: chargingStation.id, module: 'ConvergentCharging',
      method: 'handleError', action: action,
      message: chargingResult.message,
      detailedMessages: {
        consumptionData: consumptionData,
        chargingResult: chargingResult
      }
    });
    if (chargingResult.status === 'error') {
      if (chargingStation) {
        // Execute OCPP Command
        const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(this.tenantId, chargingStation);
        await chargingStationClient.remoteStopTransaction({
          transactionId: this.transaction.id
        });
      }
    }
  }

  async handleAlertNotification(consumptionData: Consumption, rateResult) {
    let chargingStation: ChargingStation = null;
    if (rateResult.transactionsToConfirm) {
      for (const ccTransaction of rateResult.transactionsToConfirm.ccTransactions) {
        if (ccTransaction.notifications) {
          for (const notification of ccTransaction.notifications) {
            switch (notification.code) {
              case 'CSMS_INFO':
                chargingStation = await ChargingStationStorage.getChargingStation(this.tenantId, this.transaction.chargeBoxID);
                if (chargingStation) {
                  // TODO: To fill proper parameters
                  // // Get the client
                  // const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(this.tenantId, chargingStation);
                  // // Set Charging Profile
                  // await chargingStationClient.setChargingProfile({
                  //   csChargingProfiles: null,
                  //   connectorId: null
                  // });
                }
                break;
            }
          }
        }
      }
    }
  }
}
