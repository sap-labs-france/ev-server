import Transaction from '../../entity/Transaction';
// pragma import Consumption from '../../entity/Consumption';

export abstract class PricingSettings {}

export class ConvergentChargingPricingSettings {
  constructor(readonly url: string, readonly chargeableItemName: string, readonly user: string, readonly password: string) {
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

export default abstract class Pricing {

  // Protected because only used in subclasses at the moment
  protected readonly tenantId: string; // Assuming GUID or other string format ID

  // pragma protected readonly setting: PricingSettings;
  protected readonly transaction: Transaction;

  constructor(tenantId: string, setting: PricingSettings, transaction: Transaction) {
    this.tenantId = tenantId;
    // pragma this.setting = setting;
    this.transaction = transaction;
  }

  // eslint-disable-next-line no-unused-vars
  async abstract startSession(consumptionData: {consumption: any}): Promise<PricedConsumption>;

  // eslint-disable-next-line no-unused-vars
  async abstract updateSession(consumptionData: {consumption: any}): Promise<PricedConsumption>;

  // eslint-disable-next-line no-unused-vars
  async abstract stopSession(consumptionData: {consumption: any}): Promise<PricedConsumption>;

  protected abstract getSettings(): PricingSettings;
}
