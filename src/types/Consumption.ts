import { ConnectorCurrentLimitSource, SiteAreaLimitSource } from './ChargingStation';

export interface AbstractCurrentConsumption {
  currentConsumptionWh?: number;
  currentTotalConsumptionWh: number;
  currentCumulatedPrice?: number;
  currentInstantWatts: number;
  currentInstantWattsL1?: number;
  currentInstantWattsL2?: number;
  currentInstantWattsL3?: number;
  currentInstantWattsDC?: number;
  currentInstantVolts?: number;
  currentInstantVoltsL1?: number;
  currentInstantVoltsL2?: number;
  currentInstantVoltsL3?: number;
  currentInstantVoltsDC?: number;
  currentInstantAmps?: number;
  currentInstantAmpsL1?: number;
  currentInstantAmpsL2?: number;
  currentInstantAmpsL3?: number;
  currentInstantAmpsDC?: number;
  currentStateOfCharge?: number;
  lastConsumption?: {
    value: number;
    timestamp: Date;
  };
}

export interface AbstractConsumption {
  instantWatts?: number;
  instantWattsL1?: number;
  instantWattsL2?: number;
  instantWattsL3?: number;
  instantWattsDC?: number;
  instantAmps?: number;
  instantAmpsL1?: number;
  instantAmpsL2?: number;
  instantAmpsL3?: number;
  instantAmpsDC?: number;
  instantVolts?: number;
  instantVoltsL1?: number;
  instantVoltsL2?: number;
  instantVoltsL3?: number;
  instantVoltsDC?: number;
  consumptionWh?: number;
  consumptionAmps?: number;
}

export default interface Consumption extends AbstractConsumption {
  id?: string;
  startedAt: Date;
  endedAt?: Date;
  transactionId?: number;
  chargeBoxID?: string;
  connectorId?: number;
  siteAreaID?: string;
  siteID?: string;
  assetID?: string;
  cumulatedConsumptionWh: number;
  cumulatedConsumptionAmps: number;
  pricingSource?: string;
  amount?: number;
  roundedAmount?: number;
  cumulatedAmount?: number;
  currencyCode?: string;
  inactivitySecs?: number;
  totalInactivitySecs?: number;
  totalDurationSecs?: number;
  stateOfCharge?: number;
  userID?: string;
  toPrice?: boolean;
  limitAmps?: number;
  limitWatts?: number;
  limitSource?: ConnectorCurrentLimitSource;
  limitSiteAreaAmps?: number;
  limitSiteAreaWatts?: number;
  limitSiteAreaSource?: SiteAreaLimitSource;
  smartChargingActive?: boolean;
}
