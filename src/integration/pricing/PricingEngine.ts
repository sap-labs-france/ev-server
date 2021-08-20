/* eslint-disable @typescript-eslint/member-ordering */
import { PricingConsumptionData, PricingDefinition, PricingDimension, PricingDimensionData, ResolvedPricingModel } from '../../types/Pricing';

import Consumption from '../../types/Consumption';
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

  static async priceFinalConsumption(tenant: Tenant, transaction: Transaction, consumptionData: Consumption): Promise<PricingConsumptionData> {
    // Build the consumption data for each dimension
    const flatFee: PricingDimensionData = PricingEngine.priceFlatFeeConsumption(tenant, transaction, consumptionData);
    const energy: PricingDimensionData = PricingEngine.priceEnergyConsumption(tenant, transaction, consumptionData);
    const chargingTime: PricingDimensionData = PricingEngine.priceChargingTimeConsumption(tenant, transaction, consumptionData);
    const parkingTime: PricingDimensionData = PricingEngine.priceParkingTimeConsumption(tenant, transaction, consumptionData);
    // For now we can have up to 4 dimensions
    const pricingConsumptionData: PricingConsumptionData = {
      flatFee,
      energy,
      chargingTime,
      parkingTime,
    };

    if (!pricingConsumptionData.flatFee) {
      delete pricingConsumptionData.flatFee;
    }
    if (!pricingConsumptionData.energy) {
      delete pricingConsumptionData.energy;
    }
    if (!pricingConsumptionData.chargingTime) {
      delete pricingConsumptionData.chargingTime;
    }
    if (!pricingConsumptionData.parkingTime) {
      delete pricingConsumptionData.parkingTime;
    }
    return Promise.resolve(pricingConsumptionData);
  }

  private static priceFlatFeeConsumption(tenant: Tenant, transaction: Transaction, consumptionData: Consumption): PricingDimensionData {
    let pricingDimensionData: PricingDimensionData = null;
    const quantity = 1;
    pricingDimensionData = PricingEngine.PriceDimensionConsumption(transaction.pricingModel, 'flatFee', quantity);
    return pricingDimensionData;
  }

  private static priceEnergyConsumption(tenant: Tenant, transaction: Transaction, consumptionData: Consumption): PricingDimensionData {
    let pricingDimensionData: PricingDimensionData = null;
    const totalConsumptionWh = transaction.currentTotalConsumptionWh;
    if (transaction.pricingModel) {
      // Apply the new Pricing Engine
      const quantity = Utils.createDecimal(consumptionData.cumulatedConsumptionWh).dividedBy(1000).toNumber(); // Total consumption in kW.h
      pricingDimensionData = PricingEngine.PriceDimensionConsumption(transaction.pricingModel, 'energy', quantity);
    } else {
      // -------------------------------------------------------------------------------
      // Let's do it the old way - using the Simple Pricing logic
      // -------------------------------------------------------------------------------
      const quantity = Utils.createDecimal(totalConsumptionWh).dividedBy(1000).toNumber(); // Total consumption in kW.h
      const roundedPrice = Utils.truncTo(transaction.currentCumulatedPrice, 2);
      const amount = roundedPrice; // Total amount for the line item
      // TODO - POC - take the pricingModel into consideration
      // Build the consumption data for each dimension
      pricingDimensionData = {
        amount,
        quantity
      };
    }
    return pricingDimensionData;
  }

  private static priceParkingTimeConsumption(tenant: Tenant, transaction: Transaction, consumptionData: Consumption): PricingDimensionData {
    let pricingDimensionData: PricingDimensionData = null;
    pricingDimensionData = PricingEngine.PriceDimensionConsumption(transaction.pricingModel, 'parkingTime', consumptionData.totalDurationSecs);
    return pricingDimensionData;
  }

  private static priceChargingTimeConsumption(tenant: Tenant, transaction: Transaction, consumptionData: Consumption): PricingDimensionData {
    let pricingDimensionData: PricingDimensionData = null;
    pricingDimensionData = PricingEngine.PriceDimensionConsumption(transaction.pricingModel, 'chargingTime', consumptionData.totalInactivitySecs);
    return pricingDimensionData;
  }

  static PriceDimensionConsumption(pricingModel: ResolvedPricingModel, dimensionType: string, quantity = 0): PricingDimensionData {
    // Search for the first pricing definition matching the current dimension type and the pricing restrictions if any!
    const activePricingDefinitions = pricingModel.pricingDefinitions.filter((pricingDefinition) =>
      // We search for a pricing definition where the current dimension exists
      PricingEngine.checkPricingRestrictions(pricingDefinition, dimensionType)
    );
    // Iterate throw the list of pricing definitions where the current dimension makes sense
    let pricingDimensionData: PricingDimensionData = null;
    for (const activePricingDefinition of activePricingDefinitions) {
      const dimensionToPrice = activePricingDefinition.dimensions[dimensionType];
      if (dimensionToPrice) {
        pricingDimensionData = PricingEngine.applyPricingDefinition(dimensionToPrice, quantity);
        if (pricingDimensionData) {
          break;
        }
      }
    }
    return pricingDimensionData;
  }

  static checkPricingRestrictions(pricingDefinition: PricingDefinition, dimensionType: string) : PricingDefinition {
    const pricingDimension: PricingDimension = pricingDefinition.dimensions[dimensionType];
    if (pricingDimension?.active) {
      return pricingDefinition;
    }
    return null;
  }

  static applyPricingDefinition(pricingDimension: PricingDimension, quantity: number): PricingDimensionData {

    let amount: number;
    if (pricingDimension.stepSize) {
      // --------------------------------------------------------------------------------------------
      // Step Size - Minimum amount to be billed. This unit will be billed in this step_size blocks.
      // For example:
      //  if type is time and step_size is 300, then time will be billed in blocks of 5 minutes,
      //  so if 6 minutes is used, 10 minutes (2 blocks of step_size) will be billed.
      // --------------------------------------------------------------------------------------------
      const nbSteps = Utils.createDecimal(quantity).modulo(pricingDimension.stepSize).toNumber();
      amount = Utils.createDecimal(pricingDimension.price).times(nbSteps).toNumber();
    } else {
      amount = Utils.createDecimal(pricingDimension.price).times(quantity).toNumber();
    }
    const pricingDimensionData: PricingDimensionData = {
      amount,
      quantity
    };
    return pricingDimensionData;
  }

}

