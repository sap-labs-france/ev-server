import { ChargeableItemProperty, ConfirmationItem, ReservationItem, Type } from './model/ChargeableItem';
import { ChargingProfilePurposeType, Profile } from '../../../types/ChargingProfile';
import { PricedConsumption, PricingContext, PricingSource, ResolvedPricingModel } from '../../../types/Pricing';
import { StartRateRequest, StopRateRequest, UpdateRateRequest } from './model/RateRequest';

import BackendError from '../../../exception/BackendError';
import ChargingStation from '../../../types/ChargingStation';
import ChargingStationClientFactory from '../../../client/ocpp/ChargingStationClientFactory';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import Consumption from '../../../types/Consumption';
import { ConvergentChargingPricingSetting } from '../../../types/Setting';
import Cypher from '../../../utils/Cypher';
import Logging from '../../../utils/Logging';
import LoggingHelper from '../../../utils/LoggingHelper';
import PricingIntegration from '../PricingIntegration';
import { RateResult } from './model/RateResult';
import { RefundStatus } from '../../../types/Refund';
import { ServerAction } from '../../../types/Server';
import SiteAreaStorage from '../../../storage/mongodb/SiteAreaStorage';
import StatefulChargingService from './StatefulChargingService';
import Tenant from '../../../types/Tenant';
import Transaction from '../../../types/Transaction';
import Utils from '../../../utils/Utils';
import moment from 'moment-timezone';

const MODULE_NAME = 'ConvergentChargingPricingIntegration';

export default class SapConvergentChargingPricingIntegration extends PricingIntegration<ConvergentChargingPricingSetting> {
  public statefulChargingService: StatefulChargingService;

  public constructor(tenant: Tenant, setting: ConvergentChargingPricingSetting) {
    super(tenant, setting);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async resolvePricingContext(pricingContext: PricingContext): Promise<ResolvedPricingModel> {
    return Promise.resolve(null);
  }

  public consumptionToChargeableItemProperties(transaction: Transaction, consumptionData: Consumption): any {
    const timezone = transaction.timezone;
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
      new ChargeableItemProperty('cumulatedConsumptionWh', Type.number, consumptionData.cumulatedConsumptionWh),
      new ChargeableItemProperty('consumptionWh', Type.number, consumptionData.consumptionWh),
      new ChargeableItemProperty('stateOfCharge', Type.number, consumptionData.stateOfCharge),
    ];
  }

  public computeSessionId(transaction: Transaction, consumptionData: Consumption): number {
    const timestamp = transaction.timestamp instanceof Date ? transaction.timestamp : new Date(transaction.timestamp);
    const dataId = consumptionData.userID + consumptionData.chargeBoxID + consumptionData.connectorId.toString() + timestamp.toISOString();
    if (dataId.length === 0) {
      return 0;
    }
    return this.hashCode(dataId);
  }

  public async startSession(transaction: Transaction, consumptionData: Consumption): Promise<PricedConsumption | null> {
    await this.initConnection();
    const siteArea = await SiteAreaStorage.getSiteArea(this.tenant, transaction.siteAreaID);
    const sessionId = this.computeSessionId(transaction, consumptionData);
    const chargeableItemProperties = this.consumptionToChargeableItemProperties(transaction, consumptionData);
    chargeableItemProperties.push(new ChargeableItemProperty('status', Type.string, 'start'));
    const reservationItem = new ReservationItem(this.setting.chargeableItemName, chargeableItemProperties);
    const request = new StartRateRequest(reservationItem, sessionId, moment(consumptionData.startedAt).format('YYYY-MM-DDTHH:mm:ss'),
      siteArea.name, consumptionData.userID, RefundStatus.CANCELLED, 30000, 'ALL_TRANSACTION_AND_RECURRING',
      false, 'ALL_TRANSACTION_AND_RECURRING', null);
    const result = await this.statefulChargingService.execute(request);
    if (result.data.startRateResult) {
      const rateResult = new RateResult(result.data.startRateResult);
      await this.handleAlertNotification(transaction, consumptionData, rateResult);
      return {
        amount: 0,
        cumulatedAmount: 0,
        currencyCode: rateResult.transactionsToReserve.getCurrencyCode(),
        roundedAmount: 0,
        cumulatedRoundedAmount: 0,
        pricingSource: PricingSource.CONVERGENT_CHARGING
      };
    }
    await this.handleError(transaction, ServerAction.OCPP_START_TRANSACTION, consumptionData, result);
  }

