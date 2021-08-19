import { BuiltInPricedConsumption, PricedConsumption, PricingSource, ResolvedPricingModel } from '../../../types/Pricing';

import Consumption from '../../../types/Consumption';
import PricingIntegration from '../PricingIntegration';
import PricingStorage from '../../../storage/mongodb/PricingStorage';
import { SimplePricingSetting } from '../../../types/Setting';
import Tenant from '../../../types/Tenant';
import Transaction from '../../../types/Transaction';
import Utils from '../../../utils/Utils';

export default class BuiltInPricingIntegration extends PricingIntegration<SimplePricingSetting> {
  constructor(tenant: Tenant, readonly settings: SimplePricingSetting) {
    super(tenant, settings);
  }

  public async startSession(transaction: Transaction, consumptionData: Consumption): Promise<PricedConsumption> {
    const pricedConsumption = await this.computePrice(transaction, consumptionData);
    const pricingModel = await this.resolvePricingContext(transaction);
    const builtInPricedConsumption: BuiltInPricedConsumption = {
      ...pricedConsumption,
      pricingModel
    };
    return Promise.resolve(builtInPricedConsumption);
  }

  public async updateSession(transaction: Transaction, consumptionData: Consumption): Promise<PricedConsumption> {
    return this.computePrice(transaction, consumptionData);
  }

  public async stopSession(transaction: Transaction, consumptionData: Consumption): Promise<PricedConsumption> {
    return this.computePrice(transaction, consumptionData);
  }

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
    const pricedConsumption: PricedConsumption = {
      pricingSource: PricingSource.SIMPLE,
      amount: amount,
      roundedAmount: roundedAmount,
      currencyCode: this.settings.currency,
      cumulatedAmount: transaction.currentCumulatedPrice ? Utils.createDecimal(transaction.currentCumulatedPrice).plus(amount).toNumber() : amount
    };
    return Promise.resolve(pricedConsumption);
  }

  private async resolvePricingContext(transaction: Transaction): Promise<ResolvedPricingModel> {
    // -----------------------------------------------------------------------------------------
    // TODO - We need to find the pricing model to apply by resolving the hierarchy of contexts
    // that may override (or extend) the pricing definitions.
    // Forseen hierarchy is:
    // - Tenant/Organization
    // - Company
    // - Site
    // - Site Area
    // - Charging Station
    // - User Group
    // - User
    // Of course, the date has an impact as well
    // -----------------------------------------------------------------------------------------
    // First implementation:
    // - we only have a single pricing model which is defined for the tenant
    // - we simply get the latest created one
    // -----------------------------------------------------------------------------------------
    let pricingModel: ResolvedPricingModel = null;
    const pricingModelResults = await PricingStorage.getPricingModels(this.tenant, {}, { limit: 1, skip: 0, sort: { createdOn: -1 } });
    if (pricingModelResults.count > 0) {
      const { pricingDefinitions } = pricingModelResults.result[0];
      pricingModel = {
        pricingDefinitions
      };
    }
    // TODO - No pricing definition? => Throw an exception ?
    return Promise.resolve(pricingModel);
  }
}
