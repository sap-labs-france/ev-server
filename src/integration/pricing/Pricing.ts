import Transaction from '../../types/Transaction';
import Consumption from '../../types/Consumption';
import { PricedConsumption } from '../../types/Pricing';
import { PricingSetting } from '../../types/Setting';

export default abstract class Pricing<T extends PricingSetting> {
  protected readonly tenantId: string;
  protected readonly setting: T;
  protected readonly transaction: Transaction;

  protected constructor(tenantId: string, setting: T, transaction: Transaction) {
    this.tenantId = tenantId;
    this.setting = setting;
    this.transaction = transaction;
  }

  async abstract startSession(consumptionData: Consumption): Promise<PricedConsumption>;

  async abstract updateSession(consumptionData: Consumption): Promise<PricedConsumption>;

  async abstract stopSession(consumptionData: Consumption): Promise<PricedConsumption>;

  protected getSettings(): T {
    return this.setting;
  }
}
