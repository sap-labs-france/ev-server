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

  // eslint-disable-next-line @typescript-eslint/require-await
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
      pricingSource: PricingSettingsType.SIMPLE,
      amount: amount,
      roundedAmount: roundedAmount,
      currencyCode: this.settings.currency,
      cumulatedAmount: transaction.currentCumulatedPrice ? Utils.createDecimal(transaction.currentCumulatedPrice).plus(amount).toNumber() : amount
    };
    return pricedConsumption;
  }
}
