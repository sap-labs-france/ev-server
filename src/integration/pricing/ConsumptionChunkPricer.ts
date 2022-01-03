import { DimensionType, PricedConsumptionData, PricedDimensionData, PricingDimension, PricingRestriction, PricingTimeLimit, ResolvedPricingDefinition, ResolvedPricingModel } from '../../types/Pricing';

import Consumption from '../../types/Consumption';
import ConsumptionPricer from './ConsumptionPricer';
import PricingHelper from './PricingHelper';
import Utils from '../../utils/Utils';
import moment from 'moment';

interface ConsumptionChunk{
  startedAt: Date;
  endedAt: Date;
  consumptionWh: number;
  cumulatedConsumptionWh: number;
  totalDurationSecs: number;
  totalInactivitySecs: number;
}

export default class ConsumptionChunkGenerator {
  consumptionPricer: ConsumptionPricer;
  constructor(consumptionPricer: ConsumptionPricer) {
    this.consumptionPricer = consumptionPricer;
  }

  public priceConsumption(): PricedConsumptionData {
    let accumulatedConsumptionData: PricedConsumptionData = {};
    for (const consumptionChunk of this.generateChunk()) {
      const pricedData = this.priceConsumptionChunk(consumptionChunk);
      accumulatedConsumptionData = PricingHelper.accumulatePricedConsumption([ accumulatedConsumptionData, pricedData ]);
    }
    return accumulatedConsumptionData;
  }

  private priceConsumptionChunk(consumptionChunk: ConsumptionChunk): PricedConsumptionData {
    const consumptionChunkPricer = new ConsumptionChunkPricer(this.consumptionPricer, consumptionChunk);
    return consumptionChunkPricer.priceConsumptionChunk();
  }

  private * generateChunk(): IterableIterator<ConsumptionChunk> {
    const consumptionData = this.consumptionPricer.consumptionData;
    const startedAt = moment(consumptionData.startedAt);
    const endedAt = moment(consumptionData.endedAt);
    const durationSecs = endedAt.diff(startedAt, 'seconds');
    if (durationSecs <= 60) {
      yield ConsumptionChunkPricer.convertToConsumptionChunk(consumptionData);
    } else {
      // Well - we got data for more than 1 minute! - we need to handle chunks!
      const nbSeconds = endedAt.diff(startedAt, 'seconds');
      let secondsAlreadyPriced = 0;
      let chunkCumulatedConsumptionWh = Utils.createDecimal(consumptionData.cumulatedConsumptionWh).minus(consumptionData.consumptionWh);
      let chunkTotalDurationSecs = Utils.createDecimal(consumptionData.totalDurationSecs).minus(durationSecs);
      while (secondsAlreadyPriced < nbSeconds) {
        // Number of seconds for the current chunk
        const secondsToPrice = Utils.minValue(nbSeconds - secondsAlreadyPriced, 60);
        // Chunk dates
        const chunkStartedAt = moment(startedAt).add(secondsAlreadyPriced, 'seconds');
        const chunkEndedAt = moment(startedAt).add(secondsAlreadyPriced + secondsToPrice, 'seconds');
        // Chunk consumption
        const chunkConsumptionWh = Utils.createDecimal(consumptionData.consumptionWh).mul(secondsToPrice).divToInt(nbSeconds);
        // Chunk accumulated data
        chunkCumulatedConsumptionWh = chunkCumulatedConsumptionWh.add(chunkConsumptionWh);
        chunkTotalDurationSecs = chunkTotalDurationSecs.plus(secondsToPrice);
        // Create the consumption chunk
        const consumptionChunk = {
          startedAt: chunkStartedAt.toDate(),
          endedAt: chunkEndedAt.toDate(),
          consumptionWh: chunkConsumptionWh.toNumber(),
          cumulatedConsumptionWh: chunkCumulatedConsumptionWh.toNumber(),
          totalDurationSecs: chunkTotalDurationSecs.toNumber(),
          totalInactivitySecs: 0 // TO BE CLARIFIED
        };
        // Number of seconds already priced
        secondsAlreadyPriced += secondsToPrice;
        // Production of the chunk
        yield consumptionChunk;
      }
    }
  }
}

