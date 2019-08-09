import Transaction from '../../types/Transaction';
import User from '../../types/User';

export abstract class PricingSettings {}

export class ConvergentChargingPricingSettings {
  constructor(readonly url: string, readonly chargeableItemName: string, readonly user: User, readonly password: string) {
  }
}

export class PricedConsumption {
  constructor(
    readonly amount: number,
    readonly cumulatedAmount: number,
    readonly roundedAmount: number,
    readonly currencyCode: string,
    readonly pricingSource: string) {}

}

export default abstract class Pricing<T extends PricingSettings> {

  // Protected because only used in subclasses at the moment
  protected readonly tenantId: string; // Assuming GUID or other string format ID
  protected readonly setting: T;
  protected readonly transaction: Transaction;

  protected constructor(tenantId: string, setting: T, transaction: Transaction) {
    this.tenantId = tenantId;
    this.setting = setting;
    this.transaction = transaction;
  }

  // eslint-disable-next-line no-unused-vars
  async abstract startSession(consumptionData: {consumption: any}): Promise<PricedConsumption>;

  // eslint-disable-next-line no-unused-vars
  async abstract updateSession(consumptionData: {consumption: any}): Promise<PricedConsumption>;

  // eslint-disable-next-line no-unused-vars
  async abstract stopSession(consumptionData: {consumption: any}): Promise<PricedConsumption>;

  protected getSettings(): T {
    return this.setting;
  }
}
