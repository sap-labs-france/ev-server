import { ConnectorCurrentLimitSource, SiteAreaLimitSource } from './ChargingStation';

export default interface Consumption {
  id: string;
  startedAt: Date;
  endedAt: Date;
  transactionId: number;
  chargeBoxID: string;
  connectorId: number;
  siteAreaID: string;
  siteID: string;
  consumptionWh: number;
  consumptionAmps: number;
  cumulatedAmount: number;
  cumulatedConsumptionWh: number;
  cumulatedConsumptionAmps: number;
  pricingSource: string;
  amount: number;
  roundedAmount: number;
  currencyCode: string;
  instantWatts: number;
  instantAmps: number;
  totalInactivitySecs: number;
  totalDurationSecs: number;
  stateOfCharge: number;
  userID: string;
  toPrice?: boolean;
  limitAmps?: number;
  limitWatts?: number;
  limitSource?: ConnectorCurrentLimitSource;
  limitSiteAreaAmps?: number;
  limitSiteAreaWatts?: number;
  limitSiteAreaSource?: SiteAreaLimitSource;
  smartChargingActive?: boolean;
}
