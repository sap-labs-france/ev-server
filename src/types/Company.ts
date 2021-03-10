import Address from './Address';
import { AuthorizationActions } from './Authorization';
import CreatedUpdatedProps from './CreatedUpdatedProps';
import Site from './Site';

export default interface Company extends CreatedUpdatedProps, AuthorizationActions {
  id: string;
  name: string;
  issuer: boolean;
  address?: Address;
  logo?: string;
  sites?: Site[];
  distanceMeters?: number;
}
