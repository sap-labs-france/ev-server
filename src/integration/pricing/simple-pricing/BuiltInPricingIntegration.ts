/* eslint-disable max-len */
import FeatureToggles, { Feature } from '../../../utils/FeatureToggles';
import { PricedConsumption, PricingDimensions, PricingSource, ResolvedPricingDefinition, ResolvedPricingModel } from '../../../types/Pricing';

import ChargingStation from '../../../types/ChargingStation';
import Consumption from '../../../types/Consumption';
import Logging from '../../../utils/Logging';
import LoggingHelper from '../../../utils/LoggingHelper';
import PricingEngine from '../PricingEngine';
import PricingHelper from '../PricingHelper';
import PricingIntegration from '../PricingIntegration';
import { ServerAction } from '../../../types/Server';
import { SimplePricingSetting } from '../../../types/Setting';
import Tenant from '../../../types/Tenant';
import Transaction from '../../../types/Transaction';
import Utils from '../../../utils/Utils';

const MODULE_NAME = 'BuiltInPricingIntegration';

export default class BuiltInPricingIntegration extends PricingIntegration<SimplePricingSetting> {
  constructor(tenant: Tenant, readonly settings: SimplePricingSetting) {
    super(tenant, settings);
  }

  public async startSession(transaction: Transaction, consumptionData: Consumption, chargingStation: ChargingStation): Promise<PricedConsumption> {
    const pricedConsumption = await this.computePrice(transaction, consumptionData, chargingStation);
    await Logging.logInfo({
      tenantID: this.tenant.id,
      module: MODULE_NAME,
      action: ServerAction.PRICING,
      method: 'startSession',
      message: `Session START - Transaction: ${transaction.id} - Accumulated amount: ${pricedConsumption.cumulatedRoundedAmount} ${pricedConsumption.currencyCode}`,
      ...LoggingHelper.getTransactionProperties(transaction)
    });
    return pricedConsumption;
  }

  public async updateSession(transaction: Transaction, consumptionData: Consumption, chargingStation: ChargingStation): Promise<PricedConsumption> {
    const pricedConsumption = await this.computePrice(transaction, consumptionData, chargingStation);
    return pricedConsumption;
  }

  public async stopSession(transaction: Transaction, consumptionData: Consumption, chargingStation: ChargingStation): Promise<PricedConsumption> {
    const pricedConsumption = await this.computePrice(transaction, consumptionData, chargingStation);
    await Logging.logInfo({
      tenantID: this.tenant.id,
      module: MODULE_NAME,
      action: ServerAction.PRICING,
      method: 'stopSession',
      message: `Session STOP - Transaction: ${transaction.id} - Accumulated amount: ${pricedConsumption.cumulatedRoundedAmount} ${pricedConsumption.currencyCode}`,
      detailedMessages: { pricedConsumption },
      ...LoggingHelper.getTransactionProperties(transaction)
    });
    return pricedConsumption;
  }

  private async computePrice(transaction: Transaction, consumptionData: Consumption, chargingStation: ChargingStation): Promise<PricedConsumption> {
    let pricingModel = transaction.pricingModel;
    if (!pricingModel) {
      // This should happen only on the first call (i.e.: on a start transaction)
      pricingModel = await this.resolvePricingContext(this.tenant, transaction, chargingStation);
    }
    const pricingConsumptionData = PricingEngine.priceConsumption(this.tenant, pricingModel, consumptionData);
    const { flatFee, energy, chargingTime, parkingTime } = pricingConsumptionData;
    const currencyCode = this.settings.currency;
    const amount = Utils.createDecimal(flatFee?.amount || 0).plus(energy?.amount || 0).plus(chargingTime?.amount || 0).plus(parkingTime?.amount || 0).toNumber();
    const roundedAmount = Utils.createDecimal(flatFee?.roundedAmount || 0).plus(energy?.roundedAmount || 0).plus(chargingTime?.roundedAmount || 0).plus(parkingTime?.roundedAmount || 0).toNumber();
    // Sum all dimensions
    const pricedConsumption: PricedConsumption = {
      pricingSource: PricingSource.SIMPLE,
      pricingModel,
      amount,
      roundedAmount,
      currencyCode,
      cumulatedAmount: 0,
      cumulatedRoundedAmount: 0,
    };
    // Get the amount from the priced data to avoid rounding issues
    const { cumulatedAmount, cumulatedRoundedAmount } = this.computeCumulatedAmount(pricingModel);
    pricedConsumption.cumulatedAmount = cumulatedAmount;
    pricedConsumption.cumulatedRoundedAmount = cumulatedRoundedAmount;
    return Promise.resolve(pricedConsumption);
  }

  private computeCumulatedAmount(pricingModel: ResolvedPricingModel): { cumulatedAmount: number, cumulatedRoundedAmount: number } {
    const allDimensions: PricingDimensions[] = [];
    pricingModel.pricingDefinitions.forEach((pricingDefinition) => {
      if (pricingDefinition.dimensions) {
        allDimensions.push(pricingDefinition.dimensions);
      }
    });
    return PricingHelper.accumulatePricingDimensions(allDimensions);
  }

  private async resolvePricingContext(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation): Promise<ResolvedPricingModel> {
    const resolvedPricingModel: ResolvedPricingModel = await PricingEngine.resolvePricingContext(tenant, transaction, chargingStation);
    if (!resolvedPricingModel.pricingDefinitions?.length) {
      resolvedPricingModel.pricingDefinitions = [ this.getDefaultPricingDefinition() ];
      await Logging.logWarning({
        tenantID: this.tenant.id,
        module: MODULE_NAME,
        action: ServerAction.PRICING,
        method: 'resolvePricingContext',
        message: 'No pricing definition found - Simple Pricing logic will be used as a fallback',
        detailedMessages: { resolvedPricingModel },
        ...LoggingHelper.getTransactionProperties(transaction)
      });
    }
    return resolvedPricingModel;
  }

  private getDefaultPricingDefinition(): ResolvedPricingDefinition {
    // Defaults to the simple pricing settings
    const simplePricingDefinition: ResolvedPricingDefinition = {
      // TODO - translate default tariff name
      name: 'Default Tariff',
      description: 'Tariff based on simple pricing settings',
      dimensions: {
        energy: {
          active: true,
          price: this.setting.price,
        }
      }
    };
    return simplePricingDefinition;
  }

}