  public async updateSession(transaction: Transaction, consumptionData: Consumption): Promise<PricedConsumption | null> {
    await this.initConnection();
    const siteArea = await SiteAreaStorage.getSiteArea(this.tenant, transaction.siteAreaID);
    const sessionId = this.computeSessionId(transaction, consumptionData);
    const chargeableItemProperties = this.consumptionToChargeableItemProperties(transaction, consumptionData);
    chargeableItemProperties.push(new ChargeableItemProperty('status', Type.string, 'update'));
    const confirmationItem = new ConfirmationItem(this.setting.chargeableItemName, chargeableItemProperties);
    const reservationItem = new ReservationItem(this.setting.chargeableItemName, chargeableItemProperties);
    const request = new UpdateRateRequest(confirmationItem, reservationItem, sessionId, moment(consumptionData.endedAt).format('YYYY-MM-DDTHH:mm:ss'),
      siteArea.name, consumptionData.userID, 'ALL_TRANSACTION_AND_RECURRING', false, 'ALL_TRANSACTION_AND_RECURRING');
    const result = await this.statefulChargingService.execute(request);
    if (result.data.updateRateResult) {
      const rateResult = new RateResult(result.data.updateRateResult);
      await this.handleAlertNotification(transaction, consumptionData, rateResult);
      return {
        roundedAmount: rateResult.amountToConfirm,
        cumulatedAmount: rateResult.accumulatedAmount,
        cumulatedRoundedAmount: Utils.truncTo(rateResult.accumulatedAmount,2),
        currencyCode: rateResult.transactionsToConfirm.getCurrencyCode(),
        amount: rateResult.transactionsToConfirm.getTotalUnroundedAmount(),
        pricingSource: PricingSource.CONVERGENT_CHARGING
      };
    }
    await this.handleError(transaction, ServerAction.OCPP_STOP_TRANSACTION, consumptionData, result);
  }

  public async stopSession(transaction: Transaction, consumptionData: Consumption): Promise<PricedConsumption> {
    await this.initConnection();
    const siteArea = await SiteAreaStorage.getSiteArea(this.tenant, transaction.siteAreaID);
    const sessionId = this.computeSessionId(transaction, consumptionData);
    const chargeableItemProperties = this.consumptionToChargeableItemProperties(transaction, consumptionData);
    chargeableItemProperties.push(new ChargeableItemProperty('status', Type.string, 'end'));
    const confirmationItem = new ConfirmationItem(this.setting.chargeableItemName, chargeableItemProperties);
    const request = new StopRateRequest(confirmationItem, sessionId, siteArea.name, consumptionData.userID, 'confirmed',
      'ALL_TRANSACTION_AND_RECURRING', false, 'ALL_TRANSACTION_AND_RECURRING');
    const result = await this.statefulChargingService.execute(request);
    if (result.data.stopRateResult) {
      const rateResult = new RateResult(result.data.stopRateResult);
      await this.handleAlertNotification(transaction, consumptionData, rateResult);
      return {
        roundedAmount: rateResult.amountToConfirm,
        cumulatedAmount: rateResult.accumulatedAmount,
        cumulatedRoundedAmount: Utils.truncTo(rateResult.accumulatedAmount, 2),
        currencyCode: rateResult.transactionsToConfirm.getCurrencyCode(),
        amount: rateResult.transactionsToConfirm.getTotalUnroundedAmount(),
        pricingSource: PricingSource.CONVERGENT_CHARGING
      };
    }
    await this.handleError(transaction, ServerAction.UPDATE_TRANSACTION, consumptionData, result);
    return null;
  }

