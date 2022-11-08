import { SiteUserAuthorizationActions, UserAuthorizationActions } from './Authorization';

import Address from './Address';
import { BillingUserData } from './Billing';
import CreatedUpdatedProps from './CreatedUpdatedProps';
import { ImportStatus } from './GlobalType';
import UserNotifications from './UserNotifications';

export default interface User extends CreatedUpdatedProps, UserAuthorizationActions {
  id: string;
  issuer: boolean;
  name: string;
  firstName: string;
  email: string;
  phone?: string;
  mobile: string;
  role: UserRole;
  status: UserStatus;
  locale: string;
  plateID?: string;
  address?: Address;
  image?: string;
  notificationsActive?: boolean;
  notifications?: UserNotifications;
  iNumber?: string;
  costCenter?: string;
  eulaAcceptedHash: string;
  eulaAcceptedVersion: number;
  eulaAcceptedOn: Date;
  password: string;
  passwordResetHash: string;
  passwordWrongNbrTrials: number;
  passwordBlockedUntil: Date;
  verificationToken?: string;
  verifiedAt?: Date;
  billingData?: BillingUserData;
  mobileData?: UserMobileData;
  startTransactionData?: StartTransactionUserData;
  authorizationID?: string;
  importedData?: {
    autoActivateUserAtImport: boolean;
  };
  technical?: boolean;
  freeAccess?: boolean;
}

export interface UserMobileData {
  mobileOS: 'ios' | 'android' | 'windows' | 'macos' | 'web';
  mobileToken: string;
  mobileBundleID: string;
  mobileAppName: string;
  mobileVersion: string;
  mobileLastChangedOn?: Date;
}

export interface StartTransactionUserData {
  lastChangedOn: Date;
  lastSelectedCarID: string;
  lastSelectedCar: boolean;
  lastCarStateOfCharge: number;
  lastCarOdometer: number;
  lastDepartureTime: Date;
  lastTargetStateOfCharge: number;
}

export interface SiteUser extends SiteUserAuthorizationActions {
  user: User;
  userID?: string;
  siteID: string;
  siteAdmin: boolean;
  siteOwner: boolean;
}

export interface ImportedUser {
  id?: string;
  name: string;
  firstName: string;
  email: string;
  importedBy?: string;
  importedOn?: Date;
  status?: ImportStatus;
  errorDescription?: string;
  importedData?: {
    autoActivateUserAtImport: boolean;
  };
  siteIDs?: string;
}

export enum UserStatus {
  PENDING = 'P',
  ACTIVE = 'A',
  INACTIVE = 'I',
  BLOCKED = 'B',
  LOCKED = 'L',
}

export enum UserRole {
  SUPER_ADMIN = 'S',
  ADMIN = 'A',
  BASIC = 'B',
  DEMO = 'D',
}

export const UserRequiredImportProperties = [
  'email',
  'firstName',
  'name'
];
