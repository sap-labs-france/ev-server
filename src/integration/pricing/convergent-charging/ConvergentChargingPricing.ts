import moment from 'moment-timezone';
import {
  ChargeableItemProperty,
  ConfirmationItem,
  ReservationItem,
  Type
} from './model/ChargeableItem';
import ChargingStation from '../../../types/ChargingStation';
import ChargingStationService from '../../../server/rest/service/ChargingStationService';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import Cypher from '../../../utils/Cypher';
import Logging from '../../../utils/Logging';
import OCPPUtils from '../../../server/ocpp/utils/OCPPUtils';
import Pricing, { PricedConsumption, PricingSettings } from '../Pricing';
import { StartRateRequest, StopRateRequest, UpdateRateRequest } from './model/RateRequest';
import { RateResult } from './model/RateResult';
import SiteAreaStorage from '../../../storage/mongodb/SiteAreaStorage';
import StatefulChargingService from './StatefulChargingService';
import Transaction from '../../../types/Transaction';

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

  computeSessionId(consumptionData) {

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

  async startSession(consumptionData): Promise<PricedConsumption | null> {
    const siteArea = await SiteAreaStorage.getSiteArea(this.tenantId, this.transaction.siteAreaID);
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
    await this.handleError('updateSession', consumptionData, result);
    return null;

  }

  async stopSession(consumptionData): Promise<PricedConsumption | null> {
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
    await this.handleError('stopSession', consumptionData, result);
    return null;

  }

  async handleError(action: string, consumptionData, result) {
    const chargingResult = result.data.chargingResult;
    const chargingStation: ChargingStation = await this.transaction.chargeBox;
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
                chargingStation = await ChargingStationStorage.getChargingStation(this.tenantId, this.transaction.chargeBoxID);
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
