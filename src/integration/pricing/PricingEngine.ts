import { PricingConsumptionData, PricingDimensionData, ResolvedPricingModel } from '../../types/Pricing';

import PricingStorage from '../../storage/mongodb/PricingStorage';
import Tenant from '../../types/Tenant';
import Transaction from '../../types/Transaction';
import Utils from '../../utils/Utils';

// --------------------------------------------------------------------------------------------------
// TODO - POC - PricingEngine is hidden behind a feature toggle
// --------------------------------------------------------------------------------------------------
export default class PricingEngine {

  static async resolvePricingContext(tenant: Tenant, transaction: Transaction): Promise<ResolvedPricingModel> {

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
    const pricingModelResults = await PricingStorage.getPricingModels(tenant, {}, { limit: 1, skip: 0, sort: { createdOn: -1 } });
    if (pricingModelResults.count > 0) {
      const { pricingDefinitions } = pricingModelResults.result[0];
      pricingModel = {
        pricingDefinitions
      };
    }
    // TODO - No pricing definition? => Throw an exception ?
    return Promise.resolve(pricingModel);
  }

  static async priceFinalConsumption(tenant: Tenant, transaction: Transaction): Promise<PricingConsumptionData> {
    // -------------------------------------------------------------------------------
    // TODO - POC  - We cannot get data from transaction.stop - it is not yet set!
    // const { roundedPrice, totalConsumptionWh } = transaction.stop;
    // -------------------------------------------------------------------------------
    const roundedPrice = Utils.truncTo(transaction.currentCumulatedPrice, 2);
    const totalConsumptionWh = transaction.currentTotalConsumptionWh;
    const quantity = Utils.createDecimal(totalConsumptionWh).dividedBy(1000).toNumber(); // Total consumption in kW.h
    const amount = roundedPrice; // Total amount for the line item
    // TODO - POC - take the pricingModel into consideration
    // Build the consumption data for each dimension
    const energy: PricingDimensionData = {
      amount,
      quantity
    };
    // const parkingTime: PricingDimensionData = {
    //   itemDescription,
    //   amount,
    //   quantity
    // };
    // For now we can have up to 4 dimensions
    const pricingConsumptionData: PricingConsumptionData = {
      // flatFee,
      energy,
      // chargingTime,
      // parkingTime,
    };
    return Promise.resolve(pricingConsumptionData);
  }
}