class ConsumptionChunkPricer {

  consumptionPricer: ConsumptionPricer;
  consumptionChunk: ConsumptionChunk;
  actualPricingDefinitions: ResolvedPricingDefinition[];

  constructor(consumptionPricer: ConsumptionPricer, consumptionChunk: ConsumptionChunk) {
    this.consumptionPricer = consumptionPricer;
    this.consumptionChunk = consumptionChunk;
    const actualPricingDefinitions = this.getPricingModel().pricingDefinitions.filter((pricingDefinition) =>
      this.checkPricingDefinitionRestrictions(pricingDefinition)
    );
    // It does not make sense to apply several tariffs to a single consumption
    this.actualPricingDefinitions = [ actualPricingDefinitions[0] ];
  }

  public static convertToConsumptionChunk(consumptionData: Consumption): ConsumptionChunk {
    return {
      startedAt: consumptionData.startedAt,
      endedAt: consumptionData.endedAt,
      consumptionWh: consumptionData.consumptionWh,
      cumulatedConsumptionWh: consumptionData.cumulatedConsumptionWh,
      totalDurationSecs: consumptionData.totalDurationSecs,
      totalInactivitySecs: consumptionData.totalInactivitySecs
    };
  }

  public getPricingModel(): ResolvedPricingModel {
    return this.consumptionPricer.getPricingModel();
  }

