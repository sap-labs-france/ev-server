import Consumption, { AbstractCurrentConsumption } from './Consumption';

import { AssetAuthorizationActions } from './Authorization';
import CreatedUpdatedProps from './CreatedUpdatedProps';
import Site from './Site';
import SiteArea from './SiteArea';

export default interface Asset extends CreatedUpdatedProps, AbstractCurrentConsumption, AssetAuthorizationActions {
  id: string;
  name: string;
  companyID: string;
  siteID?: string;
  site?: Site;
  siteAreaID: string;
  siteArea?: SiteArea;
  assetType: AssetType;
  fluctuationPercent: number;
  staticValueWatt: number;
  coordinates: number[];
  issuer: boolean;
  image?: string;
  dynamicAsset: boolean;
  usesPushAPI:boolean;
  connectionID?: string;
  meterID?: string;
  values: Consumption[],
  excludeFromSmartCharging?: boolean,
  variationThresholdPercent?: number,
  powerWattsLastSmartChargingRun?: number
}

export interface WitDataSet {
  wType: string,
  T: Date,
  V: number,
}

export enum AssetType {
  CONSUMPTION = 'CO',
  PRODUCTION = 'PR',
  CONSUMPTION_AND_PRODUCTION = 'CO-PR',
}

export enum SchneiderProperty {
  ENERGY_ACTIVE = 'Energie_Active',
  AMPERAGE_L1 = 'I1',
  AMPERAGE_L2 = 'I2',
  AMPERAGE_L3 = 'I3',
  VOLTAGE_L1 = 'L1_N',
  VOLTAGE_L2 = 'L2_N',
  VOLTAGE_L3 = 'L3_N',
  VOLTAGE = 'LN_Moy',
  POWER_ACTIVE_L1 = 'PActive_Ph1',
  POWER_ACTIVE_L2 = 'PActive_Ph2',
  POWER_ACTIVE_L3 = 'PActive_Ph3',
  POWER_ACTIVE = 'PActive_Tot',
}

export enum IothinkProperty {

  // Power
  IO_POW_ACTIVE = 'io-pow-active',
  IO_POW_L1 = 'io-pow-l1',
  IO_POW_L2 = 'io-pow-l2',
  IO_POW_L3 = 'io-pow-l3',

  // Energy
  IO_ENERGY_INPUT = 'io-energy-input',
  IO_ENERGY_L1 = 'io-energy-l1',
  IO_ENERGY_L2 = 'io-energy-l2',
  IO_ENERGY_L3 = 'io-energy-l3',

  // Battery response
  IO_ENERGY_CHARGE = 'io-energy-charge',
  IO_ENERGY_DISCHARGE = 'io-energy-discharge',
  IO_SOC = 'io-soc',
}

export interface LacroixResponse {
  userID: string;
  subscriptionRef: string
  period: string;
  groupBy: string;
  data: LacroixDataPoint[]
}

export interface LacroixDataPoint {
  date: string;
  powerApparentConsumedTotal:	number;
  powerApparentReference:	number;
  powerApparentConsumed1:	number;
  powerApparentConsumed2:	number;
  powerApparentConsumed3: number;
}

export enum LacroixPeriods {
  LAST = 'last',
  FIVE_MINUTES = '5m',
  ONE_HOUR = '1h',
  ONE_DAY = 'day',
}

export interface AssetConnectionToken {
  accessToken: string,
  tokenType?: string,
  expiresIn?: number,
  userName?: string,
  issued?: Date,
  expires: Date,
}

