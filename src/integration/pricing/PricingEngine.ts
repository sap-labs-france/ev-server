import FeatureToggles, { Feature } from '../../utils/FeatureToggles';
/* eslint-disable @typescript-eslint/member-ordering */
import PricingDefinition, { CurrentContext, DimensionType, PricedConsumptionData, PricedDimensionData, PricingDimension, PricingRestriction, PricingStaticRestriction, ResolvedPricingModel } from '../../types/Pricing';

import ChargingStation from '../../types/ChargingStation';
import Constants from '../../utils/Constants';
import Consumption from '../../types/Consumption';
import PricingStorage from '../../storage/mongodb/PricingStorage';
import Tenant from '../../types/Tenant';
import Transaction from '../../types/Transaction';
import Utils from '../../utils/Utils';
import moment from 'moment';

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
      currentContext: {
        flatFeeAlreadyPriced: false,
        startDate: transaction.timestamp
      },
      pricingDefinitions
    };
    return Promise.resolve(resolvedPricingModel);
  }

  static async getPricingDefinitions4Entity(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation, entityID: string): Promise<PricingDefinition[]> {
    let pricingDefinitions = await PricingEngine._getPricingDefinitions4Entity(tenant, entityID);
    pricingDefinitions = pricingDefinitions || [];
    const actualPricingDefinitions = pricingDefinitions.filter((pricingDefinition) =>
      PricingEngine.checkStaticRestrictions(pricingDefinition, transaction, chargingStation)
    );
    return actualPricingDefinitions || [];
  }

  private static async _getPricingDefinitions4Entity(tenant: Tenant, entityID: string): Promise<PricingDefinition[]> {
    if (entityID) {
      const entityIDs = [ entityID ];
      const pricingModelResults = await PricingStorage.getPricingDefinitions(tenant, { entityIDs }, {
        limit: Constants.DB_RECORD_COUNT_NO_LIMIT, skip: 0, sort: { createdOn: -1 }
      });
      if (pricingModelResults.count > 0) {
        return pricingModelResults.result;
      }
    }
    return null;
  }

  static checkStaticRestrictions(pricingDefinition: PricingDefinition, transaction: Transaction, chargingStation: ChargingStation) : PricingDefinition {
    if (pricingDefinition.staticRestrictions) {
      if (
        !PricingEngine.checkDateValidity(pricingDefinition.staticRestrictions, transaction)
      || !PricingEngine.checkConnectorType(pricingDefinition.staticRestrictions, transaction, chargingStation)
      || !PricingEngine.checkConnectorPower(pricingDefinition.staticRestrictions, transaction, chargingStation)
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

  static checkDateValidity(staticRestrictions: PricingStaticRestriction, transaction: Transaction): boolean {
    if (!Utils.isNullOrUndefined(staticRestrictions.validFrom)) {
      if (moment(transaction.timestamp).isBefore(staticRestrictions.validFrom)) {
        return false;
      }
    }
    if (!Utils.isNullOrUndefined(staticRestrictions.validTo)) {
      if (moment(transaction.timestamp).isSameOrAfter(staticRestrictions.validTo)) {
        return false;
      }
    }
    return true;
  }

  static checkConnectorType(staticRestrictions: PricingStaticRestriction, transaction: Transaction, chargingStation: ChargingStation): boolean {
    if (!Utils.isNullOrUndefined(staticRestrictions.connectorType)) {
      const connectorType = Utils.getConnectorFromID(chargingStation, transaction.connectorId)?.type;
      if (staticRestrictions.connectorType !== connectorType) {
        return false;
      }
    }
    return true;
  }

  static checkConnectorPower(staticRestrictions: PricingStaticRestriction, transaction: Transaction, chargingStation: ChargingStation): boolean {
    if (!Utils.isNullOrUndefined(staticRestrictions.connectorPowerkW)) {
      const connectorPowerWatts = Utils.getConnectorFromID(chargingStation, transaction.connectorId)?.power;
      if (!Utils.createDecimal(connectorPowerWatts).div(1000).equals(staticRestrictions.connectorPowerkW)) {
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
      const pricedData = PricingEngine.priceEnergyDimension(dimensionToPrice, consumptionData?.consumptionWh || 0);
      if (pricedData) {
        pricedData.sourceName = activePricingDefinition.name;
      }
      return pricedData;
    }
  }

  private static priceChargingTimeConsumption(pricingDefinitions: PricingDefinition[], consumptionData: Consumption, currentContext: CurrentContext): PricedDimensionData {
    const activePricingDefinition = PricingEngine.getActiveDefinition4Dimension(pricingDefinitions, DimensionType.CHARGING_TIME);
    if (activePricingDefinition) {
      const dimensionToPrice = activePricingDefinition.dimensions.chargingTime;
      const consumptionWh = consumptionData?.consumptionWh || 0;
      // Price the charging time only when charging!
      if (consumptionWh > 0) {
        const pricedData = PricingEngine.priceTimeDimension(dimensionToPrice, consumptionData, currentContext);
        if (pricedData) {
          pricedData.sourceName = activePricingDefinition.name;
        }
        return pricedData;
      }
    }
  }

  private static priceParkingTimeConsumption(pricingDefinitions: PricingDefinition[], consumptionData: Consumption, currentContext: CurrentContext): PricedDimensionData {
    const activePricingDefinition = PricingEngine.getActiveDefinition4Dimension(pricingDefinitions, DimensionType.PARKING_TIME);
    if (activePricingDefinition) {
      const dimensionToPrice = activePricingDefinition.dimensions.parkingTime;
      const cumulatedConsumptionDataWh = consumptionData?.cumulatedConsumptionWh || 0;
      const consumptionWh = consumptionData?.consumptionWh || 0;
      // Price the parking time only after having charged - NOT during the warmup!
      if (cumulatedConsumptionDataWh > 0 && consumptionWh <= 0) {
        const pricedData = PricingEngine.priceTimeDimension(dimensionToPrice, consumptionData, currentContext);
        if (pricedData) {
          pricedData.sourceName = activePricingDefinition.name;
        }
        return pricedData;
      }
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

  static priceEnergyDimension(pricingDimension: PricingDimension, consumptionWh: number): PricedDimensionData {
    const unitPrice = pricingDimension.price || 0;
    const amount = Utils.createDecimal(unitPrice).times(consumptionWh).div(1000).toNumber();
    const consumptionkWh = Utils.createDecimal(consumptionWh).div(1000).toNumber();
    // Price the consumption
    const pricedData: PricedDimensionData = {
      unitPrice: unitPrice,
      amount,
      roundedAmount: Utils.truncTo(amount, 2),
      quantity: consumptionkWh
    };
    // Add the consumption to the previous data (if any) - for the billing
    PricingEngine.addPricedData(pricingDimension, pricedData);
    // Return the current consumption!
    return pricedData;
  }

  static priceConsumption(tenant: Tenant, pricingModel: ResolvedPricingModel, consumptionData: Consumption): PricedConsumptionData {
    // Check the restrictions to find the pricing definition matching the current context
    let actualPricingDefinitions = pricingModel.pricingDefinitions.filter((pricingDefinition) => {
      if (FeatureToggles.isFeatureActive(Feature.PRICING_WITH_RESTRICTION_CHECKS)) {
        return PricingEngine.checkPricingDefinitionRestrictions(pricingDefinition, consumptionData);
      }
      // Dynamic restrictions check are not yet supported
      return pricingDefinition;
    });
    // Having more than one pricing definition this NOT a normal situation.
    // This means that two different tariff matches the same criteria. This should not happen!
    if (actualPricingDefinitions.length > 1) {
      // TODO - to be clarified! - Shall we mix several pricing definitions for a single transaction?
      actualPricingDefinitions = [ actualPricingDefinitions?.[0] ];
    }
    let flatFee: PricedDimensionData = null;
    if (!pricingModel.currentContext.flatFeeAlreadyPriced) {
      // Flat fee must not be priced only once
      flatFee = PricingEngine.priceFlatFeeConsumption(actualPricingDefinitions, consumptionData);
      pricingModel.currentContext.flatFeeAlreadyPriced = !!flatFee;
    }
    // Build the consumption data for each dimension
    const energy: PricedDimensionData = PricingEngine.priceEnergyConsumption(actualPricingDefinitions, consumptionData);
    const chargingTime: PricedDimensionData = PricingEngine.priceChargingTimeConsumption(actualPricingDefinitions, consumptionData, pricingModel.currentContext);
    const parkingTime: PricedDimensionData = PricingEngine.priceParkingTimeConsumption(actualPricingDefinitions, consumptionData, pricingModel.currentContext);
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

  private static priceTimeDimension(pricingDimension: PricingDimension, consumptionData: Consumption, currentContext: CurrentContext): PricedDimensionData {
    // Is there a step size
    if (pricingDimension.stepSize) {
      const lastStepDate = currentContext.lastStepDate || currentContext.startDate;
      // Price the charging time only when charging!
      const timeSpent = moment(consumptionData.endedAt).diff(moment(lastStepDate), 'seconds');
      const nbSteps = Utils.createDecimal(timeSpent).divToInt(pricingDimension.stepSize).toNumber();
      if (nbSteps > 0) {
        currentContext.lastStepDate = consumptionData.endedAt;
        return this.priceTimeSteps(pricingDimension, nbSteps);
      }
    } else {
      const seconds = moment(consumptionData.endedAt).diff(moment(consumptionData.startedAt), 'seconds');
      if (seconds > 0) {
        return this.priceTimeSpent(pricingDimension, seconds);
      }
    }
  }

  private static priceTimeSteps(pricingDimension: PricingDimension, steps: number): PricedDimensionData {
    const unitPrice = pricingDimension.price || 0;
    const amount = Utils.createDecimal(unitPrice).times(steps).times(pricingDimension.stepSize).div(3600).toNumber();
    // Price the consumption
    const pricedData: PricedDimensionData = {
      unitPrice: unitPrice,
      amount,
      roundedAmount: Utils.truncTo(amount, 2),
      quantity: steps
    };
    // Add the consumption to the previous data (if any) - for the billing
    PricingEngine.addPricedData(pricingDimension, pricedData);
    // Return the current consumption!
    return pricedData;
  }

  private static priceTimeSpent(pricingDimension: PricingDimension, seconds: number): PricedDimensionData {
    const unitPrice = pricingDimension.price || 0;
    const amount = Utils.createDecimal(unitPrice).times(seconds).div(3600).toNumber();
    const hours = Utils.createDecimal(seconds).div(3600).toNumber();
    // Price the consumption
    const pricedData: PricedDimensionData = {
      unitPrice: unitPrice,
      amount,
      roundedAmount: Utils.truncTo(amount, 2),
      quantity: hours
    };
    // Add the consumption to the previous data (if any) - for the billing
    PricingEngine.addPricedData(pricingDimension, pricedData);
    // Return the current consumption!
    return pricedData;
  }

  private static addPricedData(pricingDimension: PricingDimension, pricedData: PricedDimensionData): void {
    // Add the consumption to the previous data (if any) - for the billing
    const previousData = pricingDimension.pricedData;
    if (previousData) {
      previousData.amount += pricedData.amount;
      previousData.quantity += pricedData.quantity;
      previousData.roundedAmount = Utils.truncTo(previousData.amount, 2);
    } else {
      pricingDimension.pricedData = pricedData;
    }
  }
}

