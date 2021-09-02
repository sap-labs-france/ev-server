/* eslint-disable @typescript-eslint/member-ordering */
import PricingModel, { DimensionType, PricedConsumptionData, PricedDimensionData, PricingDefinition, PricingDimension, PricingRestriction, PricingStaticRestriction, ResolvedPricingModel } from '../../types/Pricing';

import ChargingStation from '../../types/ChargingStation';
import Consumption from '../../types/Consumption';
import PricingStorage from '../../storage/mongodb/PricingStorage';
import Tenant from '../../types/Tenant';
import Transaction from '../../types/Transaction';
import Utils from '../../utils/Utils';

// --------------------------------------------------------------------------------------------------
// TODO - POC - PricingEngine is hidden behind a feature toggle
// --------------------------------------------------------------------------------------------------
export default class PricingEngine {

  static async resolvePricingContext(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation): Promise<ResolvedPricingModel> {
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
    pricingDefinitions.push(...await PricingEngine.getPricingDefinitions4Entity(tenant, transaction, chargingStation, transaction.chargeBoxID.toString()));
    pricingDefinitions.push(...await PricingEngine.getPricingDefinitions4Entity(tenant, transaction, chargingStation, transaction.siteAreaID.toString()));
    pricingDefinitions.push(...await PricingEngine.getPricingDefinitions4Entity(tenant, transaction, chargingStation, transaction.siteID.toString()));
    pricingDefinitions.push(...await PricingEngine.getPricingDefinitions4Entity(tenant, transaction, chargingStation, transaction.companyID.toString()));
    // TODO - No pricing definition? => Throw an exception ? or create dynamically a simple one based on the simple pricing settings?
    const resolvedPricingModel: ResolvedPricingModel = {
      flatFeeAlreadyPriced: false,
      pricingDefinitions
    };
    return Promise.resolve(resolvedPricingModel);
  }

  static async getPricingDefinitions4Entity(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation, entityID: string): Promise<PricingDefinition[]> {
    const pricingModel: PricingModel = await PricingEngine.getPricingModel4Entity(tenant, entityID);
    const pricingDefinitions = pricingModel?.pricingDefinitions || [];
    const actualPricingDefinitions = pricingDefinitions.filter((pricingDefinition) =>
      PricingEngine.checkStaticRestrictions(pricingDefinition, transaction, chargingStation)
    );
    return actualPricingDefinitions || [];
  }

  static async getPricingModel4Entity(tenant: Tenant, entityID: string): Promise<PricingModel> {
    if (entityID) {
      const entityIDs = [ entityID ];
      const pricingModelResults = await PricingStorage.getPricingModels(tenant, { entityIDs }, { limit: 1, skip: 0, sort: { createdOn: -1 } });
      if (pricingModelResults.count > 0) {
        // ---------------------------------------------------------------------
        // TODO - First implementation: we simply return the latest created one
        // ---------------------------------------------------------------------
        return pricingModelResults.result[0];
      }
    }
    return null;
  }

  static checkStaticRestrictions(pricingDefinition: PricingDefinition, transaction: Transaction, chargingStation: ChargingStation) : PricingDefinition {
    // -----------------------------------------------------------------------
    // TODO - check here the static restrictions
    // i.e.: - restrictions that are not depending on the actual consumption
    // e.g.: - validity dates, minPowerkW/maxPowerkW
    // -----------------------------------------------------------------------
    if (pricingDefinition.staticRestrictions) {
      if (!PricingEngine.checkConnectorType(pricingDefinition.staticRestrictions, transaction, chargingStation)
        || !PricingEngine.checkMinPower(pricingDefinition.staticRestrictions, transaction, chargingStation)
        || !PricingEngine.checkMaxPower(pricingDefinition.staticRestrictions, transaction, chargingStation)
      ) {
        return null;
      }
    }
    // a definition matching the restrictions has been found
    return pricingDefinition;
  }

