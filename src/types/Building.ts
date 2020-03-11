import Address from './Address';
import CreatedUpdatedProps from './CreatedUpdatedProps';

export default interface Building extends CreatedUpdatedProps {
  id: string;
  name: string;
  siteAreaID: string;
  issuer: boolean;
  address?: Address;
  image?: string;
}
