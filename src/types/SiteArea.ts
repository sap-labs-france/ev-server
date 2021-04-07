import ChargingStation, { Voltage } from '../types/ChargingStation';

import Address from './Address';
import { AuthorizationActions } from './Authorization';
import ConnectorStats from './ConnectorStats';
import Consumption from './Consumption';
import CreatedUpdatedProps from './CreatedUpdatedProps';
import Site from '../types/Site';

export default interface SiteArea extends CreatedUpdatedProps, AuthorizationActions {
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
  values: Consumption[];
  distanceMeters?: number;
}
