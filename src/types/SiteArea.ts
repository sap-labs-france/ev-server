import ChargingStation, { Voltage } from '../types/ChargingStation';

import Address from './Address';
import ConnectorStats from './ConnectorStats';
import CreatedUpdatedProps from './CreatedUpdatedProps';
import Site from '../types/Site';

export default interface SiteArea extends CreatedUpdatedProps {
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
  accessControl: boolean;
  chargingStations: ChargingStation[];
  connectorStats: ConnectorStats;
  values: SiteAreaConsumption[];
}

export interface SiteAreaConsumption {
  date: Date;
  instantWatts: number;
  instantAmps: number;
  limitWatts: number;
  limitAmps: number;
}
