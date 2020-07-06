import { ConnectorCurrentLimitSource, SiteAreaLimitSource } from './ChargingStation';

export interface AbstractConsumption {
  instantWatts: number;
  instantWattsL1: number;
  instantWattsL2: number;
  instantWattsL3: number;
  instantWattsDC: number;
  instantAmps: number;
  instantAmpsL1: number;
  instantAmpsL2: number;
  instantAmpsL3: number;
  instantAmpsDC: number;
  instantVolts: number;
  instantVoltsL1: number;
  instantVoltsL2: number;
  instantVoltsL3: number;
  instantVoltsDC: number;
  consumptionWh: number;
  consumptionAmps: number;
  lastConsumptionWh: number;
}

export default interface Consumption extends AbstractConsumption {
  id: string;
  startedAt: Date;
  endedAt: Date;
  transactionId: number;
  chargeBoxID: string;
  connectorId: number;
  siteAreaID: string;
  siteID: string;
  cumulatedAmount: number;
  cumulatedConsumptionWh: number;
  cumulatedConsumptionAmps: number;
  pricingSource: string;
  amount: number;
  roundedAmount: number;
  currencyCode: string;
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
