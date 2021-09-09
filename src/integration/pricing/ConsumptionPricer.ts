import PricingDefinition, { DimensionType, PricedConsumptionData, PricedDimensionData, PricingDimension, PricingRestriction, ResolvedPricingModel } from '../../types/Pricing';

import Consumption from '../../types/Consumption';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';
import moment from 'moment';

export default class ConsumptionPricer {

  tenant: Tenant;
  pricingModel: ResolvedPricingModel;
  consumptionData: Consumption;
  actualPricingDefinitions: PricingDefinition[];

  constructor(tenant: Tenant, pricingModel: ResolvedPricingModel, consumptionData: Consumption) {
    this.tenant = tenant;
    this.pricingModel = pricingModel;
    this.consumptionData = consumptionData;
    const actualPricingDefinitions = this.pricingModel.pricingDefinitions.filter((pricingDefinition) =>
      this.checkPricingDefinitionRestrictions(pricingDefinition)
    );
    // It does not make sense to apply several tariffs to a single consumption
    this.actualPricingDefinitions = [ actualPricingDefinitions?.[0] ];
  }

  public priceConsumption(): PricedConsumptionData {
    // Price the consumption data for each dimension
    const flatFee = this.priceFlatFeeConsumption();
    const energy = this.priceEnergyConsumption();
    const chargingTime = this.priceChargingTimeConsumption();
    const parkingTime = this.priceParkingTimeConsumption();
    // Return all dimensions
    const pricingConsumptionData: PricedConsumptionData = {
      flatFee,
      energy,
      chargingTime,
      parkingTime
    };
    return pricingConsumptionData;
  }

