import Address from './Address';
import { AuthorizationActions } from './Authorization';
import { BillingAccountData } from './Billing';
import CreatedUpdatedProps from './CreatedUpdatedProps';
import { OpeningTimes } from './OpeningTimes';
import Site from './Site';

export default interface Company extends CreatedUpdatedProps, AuthorizationActions {
  id: string;
  name: string;
  issuer: boolean;
  address?: Address;
  logo?: string;
  sites?: Site[];
  distanceMeters?: number;
  openingTimes?: OpeningTimes;
  accountData?: BillingAccountData;
}
