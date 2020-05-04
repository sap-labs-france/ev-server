import Address from './Address';
import ChargingStation from '../types/ChargingStation';
import CreatedUpdatedProps from './CreatedUpdatedProps';
import Site from '../types/Site';
import ConnectorStats from './ConnectorStats';

export default interface SiteArea extends CreatedUpdatedProps {
  id: string;
  name: string;
  issuer: boolean;
  maximumPower: number;
  numberOfConnectedPhases: number;
  address: Address;
  image: string;
  siteID: string;
  site: Site;
  smartCharging: boolean;
  accessControl: boolean;
  chargingStations: ChargingStation[];
  availableChargers?: number;
  totalChargers?: number;
  availableConnectors?: number;
  totalConnectors?: number;
  connectorStats: ConnectorStats;
}

export interface SiteAreaConsumption {
  siteAreaId: string;
  values: SiteAreaConsumptionValues[];
}

export interface SiteAreaConsumptionValues {
  date: Date;
  instantPower: number;
  limitWatts: number;
}
