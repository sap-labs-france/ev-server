import ChargingStation from '../../types/ChargingStation';
import Consumption from '../../types/Consumption';
import { PricedConsumption } from '../../types/Pricing';
import PricingFactory from './PricingFactory';
import Tenant from '../../types/Tenant';
import Transaction from '../../types/Transaction';
import User from '../../types/User';

const MODULE_NAME = 'PricingFacade';

export default class PricingFacade {

  public static async processStartTransaction(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation, consumption: Consumption, user: User): Promise<void> {
    if (!user?.issuer) {
      return;
    }
    const pricingImpl = await PricingFactory.getPricingImpl(tenant);
    if (pricingImpl) {
      const pricedConsumption = await pricingImpl.startSession(transaction, consumption, chargingStation);
      if (pricedConsumption) {
        PricingFacade.updateCumulatedAmounts(transaction, consumption, pricedConsumption);
        // Set the initial pricing
        transaction.price = pricedConsumption.amount;
        transaction.roundedPrice = pricedConsumption.roundedAmount;
        transaction.priceUnit = pricedConsumption.currencyCode;
        transaction.pricingSource = pricedConsumption.pricingSource;
        // Set the actual pricing model after the resolution of the context
        transaction.pricingModel = pricedConsumption.pricingModel;
      }
    }
  }

  public static async processUpdateTransaction(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation, consumption: Consumption, user: User): Promise<void> {
    if (!user?.issuer) {
      return;
    }
    const pricingImpl = await PricingFactory.getPricingImpl(tenant);
    if (pricingImpl) {
      const pricedConsumption = await pricingImpl.updateSession(transaction, consumption, chargingStation);
      PricingFacade.updateCumulatedAmounts(transaction, consumption, pricedConsumption);
    }
  }

  public static async processStopTransaction(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation, consumption: Consumption, user: User): Promise<void> {
    if (!user?.issuer) {
      return;
    }
    const pricingImpl = await PricingFactory.getPricingImpl(tenant);
    if (pricingImpl) {
      const pricedConsumption = await pricingImpl.stopSession(transaction, consumption, chargingStation);
      PricingFacade.updateCumulatedAmounts(transaction, consumption, pricedConsumption);
    }
  }

  public static async processEndTransaction(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation, consumption: Consumption, user: User): Promise<void> {
    if (!user?.issuer) {
      return;
    }
    const pricingImpl = await PricingFactory.getPricingImpl(tenant);
    if (pricingImpl) {
      const pricedConsumption = await pricingImpl.endSession(transaction, consumption, chargingStation);
      PricingFacade.updateCumulatedAmounts(transaction, consumption, pricedConsumption);
    }
  }

  private static updateCumulatedAmounts(transaction: Transaction, consumption: Consumption, pricedConsumption: PricedConsumption): void {
    if (pricedConsumption) {
      // Update consumption
      consumption.amount = pricedConsumption.amount;
      consumption.roundedAmount = pricedConsumption.roundedAmount;
      consumption.currencyCode = pricedConsumption.currencyCode;
      consumption.pricingSource = pricedConsumption.pricingSource;
      consumption.cumulatedAmount = pricedConsumption.cumulatedAmount;
      // Update transaction
      transaction.currentCumulatedPrice = consumption.cumulatedAmount;
      transaction.currentCumulatedRoundedPrice = pricedConsumption.cumulatedRoundedAmount;
    }
  }
}
