
export class PricedConsumption {
  constructor(
    readonly amount: number,
    readonly cumulatedAmount: number,
    readonly roundedAmount: number,
    readonly currencyCode: string,
    readonly pricingSource: string) {}
}
