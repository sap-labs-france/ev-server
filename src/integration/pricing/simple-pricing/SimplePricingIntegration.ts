import { PricingSettingsType, SimplePricingSetting } from '../../../types/Setting';

import Consumption from '../../../types/Consumption';
import { PricedConsumption } from '../../../types/Pricing';
import PricingIntegration from '../PricingIntegration';
import Transaction from '../../../types/Transaction';
import Utils from '../../../utils/Utils';

export default class SimplePricingIntegration extends PricingIntegration<SimplePricingSetting> {
  constructor(tenantID: string, readonly settings: SimplePricingSetting) {
    super(tenantID, settings);
  }

  public async startSession(transaction: Transaction, consumptionData: Consumption): Promise<PricedConsumption> {
    return this.computePrice(transaction, consumptionData);
  }

  public async updateSession(transaction: Transaction, consumptionData: Consumption): Promise<PricedConsumption> {
    return this.computePrice(transaction, consumptionData);
  }

  public async stopSession(transaction: Transaction, consumptionData: Consumption): Promise<PricedConsumption> {
    return this.computePrice(transaction, consumptionData);
  }

  private async computePrice(transaction: Transaction, consumptionData: Consumption): Promise<PricedConsumption> {
    let amount: number;
    let roundedAmount: number;
    if (consumptionData.consumptionWh && typeof consumptionData.consumptionWh === 'number') {
      amount = Utils.computeSimplePrice(this.settings.price, consumptionData.consumptionWh);
      roundedAmount = Utils.computeSimpleRoundedPrice(this.settings.price, consumptionData.consumptionWh);
    } else {
      amount = 0;
      roundedAmount = 0;
    }
    const pricedConsumption: PricedConsumption = {
      pricingSource: PricingSettingsType.SIMPLE,
      amount: amount,
      roundedAmount: roundedAmount,
      currencyCode: this.settings.currency,
      cumulatedAmount: 0
    };
    return pricedConsumption;
  }
}
