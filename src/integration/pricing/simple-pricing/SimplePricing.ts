import Pricing, { PricedConsumption, PricingSettings } from '../Pricing';
import Consumption from '../../../entity/Consumption';
import Transaction from '../../../entity/Transaction';

export class SimplePricingSettings extends PricingSettings {
  constructor(readonly price: number, readonly currency: string) {
    super();
  }
}

export default class SimplePricing extends Pricing {

  constructor(tenantId: string, readonly settings: SimplePricingSettings, transaction: Transaction) {
    super(tenantId, settings, transaction);
  }

  protected getSettings(): SimplePricingSettings {
    return this.settings;
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
    // Shorthand
    const s = this.getSettings();

    return {
      pricingSource: 'simple',
      amount: parseFloat((s.price * (consumptionData.consumption / 1000)).toFixed(6)),
      roundedAmount: parseFloat((s.price * (consumptionData.consumption / 1000)).toFixed(2)),
      currencyCode: s.currency,
      cumulatedAmount: 0 // TODO: handle this using NULLs instead?
    };
  }
}