  static checkPricingDefinitionRestrictions(pricingDefinition: PricingDefinition, consumptionData: Consumption) : PricingDefinition {
    if (pricingDefinition.restrictions) {
      if (!PricingEngine.checkMinEnergy(pricingDefinition.restrictions, consumptionData)
        || !PricingEngine.checkMaxEnergy(pricingDefinition.restrictions, consumptionData)
        || !PricingEngine.checkMinDuration(pricingDefinition.restrictions, consumptionData)
        || !PricingEngine.checkMaxDuration(pricingDefinition.restrictions, consumptionData)) {
        // -----------------------------------------------------------------------------------------
        // TODO - to be clarified - why don't we put "validity date" at the pricing model level?
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

  static checkConnectorType(restrictions: PricingStaticRestriction, transaction: Transaction, chargingStation: ChargingStation): boolean {
    if (!Utils.isNullOrUndefined(restrictions.connectorTypes)) {
      const connectorType = Utils.getConnectorFromID(chargingStation, transaction.connectorId)?.type;
      if (!restrictions.connectorTypes.includes(connectorType)) {
        return false;
      }
    }
    return true;
  }

  static checkMinPower(restrictions: PricingStaticRestriction, transaction: Transaction, chargingStation: ChargingStation): boolean {
    if (!Utils.isNullOrUndefined(restrictions.minOutputPowerkW)) {
      const connectorPowerWatts = Utils.getConnectorFromID(chargingStation, transaction.connectorId)?.power;
      if (Utils.createDecimal(connectorPowerWatts).dividedBy(1000).lessThan(restrictions.minOutputPowerkW)) {
        return false;
      }
    }
    return true;
  }

  static checkMaxPower(restrictions: PricingStaticRestriction, transaction: Transaction, chargingStation: ChargingStation): boolean {
    if (!Utils.isNullOrUndefined(restrictions.maxOutputPowerkW)) {
      const connectorPowerWatts = Utils.getConnectorFromID(chargingStation, transaction.connectorId)?.power;
      if (Utils.createDecimal(connectorPowerWatts).dividedBy(1000).greaterThanOrEqualTo(restrictions.maxOutputPowerkW)) {
        return false;
      }
    }
    return true;
  }

  static checkMinEnergy(restrictions: PricingRestriction, consumptionData: Consumption): boolean {
    if (!Utils.isNullOrUndefined(restrictions.minEnergyKWh)) {
      if (Utils.createDecimal(consumptionData.cumulatedConsumptionWh).div(1000).lessThan(restrictions.minEnergyKWh)) {
        return false;
      }
    }
    return true;
  }

  static checkMaxEnergy(restrictions: PricingRestriction, consumptionData: Consumption): boolean {
    if (!Utils.isNullOrUndefined(restrictions.maxEnergyKWh)) {
      if (Utils.createDecimal(consumptionData.cumulatedConsumptionWh).div(1000).greaterThanOrEqualTo(restrictions.maxEnergyKWh)) {
        return false;
      }
    }
    return true;
  }

  static checkMinDuration(restrictions: PricingRestriction, consumptionData: Consumption): boolean {
    if (!Utils.isNullOrUndefined(restrictions.minDurationSecs)) {
      if (Utils.createDecimal(consumptionData.totalDurationSecs).lessThan(restrictions.minDurationSecs)) {
        return false;
      }
    }
    return true;
  }

  static checkMaxDuration(restrictions: PricingRestriction, consumptionData: Consumption): boolean {
    if (!Utils.isNullOrUndefined(restrictions.maxDurationSecs)) {
      if (Utils.createDecimal(consumptionData.totalDurationSecs).greaterThanOrEqualTo(restrictions.maxDurationSecs)) {
        return false;
      }
    }
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private static priceFlatFeeConsumption(pricingDefinitions: PricingDefinition[], consumptionData: Consumption): PricedDimensionData {
    const activePricingDefinition = PricingEngine.getActiveDefinition4Dimension(pricingDefinitions, DimensionType.FLAT_FEE);
    if (activePricingDefinition) {
      const dimensionToPrice = activePricingDefinition.dimensions.flatFee;
      const pricedData = PricingEngine.priceFlatFeeDimension(dimensionToPrice);
      if (pricedData) {
        pricedData.sourceName = activePricingDefinition.name;
      }
      return pricedData;
    }
  }

  private static priceEnergyConsumption(pricingDefinitions: PricingDefinition[], consumptionData: Consumption): PricedDimensionData {
    const activePricingDefinition = PricingEngine.getActiveDefinition4Dimension(pricingDefinitions, DimensionType.ENERGY);
    if (activePricingDefinition) {
      const dimensionToPrice = activePricingDefinition.dimensions.energy;
      const pricedData = PricingEngine.priceEnergyDimension(dimensionToPrice, consumptionData?.cumulatedConsumptionWh || 0);
      if (pricedData) {
        pricedData.sourceName = activePricingDefinition.name;
      }
      return pricedData;
    }
  }

  private static priceParkingTimeConsumption(pricingDefinitions: PricingDefinition[], consumptionData: Consumption): PricedDimensionData {
    const activePricingDefinition = PricingEngine.getActiveDefinition4Dimension(pricingDefinitions, DimensionType.PARKING_TIME);
    if (activePricingDefinition) {
      const dimensionToPrice = activePricingDefinition.dimensions.parkingTime;
      const pricedData = PricingEngine.priceTimeBasedDimension(dimensionToPrice, consumptionData?.totalInactivitySecs || 0);
      if (pricedData) {
        pricedData.sourceName = activePricingDefinition.name;
      }
      return pricedData;
    }
  }

  private static priceChargingTimeConsumption(pricingDefinitions: PricingDefinition[], consumptionData: Consumption): PricedDimensionData {
    const activePricingDefinition = PricingEngine.getActiveDefinition4Dimension(pricingDefinitions, DimensionType.CHARGING_TIME);
    if (activePricingDefinition) {
      const dimensionToPrice = activePricingDefinition.dimensions.chargingTime;
      const pricedData = PricingEngine.priceTimeBasedDimension(dimensionToPrice, consumptionData?.totalDurationSecs || 0);
      if (pricedData) {
        pricedData.sourceName = activePricingDefinition.name;
      }
      return pricedData;
    }
  }

  static getActiveDefinition4Dimension(actualPricingDefinitions: PricingDefinition[], dimensionType: string): PricingDefinition {
    // Search for the first pricing definition matching the current dimension type
    const activePricingDefinitions = actualPricingDefinitions.filter((pricingDefinition) =>
      // We search for a pricing definition where the current dimension exists
      PricingEngine.checkPricingDimensionRestrictions(pricingDefinition, dimensionType)
    );
    // Iterate throw the list of pricing definitions where the current dimension makes sense
    for (const activePricingDefinition of activePricingDefinitions) {
      const dimensionToPrice = activePricingDefinition.dimensions[dimensionType];
      if (dimensionToPrice) {
        return activePricingDefinition;
      }
    }
    return null;
  }

  static checkPricingDimensionRestrictions(pricingDefinition: PricingDefinition, dimensionType: string) : PricingDefinition {
    const pricingDimension: PricingDimension = pricingDefinition.dimensions[dimensionType];
    if (pricingDimension?.active) {
      return pricingDefinition;
    }
    return null;
  }

  static priceFlatFeeDimension(pricingDimension: PricingDimension): PricedDimensionData {
    const unitPrice = pricingDimension.price || 0;
    if (pricingDimension.pricedData) {
      // This should not happen for the flatFee dimension - Flat Fee is billed only once per session
      // throw new Error('Unexpected situation - priceFlatFeeDimension should be called only once per session');
      return {
        unitPrice: 0,
        amount: 0,
        roundedAmount: 0,
        quantity: 0
      };
    }
    // First call for this dimension
    pricingDimension.pricedData = {
      unitPrice: unitPrice,
      amount: unitPrice,
      roundedAmount: Utils.truncTo(unitPrice, 2),
      quantity: 1
    };
    return pricingDimension.pricedData;
  }

  static priceEnergyDimension(pricingDimension: PricingDimension, cumulatedConsumptionWh: number): PricedDimensionData {
    let amount: number;
    let consumptionkWh: number;
    const unitPrice = pricingDimension.price || 0;
    if (pricingDimension.stepSize) { // In kWh
      // TODO - clarify the .plus(1) below - shall we bill the first step?
      const nbSteps = Utils.createDecimal(cumulatedConsumptionWh).div(1000).divToInt(unitPrice).plus(1).toNumber();
      consumptionkWh = Utils.createDecimal(nbSteps).mul(pricingDimension.stepSize).toNumber();
      amount = Utils.createDecimal(unitPrice).mul(consumptionkWh).toNumber();
    } else {
      // Convert to kWh
      consumptionkWh = Utils.createDecimal(cumulatedConsumptionWh).div(1000).toNumber();
      amount = Utils.createDecimal(unitPrice).times(consumptionkWh).toNumber();
    }
    const previousData = pricingDimension.pricedData;
    if (previousData) {
      // The new priced data is the delta
      const delta = Utils.createDecimal(amount).minus(previousData?.amount || 0).toNumber();
      const newData : PricedDimensionData = {
        unitPrice: unitPrice,
        amount: delta,
        roundedAmount: Utils.truncTo(delta, 2),
        quantity: Utils.createDecimal(consumptionkWh).minus(previousData?.quantity || 0).toNumber(),
      };
      // Update the previous data
      previousData.amount = amount;
      previousData.roundedAmount = Utils.truncTo(amount, 2);
      previousData.quantity = consumptionkWh;
      // return the delta
      return newData;
    }
    // first call for this dimension
    pricingDimension.pricedData = {
      unitPrice: unitPrice,
      amount,
      roundedAmount: Utils.truncTo(amount, 2),
      quantity: consumptionkWh
    };
    return pricingDimension.pricedData;
  }

  static priceTimeBasedDimension(pricingDimension: PricingDimension, seconds: number): PricedDimensionData {
    let amount: number;
    let hours: number;
    const unitPrice = pricingDimension.price || 0;
    if (pricingDimension.stepSize) { // stepSize is in second
      // bill at least one step
      const nbSteps = Utils.createDecimal(seconds).divToInt(pricingDimension.stepSize).plus(1).toNumber();
      const nbSeconds = Utils.createDecimal(nbSteps).mul(pricingDimension.stepSize).toNumber();
      hours = Utils.createDecimal(nbSeconds).div(3600).toNumber();
      amount = Utils.createDecimal(unitPrice).mul(nbSeconds).div(3600).toNumber();
    } else {
      hours = Utils.createDecimal(seconds).div(3600).toNumber();
      amount = Utils.createDecimal(unitPrice).mul(seconds).div(3600).toNumber();
    }
    const previousData = pricingDimension.pricedData;
    if (previousData) {
      // The new priced data is the delta
      const delta = Utils.createDecimal(amount).minus(previousData?.amount || 0).toNumber();
      const newData : PricedDimensionData = {
        unitPrice: unitPrice,
        roundedAmount: Utils.truncTo(delta, 2),
        amount: delta,
        quantity: Utils.createDecimal(hours).minus(previousData?.quantity || 0).toNumber(),
      };
      // Update the previous data
      previousData.amount = amount;
      previousData.roundedAmount = Utils.truncTo(amount, 2);
      previousData.quantity = hours;
      // return the delta
      return newData;
    }
    // first call for this dimension
    pricingDimension.pricedData = {
      unitPrice: unitPrice,
      amount,
      roundedAmount: Utils.truncTo(amount, 2),
      quantity: hours
    };
    return pricingDimension.pricedData;
  }

  static priceConsumption(tenant: Tenant, pricingModel: ResolvedPricingModel, consumptionData: Consumption): PricedConsumptionData {
    // Check the restrictions to find the pricing definition matching the current context
    let actualPricingDefinitions = pricingModel.pricingDefinitions.filter((pricingDefinition) =>
      PricingEngine.checkPricingDefinitionRestrictions(pricingDefinition, consumptionData)
    );
    // Having more than one pricing definition this NOT a normal situation.
    // This means that two different tariff matches the same criteria. This should not happen!
    if (actualPricingDefinitions.length > 1) {
      // TODO - to be clarified! - Shall we mix several pricing definitions for a single transaction?
      actualPricingDefinitions = [ actualPricingDefinitions?.[0] ];
    }
    let flatFee: PricedDimensionData = null;
    if (!pricingModel.flatFeeAlreadyPriced) {
      // Flat fee must not be priced only once
      flatFee = PricingEngine.priceFlatFeeConsumption(actualPricingDefinitions, consumptionData);
      pricingModel.flatFeeAlreadyPriced = !!flatFee;
    }
    // Build the consumption data for each dimension
    const energy: PricedDimensionData = PricingEngine.priceEnergyConsumption(actualPricingDefinitions, consumptionData);
    const chargingTime: PricedDimensionData = PricingEngine.priceChargingTimeConsumption(actualPricingDefinitions, consumptionData);
    const parkingTime: PricedDimensionData = PricingEngine.priceParkingTimeConsumption(actualPricingDefinitions, consumptionData);

    // Return all dimensions
    const pricingConsumptionData: PricedConsumptionData = {
      flatFee,
      energy,
      chargingTime,
      parkingTime
    };
    return pricingConsumptionData;
  }

  static extractFinalPricingData(pricingModel: ResolvedPricingModel): PricedConsumptionData[] {
    // Iterate throw the list of pricing definitions
    const pricedData: PricedConsumptionData[] = pricingModel.pricingDefinitions.map((pricingDefinition) =>
      PricingEngine.extractFinalPricedConsumptionData(pricingDefinition)
    );
    // Remove null/undefined entries (if any)
    return pricedData.filter((pricingConsumptionData) => !!pricingConsumptionData);
  }

  static extractFinalPricedConsumptionData(pricingDefinition: PricingDefinition): PricedConsumptionData {
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

  static extractPricedDataFromDimension(pricedData: PricedDimensionData[], pricingDefinition: PricingDefinition, dimensionType: string): void {
    const pricingDimensionData = pricingDefinition.dimensions[dimensionType]?.pricedData;
    if (pricingDimensionData) {
      pricedData.push(pricingDimensionData);
    }
  }

}