  public priceConsumptionChunk(): PricedConsumptionData {
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

  private checkPricingDefinitionRestrictions(pricingDefinition: ResolvedPricingDefinition) : ResolvedPricingDefinition {
    if (pricingDefinition.restrictions) {
      if (!this.checkDayOfWeek(pricingDefinition.restrictions)
        || !this.checkTimeValidity(pricingDefinition.restrictions)
        || !this.checkMinEnergy(pricingDefinition.restrictions)
        || !this.checkMaxEnergy(pricingDefinition.restrictions)
        || !this.checkMinDuration(pricingDefinition.restrictions)
        || !this.checkMaxDuration(pricingDefinition.restrictions)) {
        return null;
      }
    }
    // a definition matching the restrictions has been found
    return pricingDefinition;
  }

  private checkDayOfWeek(restrictions: PricingRestriction): boolean {
    if (!Utils.isNullOrUndefined(restrictions.daysOfWeek)) {
      const timezone = this.getPricingModel().pricerContext.timezone;
      if (!timezone) {
        // Charging station timezone is not known - 'days of the week' restrictions cannot be used in such context
        return false;
      }
      // ACHTUNG - moment.isoWeekday() - 1:MONDAY, 7: SUNDAY
      return restrictions.daysOfWeek.includes(moment(this.consumptionChunk.startedAt).tz(timezone).isoWeekday());
    }
    // No restrictions related to the day of the week
    return true;
  }

  private checkTimeValidity(restrictions: PricingRestriction): boolean {
    // The time range restriction must consider the charging station timezone
    if (Utils.isNullOrUndefined(restrictions.timeFrom) && Utils.isNullOrUndefined(restrictions.timeTo)) {
      // No time restrictions
      return true;
    }
    // The time range has to consider the time zone of the charging station
    const timezone = this.getPricingModel().pricerContext.timezone;
    if (!timezone) {
      // Charging station timezone is not known - time restrictions cannot be used in such context
      return false;
    }
    // Normalize time range restrictions - both limits must be set!
    const timeFrom = PricingTimeLimit.parseTime(restrictions.timeFrom || '00:00');
    const timeTo = PricingTimeLimit.parseTime(restrictions.timeTo || '00:00');
    // Time of the consumption in its timezone
    const consumptionStartTime = PricingTimeLimit.parseTime(moment(this.consumptionChunk.startedAt).tz(timezone).format('HH:mm:ss'));
    return consumptionStartTime.isBetween(timeFrom, timeTo);
  }

  private checkMinEnergy(restrictions: PricingRestriction): boolean {
    if (!Utils.isNullOrUndefined(restrictions.minEnergyKWh)) {
      if (Utils.createDecimal(this.consumptionChunk.cumulatedConsumptionWh).div(1000).lessThan(restrictions.minEnergyKWh)) {
        return false;
      }
    }
    return true;
  }

  private checkMaxEnergy(restrictions: PricingRestriction): boolean {
    if (!Utils.isNullOrUndefined(restrictions.maxEnergyKWh)) {
      if (Utils.createDecimal(this.consumptionChunk.cumulatedConsumptionWh).div(1000).greaterThanOrEqualTo(restrictions.maxEnergyKWh)) {
        return false;
      }
    }
    return true;
  }

  private checkMinDuration(restrictions: PricingRestriction): boolean {
    if (!Utils.isNullOrUndefined(restrictions.minDurationSecs)) {
      if (Utils.createDecimal(this.consumptionChunk.totalDurationSecs).lessThan(restrictions.minDurationSecs)) {
        return false;
      }
      return true;
    }
    return true;
  }

  private checkMaxDuration(restrictions: PricingRestriction): boolean {
    if (!Utils.isNullOrUndefined(restrictions.maxDurationSecs)) {
      if (Utils.createDecimal(this.consumptionChunk.totalDurationSecs).greaterThanOrEqualTo(restrictions.maxDurationSecs)) {
        return false;
      }
    }
    return true;
  }

  private priceFlatFeeConsumption(): PricedDimensionData {
    // Flat fee must be priced only once
    if (!this.getPricingModel().pricerContext.flatFeeAlreadyPriced) {
      const activePricingDefinition = this.getActiveDefinition4Dimension(this.actualPricingDefinitions, DimensionType.FLAT_FEE);
      if (activePricingDefinition) {
        const dimensionToPrice = activePricingDefinition.dimensions.flatFee;
        const pricedData = this.priceFlatFeeDimension(dimensionToPrice);
        if (pricedData) {
          pricedData.sourceName = activePricingDefinition.name;
          this.getPricingModel().pricerContext.flatFeeAlreadyPriced = true;
        }
        return pricedData;
      }
    }
  }

  private priceEnergyConsumption(): PricedDimensionData {
    const activePricingDefinition = this.getActiveDefinition4Dimension(this.actualPricingDefinitions, DimensionType.ENERGY);
    if (activePricingDefinition) {
      let pricedData: PricedDimensionData;
      const dimensionToPrice = activePricingDefinition.dimensions.energy;
      const consumptionWh = this.consumptionChunk?.consumptionWh || 0;
      if (typeof consumptionWh !== 'number') {
        throw new Error('Unexpected situation - consumption is inconsistent');
      }
      if (dimensionToPrice.stepSize) {
        if (this.consumptionChunk.cumulatedConsumptionWh > 0) {
          const delta = Utils.createDecimal(this.consumptionChunk.cumulatedConsumptionWh).minus(this.getAbsorbedConsumption());
          const nbSteps = delta.divToInt(dimensionToPrice.stepSize).toNumber();
          if (nbSteps > 0) {
            pricedData = this.priceConsumptionStep(dimensionToPrice, nbSteps);
            this.absorbStepConsumption(pricedData);
          }
        }
      } else if (consumptionWh > 0) {
        pricedData = this.priceConsumptionWh(dimensionToPrice, consumptionWh);
        this.absorbConsumption();
      }
      return this.enrichPricedData(pricedData, activePricingDefinition);

    }
    // IMPORTANT!
    this.absorbConsumption();
  }

  private enrichPricedData(pricedData: PricedDimensionData, activePricingDefinition: ResolvedPricingDefinition) : PricedDimensionData {
    if (pricedData) {
      pricedData.sourceName = activePricingDefinition.name;
    }
    return pricedData;
  }

  private getAbsorbedConsumption() {
    return this.getPricingModel().pricerContext.lastAbsorbedConsumption || 0;
  }

  private absorbConsumption() {
    // Mark the consumed energy as already priced - to avoid pricing it twice
    // This may happen when combining several tariffs in a single session
    this.getPricingModel().pricerContext.lastAbsorbedConsumption = this.consumptionChunk.cumulatedConsumptionWh;
  }

  private absorbStepConsumption(pricedData?: PricedDimensionData) {
    // Mark the consumed energy as already priced - to avoid pricing it twice
    // Make sure to consider the stepSize to avoid absorbing something not yet priced
    const consumption = Utils.createDecimal(this.consumptionChunk.cumulatedConsumptionWh).div(pricedData.stepSize).trunc().mul(pricedData.stepSize).toNumber();
    this.getPricingModel().pricerContext.lastAbsorbedConsumption = consumption;
  }

  private priceChargingTimeConsumption(): PricedDimensionData {
    const activePricingDefinition = this.getActiveDefinition4Dimension(this.actualPricingDefinitions, DimensionType.CHARGING_TIME);
    if (activePricingDefinition) {
      const dimensionToPrice = activePricingDefinition.dimensions.chargingTime;
      const consumptionWh = this.consumptionChunk?.consumptionWh || 0;
      // Price the charging time only when charging!
      if (consumptionWh > 0) {
        const pricedData = this.priceTimeDimension(dimensionToPrice, this.getAbsorbedChargingTime());
        if (pricedData) {
          this.absorbChargingTime();
        }
        return this.enrichPricedData(pricedData, activePricingDefinition);
      }
    }
    // IMPORTANT!
    this.absorbChargingTime();
  }

  private getAbsorbedChargingTime() {
    return this.getPricingModel().pricerContext.lastAbsorbedChargingTime || this.getPricingModel().pricerContext.sessionStartDate;
  }

  private absorbChargingTime() {
    // Mark the charging time as already priced - to avoid pricing it twice
    // This may happen when combining several tariffs in a single session
    this.getPricingModel().pricerContext.lastAbsorbedChargingTime = this.consumptionChunk.endedAt;
  }

  private priceParkingTimeConsumption(): PricedDimensionData {
    const activePricingDefinition = this.getActiveDefinition4Dimension(this.actualPricingDefinitions, DimensionType.PARKING_TIME);
    if (activePricingDefinition) {
      const dimensionToPrice = activePricingDefinition.dimensions.parkingTime;
      const totalInactivitySecs = this.consumptionChunk?.totalInactivitySecs || 0;
      const cumulatedConsumptionDataWh = this.consumptionChunk?.cumulatedConsumptionWh || 0;
      const consumptionWh = this.consumptionChunk?.consumptionWh || 0;
      // Price the parking time only when it makes sense - NOT during the warmup!
      if (totalInactivitySecs > 0 && cumulatedConsumptionDataWh > 0 && consumptionWh <= 0) {
        const pricedData = this.priceTimeDimension(dimensionToPrice, this.getAbsorbedParkingTime());
        if (pricedData) {
          this.absorbParkingTime();
        }
        return this.enrichPricedData(pricedData, activePricingDefinition);
      }
    }
    // IMPORTANT!
    this.absorbParkingTime();
  }

  private getAbsorbedParkingTime() {
    return this.getPricingModel().pricerContext.lastAbsorbedParkingTime || this.getPricingModel().pricerContext.sessionStartDate;
  }

  private absorbParkingTime() {
    // Mark the parking time as already priced - to avoid pricing it twice
    // This may happen when combining several tariffs in a single session
    this.getPricingModel().pricerContext.lastAbsorbedParkingTime = this.consumptionChunk.endedAt;
  }

  private getActiveDefinition4Dimension(actualPricingDefinitions: ResolvedPricingDefinition[], dimensionType: string): ResolvedPricingDefinition {
    // Search for the first pricing definition matching the current dimension type
    return actualPricingDefinitions.find((pricingDefinition) =>
      this.checkPricingDimensionRestrictions(pricingDefinition, dimensionType)
    );
  }

  private checkPricingDimensionRestrictions(pricingDefinition: ResolvedPricingDefinition, dimensionType: string) : ResolvedPricingDefinition {
    const pricingDimension: PricingDimension = pricingDefinition.dimensions[dimensionType];
    if (pricingDimension?.active) {
      return pricingDefinition;
    }
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
        quantity: 0 // Session
      };
    }
    // First call for this dimension
    pricingDimension.pricedData = {
      unitPrice: unitPrice,
      amount: unitPrice,
      roundedAmount: Utils.truncTo(unitPrice, 2),
      quantity: 1 // Session
    };
    return pricingDimension.pricedData;
  }

  private priceConsumptionStep(pricingDimension: PricingDimension, steps: number): PricedDimensionData {
    const unitPrice = pricingDimension.price || 0; // Eur/wWh
    const quantity = Utils.createDecimal(steps).times(pricingDimension.stepSize).toNumber(); // Wh
    const amount = Utils.createDecimal(unitPrice).times(quantity).div(1000).toNumber(); // Eur
    // Price the consumption
    const pricedData: PricedDimensionData = {
      unitPrice: unitPrice,
      amount,
      roundedAmount: Utils.truncTo(amount, 2),
      quantity,
      stepSize: pricingDimension.stepSize,
    };
    // Add the consumption to the previous data (if any) - for the billing
    this.addPricedData(pricingDimension, pricedData);
    // Return the current consumption!
    return pricedData;
  }

  private priceConsumptionWh(pricingDimension: PricingDimension, consumptionWh: number): PricedDimensionData {
    const unitPrice = pricingDimension.price || 0; // Eur/kWh
    const quantity = Utils.createDecimal(consumptionWh).toNumber(); // Wh
    const amount = Utils.createDecimal(unitPrice).times(consumptionWh).div(1000).toNumber(); // Eur
    // const consumptionkWh = Utils.createDecimal(consumptionWh).div(1000).toNumber();
    // Price the consumption
    const pricedData: PricedDimensionData = {
      unitPrice: unitPrice,
      amount,
      roundedAmount: Utils.truncTo(amount, 2),
      quantity
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
      // TODO - to be clarified - do we pay the first step before consuming it or not?
      const timeSpent = moment(this.consumptionChunk.endedAt).diff(moment(lastStepDate), 'seconds');
      const nbSteps = Utils.createDecimal(timeSpent).divToInt(pricingDimension.stepSize).toNumber();
      if (nbSteps > 0) {
        return this.priceTimeSteps(pricingDimension, nbSteps);
      }
    } else {
      const seconds = moment(this.consumptionChunk.endedAt).diff(moment(this.consumptionChunk.startedAt), 'seconds');
      if (seconds > 0) {
        return this.priceTimeSpent(pricingDimension, seconds);
      }
    }
  }

  private priceTimeSteps(pricingDimension: PricingDimension, steps: number): PricedDimensionData {
    const unitPrice = pricingDimension.price || 0; // Eur/hour
    const quantity = Utils.createDecimal(steps).times(pricingDimension.stepSize).toNumber(); // seconds
    const amount = Utils.createDecimal(unitPrice).times(quantity).div(3600).toNumber(); // Eur
    // Price the consumption
    const pricedData: PricedDimensionData = {
      unitPrice: unitPrice,
      amount,
      roundedAmount: Utils.truncTo(amount, 2),
      quantity,
      stepSize: pricingDimension.stepSize
    };
    // Add the consumption to the previous data (if any) - for the billing
    this.addPricedData(pricingDimension, pricedData);
    // Return the current consumption!
    return pricedData;
  }

  private priceTimeSpent(pricingDimension: PricingDimension, seconds: number): PricedDimensionData {
    const unitPrice = pricingDimension.price || 0; // Eur/hour
    const amount = Utils.createDecimal(unitPrice).times(seconds).div(3600).toNumber(); // Eur
    // Price the consumption
    const pricedData: PricedDimensionData = {
      unitPrice: unitPrice,
      amount,
      roundedAmount: Utils.truncTo(amount, 2),
      quantity: seconds
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
      previousData.amount = Utils.createDecimal(previousData.amount).plus(pricedData.amount).toNumber();
      previousData.quantity = Utils.createDecimal(previousData.quantity).plus(pricedData.quantity).toNumber();
      previousData.roundedAmount = Utils.truncTo(previousData.amount, 2);
    } else {
      pricingDimension.pricedData = pricedData;
    }
  }
}
