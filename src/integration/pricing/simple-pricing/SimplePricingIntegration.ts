/* eslint-disable max-len */
import { PricedConsumption, PricingSource } from '../../../types/Pricing';

import Consumption from '../../../types/Consumption';
import PricingIntegration from '../PricingIntegration';
import { SimplePricingSetting } from '../../../types/Setting';
import Tenant from '../../../types/Tenant';
import Transaction from '../../../types/Transaction';
import Utils from '../../../utils/Utils';

export default class SimplePricingIntegration extends PricingIntegration<SimplePricingSetting> {
  constructor(tenant: Tenant, readonly settings: SimplePricingSetting) {
    super(tenant, settings);
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
    const cumulatedAmount = Utils.createDecimal(transaction.currentCumulatedPrice).plus(amount).toNumber();
    const cumulatedRoundedAmount = Utils.truncTo(cumulatedAmount, 2);
    const pricedConsumption: PricedConsumption = {
      pricingSource: PricingSource.SIMPLE,
      currencyCode: this.settings.currency,
      amount,
      roundedAmount,
      cumulatedAmount,
      cumulatedRoundedAmount
    };
    return pricedConsumption;
  }
}
