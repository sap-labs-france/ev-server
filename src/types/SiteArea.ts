import Address from './Address';
import ChargingStation from '../types/ChargingStation';
import ConnectorStats from './ConnectorStats';
import CreatedUpdatedProps from './CreatedUpdatedProps';
import Site from '../types/Site';

export default interface SiteArea extends CreatedUpdatedProps {
  id: string;
  name: string;
  issuer: boolean;
  maximumPower: number;
  numberOfPhases: number;
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
  values: SiteAreaConsumption[];
}

export interface SiteAreaConsumption {
  date: Date;
  instantPower: number;
  instantAmps: number;
  limitWatts: number;
  limitAmps: number;
}
