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
    let amount: number;
    let roundedAmount: number;
    if (consumptionData.consumption && typeof consumptionData.consumption === 'number') {
      amount = parseFloat((this.settings.price * (consumptionData.consumption / 1000)).toFixed(6));
      roundedAmount = parseFloat((this.settings.price * (consumptionData.consumption / 1000)).toFixed(2));
    } else {
      amount = 0;
      roundedAmount = 0;
    }
    const pricedConsumption: PricedConsumption = {
      pricingSource: 'simple',
      amount: amount,
      roundedAmount: roundedAmount,
      currencyCode: this.settings.currency,
      cumulatedAmount: 0
    };
    return pricedConsumption;
  }
}
