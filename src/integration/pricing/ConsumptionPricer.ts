import { PricedConsumptionData, PricingRestriction, PricingTimeLimit, ResolvedPricingDefinition, ResolvedPricingModel } from '../../types/Pricing';

import Consumption from '../../types/Consumption';
import ConsumptionChunkGenerator from './ConsumptionChunkPricer';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';
import moment from 'moment';

export default class ConsumptionPricer {

  tenant: Tenant;
  pricingModel: ResolvedPricingModel;
  consumptionData: Consumption;
  actualPricingDefinitions: ResolvedPricingDefinition[];

  constructor(tenant: Tenant, pricingModel: ResolvedPricingModel, consumptionData: Consumption) {
    this.tenant = tenant;
    this.pricingModel = pricingModel;
    this.consumptionData = consumptionData;
    const actualPricingDefinitions = this.pricingModel.pricingDefinitions.filter((pricingDefinition) =>
      this.checkPricingDefinitionRestrictions(pricingDefinition)
    );
    // It does not make sense to apply several tariffs to a single consumption
    this.actualPricingDefinitions = [ actualPricingDefinitions[0] ];
  }

  public getPricingModel(): ResolvedPricingModel {
    return this.pricingModel;
  }

  public getPricingDefinitions(): ResolvedPricingDefinition[] {
    return this.actualPricingDefinitions;
  }

  public priceConsumption(): PricedConsumptionData {
    const chunkGenerator = new ConsumptionChunkGenerator(this);
    return chunkGenerator.priceConsumption();
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
      const timezone = this.pricingModel.pricerContext.timezone;
      if (!timezone) {
        // Charging station timezone is not known - 'days of the week' restrictions cannot be used in such context
        return false;
      }
      // ACHTUNG - moment.isoWeekday() - 1:MONDAY, 7: SUNDAY
      return restrictions.daysOfWeek.includes(moment(this.consumptionData.startedAt).tz(timezone).isoWeekday());
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
    const timezone = this.pricingModel.pricerContext.timezone;
    if (!timezone) {
      // Charging station timezone is not known - time restrictions cannot be used in such context
      return false;
    }
    // Normalize time range restrictions - both limits must be set!
    const timeFrom = PricingTimeLimit.parseTime(restrictions.timeFrom || '00:00');
    const timeTo = PricingTimeLimit.parseTime(restrictions.timeTo || '00:00');
    // Time of the consumption in its timezone
    const consumptionStartTime = PricingTimeLimit.parseTime(moment(this.consumptionData.startedAt).tz(timezone).format('HH:mm:ss'));
    return consumptionStartTime.isBetween(timeFrom, timeTo);
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
}
