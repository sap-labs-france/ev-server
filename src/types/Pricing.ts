import { AuthorizationActions } from './Authorization';
import CreatedUpdatedProps from './CreatedUpdatedProps';

export default interface PricingModel extends CreatedUpdatedProps, AuthorizationActions {
  id: string;
  contextID: string; // id of the entity the pricing definition belongs to!
  pricingDefinitions: PricingDefinition[];
}

export interface ResolvedPricingModel {
  // Put there only the information that is to be kept with the Transaction
  pricingDefinitions: PricingDefinition[];
}

export interface PricingDefinition {
  name: string, // Short marketing name - e.g.: BLUE Tariff,
  description: string, // A long description to explain it, e.g.: Time-based pricing for low charging stations
  restrictions?: PricingRestriction; // To be clarified! - These restrictions are so far common to all dimensions
  dimensions: {
    flatFee?: PricingDimension, // Flat fee, no unit
    energy?: PricingDimension, // Defined in kWh, step_size multiplier: 1 Wh
    chargingTime?: PricingDimension, // Time charging: defined in hours, step_size multiplier: 1 second
    parkingTime?: PricingDimension, // Time not charging: defined in hours, step_size multiplier: 1 second
  }
}

export interface PricingDimension {
  active: boolean, // Lets the user switch OFF that price without loosing the value (if any)
  price: number, // Price per unit (excluding VAT) for this tariff dimension
  stepSize?: number, // Minimum amount to be billed. This unit will be billed in this step_size blocks. For example: if type is time and step_size is 300, then time will be billed in blocks of 5 minutes, so if 6 minutes is used, 10 minutes (2 blocks of step_size) will be billed.
}

export interface PricingRestriction {
  startTime?: string, // Start time of day, for example 13:30, valid from this time of the day. Must be in 24h format with leading zeros. Hour/Minute se
  endTime?: string, // End time of day, for example 19:45, valid until this time of the day. Same syntax as start_time
  startDate?: string, // Start date, for example: 2015-12-24, valid from this day
  endDate?: string, // End date, for example: 2015-12-27, valid until this day (excluding this day)
  minKWh?: number, // Minimum used energy in kWh, for example 20, valid from this amount of energy is used
  maxKWh?: number, // Maximum used energy in kWh, for example 50, valid until this amount of energy is used
  minPowerkW?: number, // Minimum power in kW, for example 0, valid from this charging speed
  maxPowerkW?: number, // Maximum power in kW, for example 20, valid up to this charging speed
  minDurationSecs?: number, // Minimum duration in seconds, valid for a duration from x seconds
  maxDurationSecs?: number, // Maximum duration in seconds, valid for a duration up to x seconds
  daysOfWeek?: DayOfWeek[], // Which day(s) of the week this tariff is valid
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
  currencyCode: string;
  pricingSource: PricingSource;
  pricingModel?: ResolvedPricingModel
  pricingConsumptionData?: PricingConsumptionData
}

export enum PricingSource {
  SIMPLE = 'simple',
  CONVERGENT_CHARGING = 'convergentCharging',
  OCPI = 'ocpi',
}

export interface PricingConsumptionData {
  flatFee?: PricingDimensionData,
  energy?: PricingDimensionData,
  parkingTime?: PricingDimensionData,
  chargingTime?: PricingDimensionData,
}

export interface PricingDimensionData {
  amount: number;
  quantity: number;
  // The item description is generated while billing the transaction
  itemDescription?: string,
  // Each dimension have a different tax rate
  taxes?: string[];
}

