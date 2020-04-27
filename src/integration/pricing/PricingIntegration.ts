import Consumption from '../../types/Consumption';
import { PricedConsumption } from '../../types/Pricing';
import { PricingSetting } from '../../types/Setting';
import Transaction from '../../types/Transaction';

export default abstract class PricingIntegration<T extends PricingSetting> {
  protected readonly tenantID: string;
  protected readonly setting: T;
  protected readonly transaction: Transaction;

  protected constructor(tenantID: string, setting: T, transaction: Transaction) {
    this.tenantID = tenantID;
    this.setting = setting;
    this.transaction = transaction;
  }

  protected getSettings(): T {
    return this.setting;
  }

  async abstract startSession(consumptionData: Consumption): Promise<PricedConsumption>;

  async abstract updateSession(consumptionData: Consumption): Promise<PricedConsumption>;

  async abstract stopSession(consumptionData: Consumption): Promise<PricedConsumption>;
}
