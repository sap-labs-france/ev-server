export interface PricingModel {
  version: string;
  timestamp: Date;
  priceUnit: string;
  pricingItems: PricingItem[];
}

export interface PricingItem {
  category: PricingCategory;
  precisionPrice: number;
  calculatedPrice: number;
  calculatedRoundedPrice: number;
}

export enum PricingCategory {
  CONSUMPTION = 'consumption',
}

export interface KWHPricingItem extends PricingItem {
  pricePerKWH: number;
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

