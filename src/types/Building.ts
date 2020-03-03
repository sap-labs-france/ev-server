import Address from './Address';
import CreatedUpdatedProps from './CreatedUpdatedProps';
import Site from './Site';

export default interface Building extends CreatedUpdatedProps {
  id: string;
  name: string;
  issuer: boolean;
  address?: Address;
  image?: string;
}
