import { PricedConsumption, PricingSource } from '../../../types/Pricing';

import Consumption from '../../../types/Consumption';
import PricingEngine from '../PricingEngine';
import PricingIntegration from '../PricingIntegration';
import { SimplePricingSetting } from '../../../types/Setting';
import Tenant from '../../../types/Tenant';
import Transaction from '../../../types/Transaction';
import Utils from '../../../utils/Utils';

// --------------------------------------------------------------------------------------------------
// TODO - POC - BuiltInPricingIntegration is hidden behind a feature toggle
// This concrete implementation of the PricingIntegration still relies on the SimplePricingSettings
// --------------------------------------------------------------------------------------------------
export default class BuiltInPricingIntegration extends PricingIntegration<SimplePricingSetting> {
  constructor(tenant: Tenant, readonly settings: SimplePricingSetting) {
    super(tenant, settings);
  }

  public async startSession(transaction: Transaction, consumptionData: Consumption): Promise<PricedConsumption> {
    const pricedConsumption = await this.computePrice(transaction, consumptionData);
    pricedConsumption.pricingModel = await PricingEngine.resolvePricingContext(this.tenant, transaction);
    return Promise.resolve(pricedConsumption);
  }

  public async updateSession(transaction: Transaction, consumptionData: Consumption): Promise<PricedConsumption> {
    return this.computePrice(transaction, consumptionData);
  }

  public async stopSession(transaction: Transaction, consumptionData: Consumption): Promise<PricedConsumption> {
    const pricedConsumption = await this.computePrice(transaction, consumptionData);
    if (transaction.pricingModel) {
      pricedConsumption.pricingConsumptionData = await PricingEngine.priceFinalConsumption(this.tenant, transaction, consumptionData);
    }
    return Promise.resolve(pricedConsumption);
  }

  private async computePrice(transaction: Transaction, consumptionData: Consumption): Promise<PricedConsumption> {
    let amount: number;
    let roundedAmount: number;
    if (consumptionData.consumptionWh && typeof consumptionData.consumptionWh === 'number') {
      amount = Utils.computeSimplePrice(this.settings.price, consumptionData.consumptionWh);
      roundedAmount = Utils.truncTo(amount, 2);
    } else {
      amount = 0;
      roundedAmount = 0;
    }
    const pricedConsumption: PricedConsumption = {
      pricingSource: PricingSource.SIMPLE,
      amount: amount,
      roundedAmount: roundedAmount,
      currencyCode: this.settings.currency,
      cumulatedAmount: transaction.currentCumulatedPrice ? Utils.createDecimal(transaction.currentCumulatedPrice).plus(amount).toNumber() : amount
    };
    return Promise.resolve(pricedConsumption);
  }
}
