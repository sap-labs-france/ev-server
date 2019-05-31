import Transaction from '../../entity/Transaction';
import Consumption from '../../entity/Consumption';

export abstract class PricingSettings {};

export class SimplePricingSettings {
  constructor(readonly price: number, readonly currency: string){
  }
};

export class ConvergentChargingPricingSettings {
  constructor(readonly url: string, readonly chargeableItemName: string, readonly user: string, readonly password: string){
  }
};

export class PricedConsumption {
  constructor(
    readonly amount: number,
    readonly cumulatedAmount: number,
    readonly roundedAmount: number,
    readonly currencyCode: string,
    readonly pricingSource: string){}

};

export abstract class Pricing {

  //Protected because only used in subclasses at the moment
  protected readonly tenantId: string; //Assuming GUID or other string format ID
  protected readonly setting: PricingSettings;
  protected readonly transaction: Transaction;

  constructor(tenantId: string, setting: PricingSettings, transaction: Transaction) {
    this.tenantId = tenantId;
    this.setting = setting;
    this.transaction = transaction;
  }

  // eslint-disable-next-line no-unused-vars
  async abstract startSession(consumptionData: Consumption): Promise<PricedConsumption>;

  // eslint-disable-next-line no-unused-vars
  async abstract updateSession(consumptionData: Consumption): Promise<PricedConsumption>;

  // eslint-disable-next-line no-unused-vars
  async abstract stopSession(consumptionData: Consumption): Promise<PricedConsumption>;
}
