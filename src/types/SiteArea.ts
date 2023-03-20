import ChargingStation, { Voltage } from '../types/ChargingStation';

import Address from './Address';
import Asset from './Asset';
import ConnectorStats from './ConnectorStats';
import Consumption from './Consumption';
import CreatedUpdatedProps from './CreatedUpdatedProps';
import { OCPILocation } from './ocpi/OCPILocation';
import { OpeningTimes } from './OpeningTimes';
import Site from '../types/Site';
import { SiteAreaAuthorizationActions } from './Authorization';
import { SmartChargingSessionParameters } from './Transaction';

export enum SiteAreaValueTypes {
  ASSET_CONSUMPTIONS = 'AssetConsumptions',
  ASSET_CONSUMPTION_WATTS = 'AssetConsumptionWatts',
  ASSET_CONSUMPTION_AMPS = 'AssetConsumptionAmps',
  ASSET_PRODUCTIONS = 'AssetProductions',
  ASSET_PRODUCTION_WATTS = 'AssetProductionWatts',
  ASSET_PRODUCTION_AMPS = 'AssetProductionAmps',
  CHARGING_STATION_CONSUMPTIONS = 'ChargingStationConsumptions',
  CHARGING_STATION_CONSUMPTION_WATTS = 'ChargingStationConsumptionWatts',
  CHARGING_STATION_CONSUMPTION_AMPS = 'ChargingStationConsumptionAmps',
  NET_CONSUMPTIONS = 'NetConsumptions',
  NET_CONSUMPTION_WATTS = 'NetConsumptionWatts',
  NET_CONSUMPTION_AMPS = 'NetConsumptionAmps',
}

export default interface SiteArea extends CreatedUpdatedProps, SiteAreaAuthorizationActions {
  id: string;
  name: string;
  issuer: boolean;
  maximumPower: number;
  voltage: Voltage;
  numberOfPhases: number;
  address: Address;
  image: string;
  siteID: string;
  site: Site;
  smartCharging: boolean;
  smartChargingSessionParameters?: SmartChargingSessionParameters;
  accessControl: boolean;
  chargingStations: ChargingStation[];
  assets: Asset[];
  connectorStats: ConnectorStats;
  values: Consumption[];
  parentSiteAreaID?: string;
  parentSiteArea?: SiteArea;
  childSiteAreas?: SiteArea[];
  distanceMeters?: number;
  openingTimes?: OpeningTimes;
  tariffID?: string;
  ocpiData?: SiteAreaOcpiData;
}

export interface SiteAreaOcpiData {
  location: OCPILocation;
}

export enum SubSiteAreaAction {
  UPDATE = 'update',
  ATTACH = 'attach',
  CLEAR = 'clear',
  FORCE_SMART_CHARGING = 'force_smart_charging',
}
