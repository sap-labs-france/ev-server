import ChargingStation, { Voltage } from '../types/ChargingStation';

import Address from './Address';
import ConnectorStats from './ConnectorStats';
import Consumption from './Consumption';
import CreatedUpdatedProps from './CreatedUpdatedProps';
import { OpeningTimes } from './OpeningTimes';
import Site from '../types/Site';
import { SiteAreaAuthorizationActions } from './Authorization';

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
  accessControl: boolean;
  chargingStations: ChargingStation[];
  connectorStats: ConnectorStats;
  values: Consumption[];
  distanceMeters?: number;
  openingTimes?: OpeningTimes;
}
