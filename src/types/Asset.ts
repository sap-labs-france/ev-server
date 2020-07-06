import CreatedUpdatedProps from './CreatedUpdatedProps';
import SiteArea from './SiteArea';
import { AbstractConsumption } from './Consumption';

export default interface Asset extends CreatedUpdatedProps {
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
  consumption?: AbstractConsumption;
}