  public async endSession(transaction: Transaction, consumptionData: Consumption): Promise<PricedConsumption> {
    await this.initConnection();
    const siteArea = await SiteAreaStorage.getSiteArea(this.tenant, transaction.siteAreaID);
    const sessionId = this.computeSessionId(transaction, consumptionData);
    const chargeableItemProperties = this.consumptionToChargeableItemProperties(transaction, consumptionData);
    chargeableItemProperties.push(new ChargeableItemProperty('status', Type.string, 'stop'));
    const confirmationItem = new ConfirmationItem(this.setting.chargeableItemName, chargeableItemProperties);
    const request = new StopRateRequest(confirmationItem, sessionId, siteArea.name, consumptionData.userID, 'confirmed',
      'ALL_TRANSACTION_AND_RECURRING', false, 'ALL_TRANSACTION_AND_RECURRING');
    const result = await this.statefulChargingService.execute(request);
    if (result.data.stopRateResult) {
      const rateResult = new RateResult(result.data.stopRateResult);
      await this.handleAlertNotification(transaction, consumptionData, rateResult);
      return {
        roundedAmount: rateResult.amountToConfirm,
        cumulatedAmount: rateResult.accumulatedAmount,
        cumulatedRoundedAmount: Utils.truncTo(rateResult.accumulatedAmount, 2),
        currencyCode: rateResult.transactionsToConfirm.getCurrencyCode(),
        amount: rateResult.transactionsToConfirm.getTotalUnroundedAmount(),
        pricingSource: PricingSource.CONVERGENT_CHARGING
      };
    }
    await this.handleError(transaction, ServerAction.UPDATE_TRANSACTION, consumptionData, result);
    return null;
  }

  public async handleError(transaction: Transaction, action: ServerAction, consumptionData: Consumption, result): Promise<void> {
    const chargingResult = result.data.chargingResult;
    const chargingStation: ChargingStation = await ChargingStationStorage.getChargingStation(this.tenant, transaction.chargeBoxID);
    await Logging.logError({
      ...LoggingHelper.getChargingStationProperties(chargingStation),
      tenantID: this.tenant.id,
      module: MODULE_NAME, method: 'handleError',
      action: action,
      message: chargingResult.message,
      detailedMessages: {
        consumptionData: consumptionData,
        chargingResult: chargingResult
      }
    });
    if (chargingResult.status === 'error') {
      if (chargingStation) {
        // Execute OCPP Command
        const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(this.tenant, chargingStation);
        if (!chargingStationClient) {
          throw new BackendError({
            ...LoggingHelper.getChargingStationProperties(chargingStation),
            action: action,
            module: MODULE_NAME, method: 'handleError',
            message: 'Charging Station is not connected to the backend',
          });
        }
        await chargingStationClient.remoteStopTransaction({
          transactionId: transaction.id
        });
      }
    }
  }

  public async handleAlertNotification(transaction: Transaction, consumptionData: Consumption, rateResult): Promise<void> {
    let chargingStation: ChargingStation = null;
    if (rateResult.transactionsToConfirm) {
      for (const ccTransaction of rateResult.transactionsToConfirm.ccTransactions) {
        if (ccTransaction.notifications) {
          for (const notification of ccTransaction.notifications) {
            switch (notification.code) {
              case 'CSMS_INFO':
                if (notification.properties && notification.properties['computed.message']) {
                  chargingStation = await ChargingStationStorage.getChargingStation(this.tenant, transaction.chargeBoxID);
                  if (chargingStation) {
                    const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(this.tenant, chargingStation);
                    if (!chargingStationClient) {
                      throw new BackendError({
                        ...LoggingHelper.getChargingStationProperties(chargingStation),
                        module: MODULE_NAME, method: 'handleError',
                        message: 'Charging Station is not connected to the backend',
                      });
                    }
                    const profile = {
                      chargingProfileId: this.hashCode(notification.properties['computed.message']),
                      chargingProfilePurpose: ChargingProfilePurposeType.TX_PROFILE,
                    } as Profile;
                    await chargingStationClient.setChargingProfile({
                      csChargingProfiles: profile,
                      connectorId: transaction.connectorId,
                    });
                  }
                }
                break;
            }
          }
        }
      }
    }
  }

  public hashCode(data: string): number {
    let hash = 0, i: number, chr: number;
    for (i = 0; i < data.length; i++) {
      chr = data.charCodeAt(i);
      hash = hash * 31 + chr;
      hash |= 0;
    }
    return hash;
  }

  private async initConnection() {
    if (!this.statefulChargingService) {
      this.statefulChargingService = new StatefulChargingService(this.setting.url, this.setting.user,
        await Cypher.decrypt(this.tenant, this.setting.password));
    }
  }
}
