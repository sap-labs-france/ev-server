export interface PricingModel {
  id: string;
  description: string;
  currency: string;
  timestamp: Date;
  pricings: Pricing[];
}

export interface Pricing {
  components: PricingComponent[];
  restrictions?: PricingRestriction;
}

export interface PricingComponent {
  type: PricingDimensionType, // Type of dimension
  price: number, // Price per unit (excluding VAT) for this tariff dimension
  stepSize: number, // Minimum amount to be billed. This unit will be billed in this step_size blocks. For example: if type is time and step_size is 300, then time will be billed in blocks of 5 minutes, so if 6 minutes is used, 10 minutes (2 blocks of step_size) will be billed.
}

export interface PricingRestriction {
  startTime?: string, // Start time of day, for example 13:30, valid from this time of the day. Must be in 24h format with leading zeros. Hour/Minute se
  endTime?: string, // End time of day, for example 19:45, valid until this time of the day. Same syntax as start_time
  startDate?: string, // Start date, for example: 2015-12-24, valid from this day
  endDate?: string, // End date, for example: 2015-12-27, valid until this day (excluding this day)
  minKWh?: number, // Minimum used energy in kWh, for example 20, valid from this amount of energy is used
  maxKWh?: number, // Maximum used energy in kWh, for example 50, valid until this amount of energy is used
  minPowerkW: number, // Minimum power in kW, for example 0, valid from this charging speed
  maxPowerkW: number, // Maximum power in kW, for example 20, valid up to this charging speed
  minDurationSecs: number, // Minimum duration in seconds, valid for a duration from x seconds
  maxDurationSecs: number, // Maximum duration in seconds, valid for a duration up to x seconds
  daysOfWeek: DayOfWeek[], // Which day(s) of the week this tariff is valid
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

export enum PricingDimensionType {
  ENERGY = 'E', // Defined in kWh, step_size multiplier: 1 Wh
  FLAT = 'F', // Flat fee, no unit
  PARKING_TIME = 'PT', // Time not charging: defined in hours, step_size multiplier: 1 second
  TIME = 'T', // Time charging: defined in hours, step_size multiplier: 1 second
}

export interface PricedConsumption {
  amount: number;
  cumulatedAmount: number;
  roundedAmount: number;
  currencyCode: string;
  pricingSource: PricingSource;
}

export enum PricingSource {
  SIMPLE = 'simple',
  CONVERGENT_CHARGING = 'convergentCharging',
  OCPI = 'ocpi',
}
