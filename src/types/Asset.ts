import Consumption, { AbstractCurrentConsumption } from './Consumption';

import CreatedUpdatedProps from './CreatedUpdatedProps';
import SiteArea from './SiteArea';

export default interface Asset extends CreatedUpdatedProps, AbstractCurrentConsumption {
  id: string;
  name: string;
  siteAreaID: string;
  siteArea?: SiteArea;
  assetType: string;
  coordinates: number[];
  issuer: boolean;
  image?: string;
  dynamicAsset: boolean;
  connectionID?: string;
  meterID?: string;
  values: Consumption[],
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
