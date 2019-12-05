import Address from './Address';
import CreatedUpdatedProps from './CreatedUpdatedProps';
import Tag from './Tag';
import UserNotifications from './UserNotifications';
import { BillingUserData } from './Billing';

export default interface User extends CreatedUpdatedProps {
  id: string;
  name: string;
  firstName: string;
  email: string;
  phone?: string;
  mobile: string;
  role: string;
  status: string;
  locale: string;
  plateID?: string;
  address?: Address;
  image?: string;
  notificationsActive?: boolean;
  notifications?: UserNotifications;
  iNumber?: string;
  costCenter?: string;
  deleted: boolean;
  eulaAcceptedHash: string;
  eulaAcceptedVersion: number;
  eulaAcceptedOn: Date;
  password: string;
  passwordResetHash: string;
  passwordWrongNbrTrials: number;
  passwordBlockedUntil: Date;
  verificationToken?: string;
  verifiedAt?: Date;
  errorCode?: string;
  tags?: Tag[];
  billingData?: BillingUserData;
  mobileOs: string;
  mobileToken: string;
  mobileLastChangedOn: Date;
}

export interface UserSite {
  user: User;
  siteID: string;
  siteAdmin: boolean;
  siteOwner: boolean;
}
