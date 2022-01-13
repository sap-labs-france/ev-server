import { AuthorizationActions } from './Authorization';
import { ConnectorType } from './ChargingStation';
import CreatedUpdatedProps from './CreatedUpdatedProps';
import Decimal from 'decimal.js';
import Utils from '../utils/Utils';

export enum PricingEntity {
  TENANT = 'Tenant',
  COMPANY = 'Company',
  SITE = 'Site',
  SITE_AREA = 'SiteArea',
  CHARGING_STATION = 'ChargingStation',
  // USER = 'User'
}

export enum DimensionType {
  FLAT_FEE = 'flatFee',
  ENERGY = 'energy',
  CHARGING_TIME = 'chargingTime',
  PARKING_TIME = 'parkingTime'
}

export interface ResolvedPricingModel {
  // Put there only the information that is to be kept with the Transaction
  pricingDefinitions: ResolvedPricingDefinition[];
  pricerContext: ConsumptionPricerContext;
}

export interface ConsumptionPricerContext {
  flatFeeAlreadyPriced: boolean,
  sessionStartDate: Date,
  lastAbsorbedConsumption?: number, // IMPORTANT - used to price E when stepSize is set!
  lastAbsorbedChargingTime?: Date // IMPORTANT - used to price CT when stepSize is set!
  lastAbsorbedParkingTime?: Date, // IMPORTANT - used to price PT when stepSize is set!
  timezone: string; // IMPORTANT - time range restrictions must consider the charging station location (and its time zone)
}

interface PricingDefinitionInternal {
  id?: string;
  entityID?: string; // id of the entity the pricing definition belongs to
  entityType?: PricingEntity; // Type of the entity this model belongs to
  name: string; // Short marketing name - e.g.: BLUE Tariff,
  description: string; // A long description to explain it, e.g.: Time-based pricing for low charging stations
  staticRestrictions?: PricingStaticRestriction;
  restrictions?: PricingRestriction;
  dimensions: PricingDimensions;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ResolvedPricingDefinition extends PricingDefinitionInternal {
}

export default interface PricingDefinition extends PricingDefinitionInternal, CreatedUpdatedProps, AuthorizationActions {
  id: string;
  entityID: string;
  entityType: PricingEntity;
  siteID: string;
}

export interface PricingDimensions {
  flatFee?: PricingDimension; // Flat fee, no unit
  energy?: PricingDimension; // Defined in kWh, step_size multiplier: 1 Wh
  chargingTime?: PricingDimension; // Time charging: defined in hours, step_size multiplier: 1 second
  parkingTime?: PricingDimension; // Time not charging: defined in hours, step_size multiplier: 1 second
}

export interface PricingDimension {
  active: boolean; // Lets the user switch OFF that price without loosing the value (if any)
  price: number; // Price per unit (excluding VAT) for this tariff dimension
  stepSize?: number; // Minimum amount to be billed. This unit will be billed in this step_size blocks. For example: if type is time and step_size is 300, then time will be billed in blocks of 5 minutes, so if 6 minutes is used, 10 minutes (2 blocks of step_size) will be billed.
  pricedData?: PricedDimensionData; // Information set dynamically while charging
}

export interface PricingStaticRestriction {
  validFrom?: Date;
  validTo?: Date;
  connectorType?: ConnectorType; // Connector types allowed to use this tariff
  connectorPowerkW?: number;
}

export interface PricingRestriction {
  daysOfWeek?: DayOfWeek[], // Which day(s) of the week this tariff is valid
  timeFrom?: string, // Valid from this time of the day
  timeTo?: string, // Valid until this time of the day
  minEnergyKWh?: number; // Minimum used energy in kWh, for example 20, valid from this amount of energy is used
  maxEnergyKWh?: number; // Maximum used energy in kWh, for example 50, valid until this amount of energy is used
  minDurationSecs?: number; // Minimum duration in seconds, valid for a duration from x seconds
  maxDurationSecs?: number; // Maximum duration in seconds, valid for a duration up to x seconds
}

export enum DayOfWeek {
  MONDAY = 1,
  TUESDAY = 2,
  WEDNESDAY = 3,
  THURSDAY = 4,
  FRIDAY = 5,
  SATURDAY = 6,
  SUNDAY = 7
}

// Interface exposed by the pricing integration layer
export interface PricedConsumption {
  amount: number;
  cumulatedAmount: number;
  roundedAmount: number;
  cumulatedRoundedAmount: number;
  currencyCode: string;
  pricingSource: PricingSource;
  pricingModel?: ResolvedPricingModel;
  pricingConsumptionData?: PricedConsumptionData;
}

export enum PricingSource {
  SIMPLE = 'simple',
  CONVERGENT_CHARGING = 'convergentCharging',
  OCPI = 'ocpi',
}

export interface PricedConsumptionData {
  flatFee?: PricedDimensionData;
  energy?: PricedDimensionData;
  parkingTime?: PricedDimensionData;
  chargingTime?: PricedDimensionData;
}

// Very important - preserve maximal precision - Decimal type is persisted as an object in the DB
export type PricingAmount = Decimal.Value;

export interface PricedDimensionData {
  unitPrice?: number;
  amountAsDecimal: PricingAmount
  amount: number;
  roundedAmount: number;
  quantity: number;
  stepSize?: number;
  // Name of the tariff this dimension belongs to - mainly for troubleshooting purposes
  sourceName?: string;
  // The item description is generated while billing the transaction
  itemDescription?: string;
  // Each dimension have a different tax rate
  taxes?: string[];
}

export class PricingTimeLimit {
  private hour: number;
  private minute: number;
  private second: number;

  constructor(hour: number, minute: number, second: number) {
    this.hour = hour;
    this.minute = minute;
    this.second = second;
  }

  static parseTime(timeAsString: string): PricingTimeLimit {
    const hour = Utils.convertToInt(timeAsString.slice(0, 2));
    const minute = Utils.convertToInt(timeAsString.slice(3, 5));
    const second = Utils.convertToInt(timeAsString.slice(6, 8));
    return new PricingTimeLimit(hour, minute, second);
  }

  isGreaterThan(aTimeLimit: PricingTimeLimit): boolean {
    if (this.hour === aTimeLimit.hour) {
      if (this.minute === aTimeLimit.minute) {
        return (this.second > aTimeLimit.second);
      }
      return (this.minute > aTimeLimit.minute);
    }
    return (this.hour > aTimeLimit.hour);
  }

  isSameOrLowerThan(aTimeLimit: PricingTimeLimit): boolean {
    return !this.isGreaterThan(aTimeLimit);
  }

  isLowerThan(aTimeLimit: PricingTimeLimit): boolean {
    if (this.hour === aTimeLimit.hour) {
      if (this.minute === aTimeLimit.minute) {
        return (this.second < aTimeLimit.second);
      }
      return (this.minute < aTimeLimit.minute);
    }
    return (this.hour < aTimeLimit.hour);
  }

  isSameOrGreaterThan(aTimeLimit: PricingTimeLimit): boolean {
    return !this.isLowerThan(aTimeLimit);
  }

  isBetween(timeFrom: PricingTimeLimit, timeTo: PricingTimeLimit): boolean {
    // Regular time range or not?
    const spanTwoDays = timeTo.isLowerThan(timeFrom);
    if (spanTwoDays) {
      // Time range spanning two days - e.g.: - Time range from 20:00 to 08:00
      return !this.isBetween(timeTo, timeFrom); // Let's check the opposite
    }
    // Regular time range - e.g.: - Time range from 08:00 to 20:00
    return this.isSameOrGreaterThan(timeFrom) && this.isLowerThan(timeTo);
  }
}
