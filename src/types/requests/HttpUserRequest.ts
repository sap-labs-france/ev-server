import HttpDatabaseRequest, { HttpDatabaseProjectRequest } from './HttpDatabaseRequest';

import HttpByIDRequest from './HttpByIDRequest';
import User from '../User';

export interface HttpUserGetRequest extends HttpByIDRequest {
  ID: string;
}

export interface HttpUserDeleteRequest extends HttpByIDRequest {
  ID: string;
}

export interface HttpSynchronizeUserRequest {
  id?: string;
  email?: string;
}

export interface HttpForceSynchronizeUserInvoicesRequest {
  userID?: string;
}

export interface HttpCreateTransactionInvoiceRequest {
  transactionID?: string;
}

export interface HttpUserMobileTokenUpdateRequest {
  id: string;
  mobileToken: string;
  mobileOS: 'ios' | 'android' | 'windows' | 'macos' | 'web';
  mobileBundleID: string;
  mobileAppName: string;
  mobileVersion: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface HttpUserCreateRequest extends User {
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface HttpUserUpdateRequest extends User {
}

export interface HttpUserSitesAssignRequest extends HttpDatabaseProjectRequest {
  userID: string;
  siteIDs: string[];
}

export interface HttpUsersGetRequest extends HttpDatabaseRequest {
  Issuer: boolean;
  WithTag?: boolean;
  Search: string;
  SiteID: string;
  UserID: string;
  Role: string;
  Status: string;
  Technical?: boolean;
  FreeAccess?: boolean;
  ErrorType?: string;
  VisualTagID?: string;
  ExcludeSiteID: string;
  NotAssignedToCarID: string;
}

export interface HttpUsersInErrorGetRequest extends HttpDatabaseRequest {
  Search: string;
  Role?: string;
  ErrorType?: string;
}

export interface HttpUserSitesGetRequest extends HttpDatabaseRequest {
  Search: string;
  UserID: string;
}

export interface HttpLoginRequest {
  email: string;
  password: string;
  acceptEula: boolean;
}

export interface HttpResetPasswordRequest {
  email: string;
  captcha: string;
  password: string;
  hash: string;
}
export interface HttpCheckEulaRequest {
  Email: string;
}
export interface HttpRegisterUserRequest extends HttpLoginRequest {
  name: string;
  firstName: string;
  password: string;
  captcha: string;
  status: string;
  locale: string;
  mobile: string;
}

export interface HttpVerifyEmailRequest {
  Email: string;
  VerificationToken: string;
}

export interface HttpResendVerificationMailRequest {
  email: string;
  captcha: string;
}

export interface HttpEulaRequest {
  Language: string;
}

export interface HttpUserDefaultTagCarGetRequest {
  UserID: string;
  ChargingStationID?: string; // TODO: Backward-compatibility issue - This should be mandatory! - change it as soon as possible
}

export interface HttpUserSessionContextGetRequest {
  UserID: string;
  ChargingStationID: string;
  ConnectorID: number;
}
