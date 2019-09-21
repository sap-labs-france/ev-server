import Address from './Address';
import ChargingStation from '../types/ChargingStation';
import CreatedUpdatedProps from './CreatedUpdatedProps';
import Site from '../types/Site';
import ConnectorStats from './ConnectorStats';

export default interface SiteArea extends CreatedUpdatedProps {
  id: string;
  name: string;
  maximumPower: number;
  address: Address;
  image: string;
  siteID: string;
  site: Site;
  accessControl: boolean;
  chargingStations: ChargingStation[];
  availableChargers?: number;
  totalChargers?: number;
  availableConnectors?: number;
  totalConnectors?: number;
  connectorStats: ConnectorStats;
}
