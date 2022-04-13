import { PricedConsumption, PricingContext, ResolvedPricingModel } from '../../types/Pricing';

import ChargingStation from '../../types/ChargingStation';
import Consumption from '../../types/Consumption';
import { PricingSetting } from '../../types/Setting';
import Tenant from '../../types/Tenant';
import Transaction from '../../types/Transaction';

export default abstract class PricingIntegration<T extends PricingSetting> {
  protected readonly tenant: Tenant;
  protected readonly setting: T;

  protected constructor(tenant: Tenant, setting: T) {
    this.tenant = tenant;
    this.setting = setting;
  }

  protected getSettings(): T {
    return this.setting;
  }

  public abstract startSession(transaction: Transaction, consumptionData: Consumption, chargingStation?: ChargingStation): Promise<PricedConsumption>;

  public abstract updateSession(transaction: Transaction, consumptionData: Consumption, chargingStation?: ChargingStation): Promise<PricedConsumption>;

  public abstract stopSession(transaction: Transaction, consumptionData: Consumption, chargingStation?: ChargingStation): Promise<PricedConsumption>;

  public abstract endSession(transaction: Transaction, consumptionData: Consumption, chargingStation?: ChargingStation): Promise<PricedConsumption>;

  public abstract resolvePricingContext(pricingContext: PricingContext): Promise<ResolvedPricingModel>;
}

