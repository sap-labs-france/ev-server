
export interface SimplePricingModel {
  timestamp: Date;
  priceUnit: string;
  pricePerKWH: SimplePricingKWH;
}

export interface SimplePricingKWH {
  pricekWh: number;
}

export interface PricedConsumption {
  amount: number;
  cumulatedAmount: number;
  roundedAmount: number;
  currencyCode: string;
  pricingSource: string;
}
