import Pricing, { PricedConsumption, PricingSettings } from '../Pricing';
import Transaction from '../../../types/Transaction';

export class SimplePricingSettings extends PricingSettings {
  constructor(readonly price: number, readonly currency: string) {
    super();
  }
}

export default class SimplePricing extends Pricing<SimplePricingSettings> {

  constructor(tenantId: string, readonly settings: SimplePricingSettings, transaction: Transaction) {
    super(tenantId, settings, transaction);
  }

  async startSession(consumptionData: {consumption: any}): Promise<PricedConsumption> {
    return this.computePrice(consumptionData);
  }

  async updateSession(consumptionData: {consumption: any}): Promise<PricedConsumption> {
    return this.computePrice(consumptionData);
  }

  async stopSession(consumptionData: {consumption: any}): Promise<PricedConsumption> {
    return this.computePrice(consumptionData);
  }

  async computePrice(consumptionData: {consumption: any}): Promise<PricedConsumption> {
    return {
      pricingSource: 'simple',
      amount: parseFloat((this.settings.price * (consumptionData.consumption / 1000)).toFixed(6)),
      roundedAmount: parseFloat((this.settings.price * (consumptionData.consumption / 1000)).toFixed(2)),
      currencyCode: this.settings.currency,
      cumulatedAmount: 0 // TODO: handle this using NULLs instead?
    };
  }
}
