/* eslint-disable @typescript-eslint/no-unused-vars */
import Consumption from '../../../types/Consumption';
import { PricedConsumption } from '../../../types/Pricing';
import PricingIntegration from '../PricingIntegration';
import { PricingSetting } from '../../../types/Setting';
import Tenant from '../../../types/Tenant';
import Transaction from '../../../types/Transaction';

export default class DummyPricingIntegration extends PricingIntegration<PricingSetting> {
  constructor(tenant: Tenant, readonly settings: PricingSetting) {
    super(tenant, settings);
  }

  public async startSession(transaction: Transaction, consumptionData: Consumption): Promise<PricedConsumption> {
    return null;
  }

  public async updateSession(transaction: Transaction, consumptionData: Consumption): Promise<PricedConsumption> {
    return null;
  }

  public async stopSession(transaction: Transaction, consumptionData: Consumption): Promise<PricedConsumption> {
    return null;
  }
}
