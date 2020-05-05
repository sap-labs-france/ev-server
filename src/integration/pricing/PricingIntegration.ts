import Consumption from '../../types/Consumption';
import { PricedConsumption } from '../../types/Pricing';
import { PricingSetting } from '../../types/Setting';
import Transaction from '../../types/Transaction';

export default abstract class PricingIntegration<T extends PricingSetting> {
  protected readonly tenantID: string;
  protected readonly setting: T;

  protected constructor(tenantID: string, setting: T) {
    this.tenantID = tenantID;
    this.setting = setting;
  }

  protected getSettings(): T {
    return this.setting;
  }

  async abstract startSession(transaction: Transaction, consumptionData: Consumption): Promise<PricedConsumption>;

  async abstract updateSession(transaction: Transaction, consumptionData: Consumption): Promise<PricedConsumption>;

  async abstract stopSession(transaction: Transaction, consumptionData: Consumption): Promise<PricedConsumption>;
}