  private checkPricingDefinitionRestrictions(pricingDefinition: PricingDefinition) : PricingDefinition {
    if (pricingDefinition.restrictions) {
      if (!this.checkMinEnergy(pricingDefinition.restrictions)
        || !this.checkMaxEnergy(pricingDefinition.restrictions)
        || !this.checkMinDuration(pricingDefinition.restrictions)
        || !this.checkMaxDuration(pricingDefinition.restrictions)) {
        // ---------------------------------------------------
        // TODO - additional restrictions may be checked here
        // ---------------------------------------------------
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

  private checkMinEnergy(restrictions: PricingRestriction): boolean {
    if (!Utils.isNullOrUndefined(restrictions.minEnergyKWh)) {
      if (Utils.createDecimal(this.consumptionData.cumulatedConsumptionWh).div(1000).lessThan(restrictions.minEnergyKWh)) {
        return false;
      }
    }
    return true;
  }

  private checkMaxEnergy(restrictions: PricingRestriction): boolean {
    if (!Utils.isNullOrUndefined(restrictions.maxEnergyKWh)) {
      if (Utils.createDecimal(this.consumptionData.cumulatedConsumptionWh).div(1000).greaterThanOrEqualTo(restrictions.maxEnergyKWh)) {
        return false;
      }
    }
    return true;
  }

  private checkMinDuration(restrictions: PricingRestriction): boolean {
    if (!Utils.isNullOrUndefined(restrictions.minDurationSecs)) {
      if (Utils.createDecimal(this.consumptionData.totalDurationSecs).lessThan(restrictions.minDurationSecs)) {
        return false;
      }
      return true;
    }
    return true;
  }

  private checkMaxDuration(restrictions: PricingRestriction): boolean {
    if (!Utils.isNullOrUndefined(restrictions.maxDurationSecs)) {
      if (Utils.createDecimal(this.consumptionData.totalDurationSecs).greaterThanOrEqualTo(restrictions.maxDurationSecs)) {
        return false;
      }
    }
    return true;
  }

  private priceFlatFeeConsumption(): PricedDimensionData {
    // Flat fee must not be priced only once
    if (!this.pricingModel.pricerContext.flatFeeAlreadyPriced) {
      const activePricingDefinition = this.getActiveDefinition4Dimension(this.actualPricingDefinitions, DimensionType.FLAT_FEE);
      if (activePricingDefinition) {
        const dimensionToPrice = activePricingDefinition.dimensions.flatFee;
        const pricedData = this.priceFlatFeeDimension(dimensionToPrice);
        if (pricedData) {
          pricedData.sourceName = activePricingDefinition.name;
          this.pricingModel.pricerContext.flatFeeAlreadyPriced = true;
        }
        return pricedData;
      }
    }
  }

  private priceEnergyConsumption(): PricedDimensionData {
    const activePricingDefinition = this.getActiveDefinition4Dimension(this.actualPricingDefinitions, DimensionType.ENERGY);
    if (activePricingDefinition) {
      const dimensionToPrice = activePricingDefinition.dimensions.energy;
      // Price the charging time only when charging!
      const consumptionWh = this.consumptionData?.consumptionWh || 0;
      if (consumptionWh > 0) {
        const lastStepCumulatedConsumption = this.pricingModel.pricerContext.lastStepCumulatedConsumption || 0;
        const pricedData = this.priceEnergyDimension(dimensionToPrice, lastStepCumulatedConsumption);
        if (pricedData) {
          this.pricingModel.pricerContext.lastStepCumulatedConsumption = this.consumptionData.cumulatedConsumptionWh;
          pricedData.sourceName = activePricingDefinition.name;
        }
        return pricedData;
      }
    }
    // IMPORTANT - keep track of the latest consumption even when nothing was priced
    this.pricingModel.pricerContext.lastStepCumulatedConsumption = this.consumptionData.consumptionWh;
  }

  private priceChargingTimeConsumption(): PricedDimensionData {
    const activePricingDefinition = this.getActiveDefinition4Dimension(this.actualPricingDefinitions, DimensionType.CHARGING_TIME);
    if (activePricingDefinition) {
      const dimensionToPrice = activePricingDefinition.dimensions.chargingTime;
      const consumptionWh = this.consumptionData?.consumptionWh || 0;
      // Price the charging time only when charging!
      if (consumptionWh > 0) {
        const lastStepDate = this.pricingModel.pricerContext.lastStepChargingTimeDate || this.pricingModel.pricerContext.sessionStartDate;
        const pricedData = this.priceTimeDimension(dimensionToPrice, lastStepDate);
        if (pricedData) {
          this.pricingModel.pricerContext.lastStepChargingTimeDate = this.consumptionData.endedAt;
          pricedData.sourceName = activePricingDefinition.name;
        }
        return pricedData;
      }
      // IMPORTANT - keep track of the latest consumption even when nothing was priced
      this.pricingModel.pricerContext.lastStepChargingTimeDate = this.consumptionData.endedAt;
    }
  }

  private priceParkingTimeConsumption(): PricedDimensionData {
    const activePricingDefinition = this.getActiveDefinition4Dimension(this.actualPricingDefinitions, DimensionType.PARKING_TIME);
    if (activePricingDefinition) {
      const dimensionToPrice = activePricingDefinition.dimensions.parkingTime;
      const cumulatedConsumptionDataWh = this.consumptionData?.cumulatedConsumptionWh || 0;
      const consumptionWh = this.consumptionData?.consumptionWh || 0;
      // Price the parking time only after having charged - NOT during the warmup!
      if (cumulatedConsumptionDataWh > 0 && consumptionWh <= 0) {
        const lastStepDate = this.pricingModel.pricerContext.lastStepParkingTimeDate || this.pricingModel.pricerContext.sessionStartDate;
        const pricedData = this.priceTimeDimension(dimensionToPrice, lastStepDate);
        if (pricedData) {
          this.pricingModel.pricerContext.lastStepParkingTimeDate = this.consumptionData.endedAt;
          pricedData.sourceName = activePricingDefinition.name;
        }
        return pricedData;
      }
    }
    // IMPORTANT - keep track of the latest consumption even when nothing was priced
    this.pricingModel.pricerContext.lastStepParkingTimeDate = this.consumptionData.endedAt;
  }

  private getActiveDefinition4Dimension(actualPricingDefinitions: PricingDefinition[], dimensionType: string): PricingDefinition {
    // Search for the first pricing definition matching the current dimension type
    const activePricingDefinitions = actualPricingDefinitions.filter((pricingDefinition) =>
      // We search for a pricing definition where the current dimension exists
      this.checkPricingDimensionRestrictions(pricingDefinition, dimensionType)
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

  private checkPricingDimensionRestrictions(pricingDefinition: PricingDefinition, dimensionType: string) : PricingDefinition {
    const pricingDimension: PricingDimension = pricingDefinition.dimensions[dimensionType];
    if (pricingDimension?.active) {
      return pricingDefinition;
    }
    return null;
  }

  private extractFinalPricedConsumptionData(pricingDefinition: PricingDefinition): PricedConsumptionData {
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

  private priceFlatFeeDimension(pricingDimension: PricingDimension): PricedDimensionData {
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

  private priceEnergyDimension(pricingDimension: PricingDimension, lastStepCumulatedConsumption: number): PricedDimensionData {
    // Is there a step size
    if (pricingDimension.stepSize) {
      // Price the charging time only when charging!
      const delta = Utils.createDecimal(this.consumptionData.cumulatedConsumptionWh).minus(lastStepCumulatedConsumption);
      const nbSteps = delta.divToInt(pricingDimension.stepSize).toNumber();
      if (nbSteps > 0) {
        return this.priceConsumptionStep(pricingDimension, nbSteps);
      }
    } else {
      const consumptionWh = this.consumptionData?.consumptionWh || 0;
      if (consumptionWh > 0) {
        return this.priceConsumptionWh(pricingDimension, consumptionWh);
      }
    }
  }

  private priceConsumptionStep(pricingDimension: PricingDimension, steps: number): PricedDimensionData {
    const unitPrice = pricingDimension.price || 0;
    const amount = Utils.createDecimal(unitPrice).times(steps).times(pricingDimension.stepSize).div(1000).toNumber();
    // Price the consumption
    const pricedData: PricedDimensionData = {
      unitPrice: unitPrice,
      amount,
      roundedAmount: Utils.truncTo(amount, 2),
      quantity: steps
    };
    // Add the consumption to the previous data (if any) - for the billing
    this.addPricedData(pricingDimension, pricedData);
    // Return the current consumption!
    return pricedData;
  }

  private priceConsumptionWh(pricingDimension: PricingDimension, consumptionWh: number): PricedDimensionData {
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
    this.addPricedData(pricingDimension, pricedData);
    // Return the current consumption!
    return pricedData;
  }

  private priceTimeDimension(pricingDimension: PricingDimension, lastStepDate: Date): PricedDimensionData {
    // Is there a step size
    if (pricingDimension.stepSize) {
      // Price the charging time only when charging!
      const timeSpent = moment(this.consumptionData.endedAt).diff(moment(lastStepDate), 'seconds');
      const nbSteps = Utils.createDecimal(timeSpent).divToInt(pricingDimension.stepSize).toNumber();
      if (nbSteps > 0) {
        return this.priceTimeSteps(pricingDimension, nbSteps);
      }
    } else {
      const seconds = moment(this.consumptionData.endedAt).diff(moment(this.consumptionData.startedAt), 'seconds');
      if (seconds > 0) {
        return this.priceTimeSpent(pricingDimension, seconds);
      }
    }
  }

  private priceTimeSteps(pricingDimension: PricingDimension, steps: number): PricedDimensionData {
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
    this.addPricedData(pricingDimension, pricedData);
    // Return the current consumption!
    return pricedData;
  }

  private priceTimeSpent(pricingDimension: PricingDimension, seconds: number): PricedDimensionData {
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
    this.addPricedData(pricingDimension, pricedData);
    // Return the current consumption!
    return pricedData;
  }

  private addPricedData(pricingDimension: PricingDimension, pricedData: PricedDimensionData): void {
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
