import moment from 'moment-timezone';
import Cypher from '../../../utils/Cypher';
import Logging from '../../../utils/Logging';
import Pricing, { PricedConsumption, PricingSettings } from '../Pricing';
import SiteAreaStorage from '../../../storage/mongodb/SiteAreaStorage';
import StatefulChargingService from './StatefulChargingService';
import ChargingStation from '../../../types/ChargingStation';
import Transaction from '../../../entity/Transaction';
import OCPPUtils from '../../../server/ocpp/utils/OCPPUtils';
import {
  ChargeableItemProperty,
  ConfirmationItem,
  ReservationItem,
  Type
} from './model/ChargeableItem';
import { StartRateRequest, StopRateRequest, UpdateRateRequest } from './model/RateRequest';
import { RateResult } from './model/RateResult';

export class ConvergentChargingPricingSettings extends PricingSettings {
  readonly url: string;
  readonly user: string;
  readonly password: string;
  readonly chargeableItemName: string;

  constructor(url: string, user: string, password: string, chargeableItemName: string) {
    super();
    this.chargeableItemName = chargeableItemName;
    this.password = password;
    this.user = user;
    this.url = url;
  }
}

export default class ConvergentChargingPricing extends Pricing<ConvergentChargingPricingSettings> {
  public statefulChargingService: StatefulChargingService;

  constructor(tenantId: string, setting: ConvergentChargingPricingSettings, transaction: Transaction) {
    super(tenantId, setting, transaction);
    this.statefulChargingService = new StatefulChargingService(this.setting.url, this.setting.user, Cypher.decrypt(this.setting.password));
  }

  consumptionToChargeableItemProperties(consumptionData) {
    const timezone = this.transaction.getTimezone();
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

  computeSessionId(consumptionData) {

    const dataId = consumptionData.userID + consumptionData.chargeBoxID + consumptionData.connectorId + this.transaction.getStartDate();

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

  async startSession(consumptionData): Promise<PricedConsumption | null> {
    const siteArea = await SiteAreaStorage.getSiteArea(this.tenantId, this.transaction.getSiteAreaID());
    const sessionId = this.computeSessionId(consumptionData);
    const chargeableItemProperties = this.consumptionToChargeableItemProperties(consumptionData);
    chargeableItemProperties.push(new ChargeableItemProperty('status', Type.string, 'start'));
    const reservationItem = new ReservationItem(this.setting.chargeableItemName, chargeableItemProperties);
    const request = new StartRateRequest(reservationItem, sessionId, moment(consumptionData.startedAt).format('YYYY-MM-DDTHH:mm:ss'),
      siteArea.name, consumptionData.userID, 'cancelled', 30000, 'ALL_TRANSACTION_AND_RECURRING',
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
    await this.handleError('startSession', consumptionData, result);
    return null;

  }

  async updateSession(consumptionData): Promise<PricedConsumption | null> {
    const siteArea = await SiteAreaStorage.getSiteArea(this.tenantId, this.transaction.getSiteAreaID());
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
    await this.handleError('updateSession', consumptionData, result);
    return null;

  }

  async stopSession(consumptionData): Promise<PricedConsumption | null> {
    const siteArea = await SiteAreaStorage.getSiteArea(this.tenantId, this.transaction.getSiteAreaID());
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
    await this.handleError('stopSession', consumptionData, result);
    return null;

  }

  async handleError(action: string, consumptionData, result) {
    const chargingResult = result.data.chargingResult;
    const chargingStation: ChargingStation = await this.transaction.getChargingStation();
    Logging.logError({
      tenantID: this.tenantId,
      source: chargingStation, module: 'ConvergentCharging',
      method: 'handleError', action: action,
      message: chargingResult.message,
      detailedMessages: {
        consumptionData: consumptionData,
        chargingResult: chargingResult
      }
    });
    if (chargingResult.status === 'error') {
      if (chargingStation) {
        await OCPPUtils.requestExecuteChargingStationCommand(this.tenantId, chargingStation, 'remoteStopTransaction', {
          tagID: consumptionData.tagID,
          connectorID: consumptionData.connectorId
        });
      }
    }
  }

  /**
   *
   * @param consumptionData
   * @param notification {RateResult}
   */
  async handleAlertNotification(consumptionData, rateResult) {
    let chargingStation: ChargingStation = null;
    if (rateResult.transactionsToConfirm) {
      for (const ccTransaction of rateResult.transactionsToConfirm.ccTransactions) {
        if (ccTransaction.notifications) {
          for (const notification of ccTransaction.notifications) {
            switch (notification.code) {
              case 'CSMS_INFO':
                chargingStation = await this.transaction.getChargingStation();
                if (chargingStation) {
                  await OCPPUtils.requestExecuteChargingStationCommand(this.tenantId, chargingStation, 'setChargingProfile', {
                    chargingProfileId: 42,
                    transactionId: consumptionData.transactionId,
                    message: JSON.stringify(notification)
                  });
                }
                break;
            }
          }
        }
      }
    }
  }
}
