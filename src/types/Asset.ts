import Address from './Address';
import CreatedUpdatedProps from './CreatedUpdatedProps';

export default interface Asset extends CreatedUpdatedProps {
  id: string;
  name: string;
  siteAreaID: string;
  issuer: boolean;
  address?: Address;
  image?: string;
}
