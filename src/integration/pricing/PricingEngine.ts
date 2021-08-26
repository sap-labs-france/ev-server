/* eslint-disable @typescript-eslint/member-ordering */
import PricingModel, { PricingConsumptionData, PricingDefinition, PricingDimension, PricingDimensionData, PricingRestriction, ResolvedPricingModel } from '../../types/Pricing';

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
    // Of course, the date has an impact as well ... but not sure were to check for it!
    // -----------------------------------------------------------------------------------------
    // Merge the pricing definitions from the different contexts
    const pricingDefinitions: PricingDefinition[] = [];
    // pricingDefinitions.push(...await PricingEngine.getPricingDefinitions4Entity(tenant, transaction.userID));
    pricingDefinitions.push(...await PricingEngine.getPricingDefinitions4Entity(tenant, transaction.chargeBoxID.toString()));
    pricingDefinitions.push(...await PricingEngine.getPricingDefinitions4Entity(tenant, transaction.siteAreaID.toString()));
    pricingDefinitions.push(...await PricingEngine.getPricingDefinitions4Entity(tenant, transaction.siteID.toString()));
    pricingDefinitions.push(...await PricingEngine.getPricingDefinitions4Entity(tenant, transaction.companyID.toString()));
    // TODO - No pricing definition? => Throw an exception ? or create dynamically a simple one based on the simple pricing settings?
    const resolvedPricingModel: ResolvedPricingModel = {
      flatFeeAlreadyPriced: false,
      pricingDefinitions
    };
    return Promise.resolve(resolvedPricingModel);
  }

  static async getPricingDefinitions4Entity(tenant: Tenant, entityID: string): Promise<PricingDefinition[]> {
    const pricingModel: PricingModel = await PricingEngine.getPricingModel4Entity(tenant, entityID);
    return pricingModel?.pricingDefinitions || [];
  }

  static async getPricingModel4Entity(tenant: Tenant, entityID: string): Promise<PricingModel> {
    if (entityID) {
      const contextIDs = [ entityID ];
      const pricingModelResults = await PricingStorage.getPricingModels(tenant, { contextIDs }, { limit: 1, skip: 0, sort: { createdOn: -1 } });
      if (pricingModelResults.count > 0) {
        // ---------------------------------------------------------------------
        // TODO - First implementation: we simply return the latest created one
        // ---------------------------------------------------------------------
        return pricingModelResults.result[0];
      }
    }
    return null;
  }

  static checkPricingDefinitionRestrictions(pricingDefinition: PricingDefinition, consumptionData: Consumption) : PricingDefinition {
    if (pricingDefinition.restrictions) {
      if (!PricingEngine.checkRestrictionMinPower(pricingDefinition.restrictions, consumptionData)
        || !PricingEngine.checkRestrictionMaxPower(pricingDefinition.restrictions, consumptionData)
        || !PricingEngine.checkRestrictionMinDuration(pricingDefinition.restrictions, consumptionData)
        || !PricingEngine.checkRestrictionMaxDuration(pricingDefinition.restrictions, consumptionData)) {
        // -----------------------------------------------------------------------------------------
        // TODO - to be clarified - why don't we put "date validity" at the pricing model level????
        // -----------------------------------------------------------------------------------------
        // startTime?: string, // Start time of day, for example 13:30, valid from this time of the day. Must be in 24h format with leading zeros. Hour/Minute se
        // endTime?: string, // End time of day, for example 19:45, valid until this time of the day. Same syntax as start_time
        // startDate?: string, // Start date, for example: 2015-12-24, valid from this day
        // endDate?: string, // End date, for example: 2015-12-27, valid until this day (excluding this day)
        // daysOfWeek?: DayOfWeek[], // Which day(s) of the week this tariff is valid
        return null;
      }
    }
    // a definition matching the restrictions has been found
    return pricingDefinition;
  }

  static checkRestrictionMinPower(restrictions: PricingRestriction, consumptionData: Consumption): boolean {
    if (!Utils.isNullOrUndefined(restrictions.minPowerkW)) {
      if (Utils.createDecimal(consumptionData.cumulatedConsumptionWh).dividedBy(1000).lessThan(restrictions.minPowerkW)) {
        return false;
      }
    }
    return true;
  }

  static checkRestrictionMaxPower(restrictions: PricingRestriction, consumptionData: Consumption): boolean {
    if (!Utils.isNullOrUndefined(restrictions.maxPowerkW)) {
      if (Utils.createDecimal(consumptionData.cumulatedConsumptionWh).dividedBy(1000).greaterThanOrEqualTo(restrictions.maxPowerkW)) {
        return false;
      }
    }
    return true;
  }

  static checkRestrictionMinDuration(restrictions: PricingRestriction, consumptionData: Consumption): boolean {
    if (!Utils.isNullOrUndefined(restrictions.minDurationSecs)) {
      if (Utils.createDecimal(consumptionData.totalDurationSecs).lessThan(restrictions.minDurationSecs)) {
        return false;
      }
    }
    return true;
  }

  static checkRestrictionMaxDuration(restrictions: PricingRestriction, consumptionData: Consumption): boolean {
    if (!Utils.isNullOrUndefined(restrictions.maxDurationSecs)) {
      if (Utils.createDecimal(consumptionData.totalDurationSecs).greaterThanOrEqualTo(restrictions.maxDurationSecs)) {
        return false;
      }
    }
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private static priceFlatFeeConsumption(pricingDefinitions: PricingDefinition[], consumptionData: Consumption): PricingDimensionData {
    let pricingDimensionData: PricingDimensionData = null;
    const quantity = 1; // TODO - To be clarified - Flat Fee is billed once per sessions
    pricingDimensionData = PricingEngine.PriceDimensionConsumption(pricingDefinitions, 'flatFee', quantity);
    return pricingDimensionData;
  }

  private static priceEnergyConsumption(pricingDefinitions: PricingDefinition[], consumptionData: Consumption): PricingDimensionData {
    let pricingDimensionData: PricingDimensionData = null;
    const quantity = Utils.createDecimal(consumptionData?.consumptionWh).dividedBy(1000).toNumber(); // Total consumption in kW.h
    pricingDimensionData = PricingEngine.PriceDimensionConsumption(pricingDefinitions, 'energy', quantity);
    return pricingDimensionData;
  }

  private static priceParkingTimeConsumption(pricingDefinitions: PricingDefinition[], consumptionData: Consumption): PricingDimensionData {
    let pricingDimensionData: PricingDimensionData = null;
    // TODO - This is wrong - totalInactivitySecs should not be used here!
    const hours = Utils.createDecimal(consumptionData?.totalInactivitySecs || 0).toNumber();
    pricingDimensionData = PricingEngine.PriceDimensionConsumption(pricingDefinitions, 'parkingTime', hours);
    return pricingDimensionData;
  }

  private static priceChargingTimeConsumption(pricingDefinitions: PricingDefinition[], consumptionData: Consumption): PricingDimensionData {
    let pricingDimensionData: PricingDimensionData = null;
    // TODO - This is wrong - totalDurationSecs should not be used here!
    const hours = Utils.createDecimal(consumptionData?.totalDurationSecs || 0).toNumber();
    pricingDimensionData = PricingEngine.PriceDimensionConsumption(pricingDefinitions, 'chargingTime', hours);
    return pricingDimensionData;
  }

  static PriceDimensionConsumption(actualPricingDefinitions: PricingDefinition[], dimensionType: string, quantity = 0): PricingDimensionData {
    // Search for the first pricing definition matching the current dimension type
    const activePricingDefinitions = actualPricingDefinitions.filter((pricingDefinition) =>
      // We search for a pricing definition where the current dimension exists
      PricingEngine.checkPricingDimensionRestrictions(pricingDefinition, dimensionType)
    );
    // Iterate throw the list of pricing definitions where the current dimension makes sense
    let pricingDimensionData: PricingDimensionData = null;
    for (const activePricingDefinition of activePricingDefinitions) {
      const dimensionToPrice = activePricingDefinition.dimensions[dimensionType];
      if (dimensionToPrice) {
        if (dimensionType === 'parkingTime' || dimensionType === 'chargingTime') {
          pricingDimensionData = PricingEngine.priceTimeBasedDimension(dimensionToPrice, quantity);
        } else {
          pricingDimensionData = PricingEngine.priceDimension(dimensionToPrice, quantity);
        }
        if (pricingDimensionData) {
          // TODO - clarify where to show the actual tariff name
          pricingDimensionData.itemDescription = activePricingDefinition.name;
          break;
        }
      }
    }
    return pricingDimensionData;
  }

  static checkPricingDimensionRestrictions(pricingDefinition: PricingDefinition, dimensionType: string) : PricingDefinition {
    const pricingDimension: PricingDimension = pricingDefinition.dimensions[dimensionType];
    if (pricingDimension?.active) {
      return pricingDefinition;
    }
    return null;
  }

  static priceDimension(pricingDimension: PricingDimension, quantity: number): PricingDimensionData {
    const amount = Utils.createDecimal(pricingDimension.price).times(quantity).toNumber();
    // --------------------------------------------------------------------------------------------
    // TODO - take the step size into consideration
    // --------------------------------------------------------------------------------------------
    // let amount: number;
    // if (pricingDimension.stepSize) {
    //   // --------------------------------------------------------------------------------------------
    //   // Step Size - Minimum amount to be billed. This unit will be billed in this step_size blocks.
    //   // For example:
    //   //  if type is time and step_size is 300, then time will be billed in blocks of 5 minutes,
    //   //  so if 6 minutes is used, 10 minutes (2 blocks of step_size) will be billed.
    //   // --------------------------------------------------------------------------------------------
    //   const nbSteps = Utils.createDecimal(quantity).modulo(pricingDimension.stepSize).toNumber();
    //   amount = Utils.createDecimal(pricingDimension.price).times(nbSteps).toNumber();
    // } else {
    //   amount = Utils.createDecimal(pricingDimension.price).times(quantity).toNumber();
    // }
    const newData: PricingDimensionData = {
      amount,
      quantity
    };
    const previousData = pricingDimension.pricedData;
    if (previousData) {
      // Update the previous data
      previousData.amount = Utils.createDecimal(previousData.amount).plus(newData.amount).toNumber();
      previousData.quantity = Utils.createDecimal(previousData.quantity).plus(newData.quantity).toNumber();
    } else {
      // First call for this dimension
      pricingDimension.pricedData = newData;
    }
    return newData;
  }

  static priceTimeBasedDimension(pricingDimension: PricingDimension, seconds: number): PricingDimensionData {
    let amount: number;
    let hours: number;
    if (pricingDimension.stepSize) { // stepSize is in second
      // bill at least one step
      const nbSteps = Utils.createDecimal(seconds).divToInt(pricingDimension.stepSize).plus(1).toNumber();
      const nbSeconds = Utils.createDecimal(nbSteps).mul(pricingDimension.stepSize).toNumber();
      hours = Utils.createDecimal(nbSeconds).div(3600).toNumber();
      amount = Utils.createDecimal(pricingDimension.price).mul(nbSeconds).div(3600).toNumber();
    } else {
      hours = Utils.createDecimal(seconds).div(3600).toNumber();
      amount = Utils.createDecimal(pricingDimension.price).mul(seconds).div(3600).toNumber();
    }
    const previousData = pricingDimension.pricedData;
    if (previousData) {
      // The new priced data is the delta
      const newData : PricingDimensionData = {
        amount: Utils.createDecimal(amount).minus(previousData?.amount || 0).toNumber(),
        quantity: Utils.createDecimal(hours).minus(previousData?.quantity || 0).toNumber(),
      };
      // Update the previous data
      previousData.amount = amount;
      previousData.quantity = hours;
      // return the delta
      return newData;
    }
    // first call for this dimension
    pricingDimension.pricedData = {
      amount,
      quantity: seconds
    };
    return pricingDimension.pricedData;
  }

  static priceConsumption(tenant: Tenant, transaction: Transaction, consumptionData: Consumption): number {
    // Check the restrictions to find the pricing definition matching the current context
    let actualPricingDefinitions = transaction.pricingModel.pricingDefinitions.filter((pricingDefinition) =>
      PricingEngine.checkPricingDefinitionRestrictions(pricingDefinition, consumptionData)
    );
    // Having more than one pricing definition this NOT a normal situation.
    // This means that two different tariff matches the same criteria. This should not happen!
    if (actualPricingDefinitions.length > 1) {
      // TODO - to be clarified! - Shall we mix several pricing definition for a single transaction?
      actualPricingDefinitions = [ actualPricingDefinitions?.[0] ];
    }
    // ----------------------------------------------------------------------------------------------
    // TODO - POC - to be clarified - temporary solution
    // - we shouldn't update the transaction object directly from this layer
    // ----------------------------------------------------------------------------------------------
    let flatFee: PricingDimensionData = null;
    if (!transaction.pricingModel.flatFeeAlreadyPriced) {
      // Flat fee must not be priced only once
      flatFee = PricingEngine.priceFlatFeeConsumption(actualPricingDefinitions, consumptionData);
      transaction.pricingModel.flatFeeAlreadyPriced = !!flatFee;
    }
    // Build the consumption data for each dimension
    const energy: PricingDimensionData = PricingEngine.priceEnergyConsumption(actualPricingDefinitions, consumptionData);
    const chargingTime: PricingDimensionData = PricingEngine.priceChargingTimeConsumption(actualPricingDefinitions, consumptionData);
    const parkingTime: PricingDimensionData = PricingEngine.priceParkingTimeConsumption(actualPricingDefinitions, consumptionData);
    // Sum all dimensions
    const amount = Utils.createDecimal(flatFee?.amount || 0).plus(energy?.amount || 0).plus(chargingTime?.amount || 0).plus(parkingTime?.amount || 0).toNumber();
    return amount;
  }

  static extractFinalPricingData(pricingModel: ResolvedPricingModel): PricingConsumptionData[] {
    // Iterate throw the list of pricing definitions
    const pricedData: PricingConsumptionData[] = pricingModel.pricingDefinitions.map((pricingDefinition) =>
      PricingEngine.extractFinalPricedConsumptionData(pricingDefinition)
    );
    // Remove null/undefined entries (if any)
    return pricedData.filter((pricingConsumptionData) => !!pricingConsumptionData);
  }

  static extractFinalPricedConsumptionData(pricingDefinition: PricingDefinition): PricingConsumptionData {
    const flatFee = pricingDefinition.dimensions.flatFee?.pricedData;
    const energy = pricingDefinition.dimensions.energy?.pricedData;
    const chargingTime = pricingDefinition.dimensions.chargingTime?.pricedData;
    const parkingTime = pricingDefinition.dimensions.parkingTime?.pricedData;
    if (flatFee || energy || chargingTime || parkingTime) {
      return {
        flatFee,
        energy,
        chargingTime,
        parkingTime
      };
    }
    // Nothing to bill for the current pricing definition
    return null;
  }

  static extractPricedDataFromDimension(pricedData: PricingDimensionData[], pricingDefinition: PricingDefinition, dimensionType: string): void {
    const pricingDimensionData = pricingDefinition.dimensions[dimensionType]?.pricedData;
    if (pricingDimensionData) {
      pricedData.push(pricingDimensionData);
    }
  }

}

