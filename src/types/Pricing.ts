
export interface Pricing {
  timestamp: Date;
  pricekWh: number;
  priceUnit: string;
}

export interface PricedConsumption {
  amount: number;
  cumulatedAmount: number;
  roundedAmount: number;
  currencyCode: string;
  pricingSource: string;
}
