import Address from './Address';
import CreatedUpdatedProps from './CreatedUpdatedProps';

export default interface Asset extends CreatedUpdatedProps {
  id: string;
  name: string;
  siteAreaID: string;
  assetType: string;
  coordinates: number[];
  issuer: boolean;
  image?: string;
}
