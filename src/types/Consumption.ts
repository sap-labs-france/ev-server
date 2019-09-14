
export default interface Consumption {
  id: string;
  startedAt: Date;
  endedAt: Date;
  transactionId: number;
  chargeBoxID: string;
  connectorId: number;
  siteAreaID: string;
  siteID: string;
  consumption: number;
  cumulatedAmount: number;
  cumulatedConsumption: number;
  pricingSource: string;
  amount: number;
  roundedAmount: number;
  currencyCode: string;
  instantPower: number;
  totalInactivitySecs: number;
  totalDurationSecs: number;
  stateOfCharge: number;
  userID: string;
  toPrice?: boolean;
}
