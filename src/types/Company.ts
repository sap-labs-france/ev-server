import Address from './Address';
import CreatedUpdatedProps from './CreatedUpdatedProps';
import Site from './Site';

export default interface Company extends CreatedUpdatedProps {
  id: string;
  name: string;
  address: Address;
  logo?: string;
  sites?: Site[];
}
