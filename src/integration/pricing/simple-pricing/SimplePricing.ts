import { Pricing, PricingSettings, PricedConsumption } from '../Pricing';
import Consumption from '../../../entity/Consumption';
import Transaction from '../../../entity/Transaction';

export class SimplePricingSettings extends PricingSettings {
  constructor(readonly price: number, readonly currency: string){
    super();
  }
};

export class SimplePricing extends Pricing {

  constructor(tenantId: string, readonly _settings: SimplePricingSettings, transaction: Transaction) {
    super(tenantId, transaction);
  }

  protected getSettings(): SimplePricingSettings {
    return this._settings;
  }

  async startSession(consumptionData: Consumption): Promise<PricedConsumption> {
    return this.computePrice(consumptionData);
  }

  async updateSession(consumptionData: Consumption): Promise<PricedConsumption> {
    return this.computePrice(consumptionData);
  }

  async stopSession(consumptionData: Consumption): Promise<PricedConsumption> {
    return this.computePrice(consumptionData);
  }

  async computePrice(consumptionData: Consumption): Promise<PricedConsumption> {
    //Shorthand
    const s = this.getSettings();

    return {
      pricingSource: 'simple',
      amount: parseFloat((s.price * (consumptionData.consumption / 1000)).toFixed(6)),
      roundedAmount: parseFloat((s.price * (consumptionData.consumption / 1000)).toFixed(2)),
      currencyCode: s.currency,
      cumulatedAmount: -1 //TODO: handle this using NULLs instead?
    };
  }
}
