import HttpDatabaseRequest from './HttpDatabaseRequest';
import User from '../User';

export interface HttpUserRequest extends Partial<User> {
  passwords: { password?: string };
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

export interface HttpUserMobileTokenRequest {
  id: string;
  mobileToken: string;
  mobileOS: string;
}

export interface HttpSitesAssignUserRequest {
  userID: string;
  siteIDs: string[];
}

export interface HttpUsersRequest extends HttpDatabaseRequest {
  Issuer: boolean;
  WithTag?: boolean;
  Search: string;
  SiteID: string;
  Role: string;
  Status: string;
  ErrorType?: string;
  TagID?: string;
  ExcludeSiteID: string;
  ExcludeUserIDs: string;
  IncludeCarUserIDs: string;
  NotAssignedToCarID: string;
}

export interface HttpUserSitesRequest extends HttpDatabaseRequest {
  Search: string;
  UserID: string;
}

export interface HttpTagsRequest extends HttpDatabaseRequest {
  Search: string;
  UserID?: string;
  Issuer?: boolean;
}

export interface HttpLoginRequest {
  email: string;
  password: string;
  tenant: string;
  acceptEula: boolean;
}

export interface HttpResetPasswordRequest {
  email: string;
  tenant: string;
  captcha: string;
  passwords: { password: string; repeatPassword: string }; // Frontend...
  password?: string;
  repeatPassword?: string;
  hash: string;
}
export interface HttpCheckEulaRequest {
  Email: string;
  Tenant: string;
}
export interface HttpRegisterUserRequest extends HttpLoginRequest {
  name: string;
  firstName: string;
  passwords: { password: string }; // Frontend...
  captcha: string;
  status: string;
  locale: string;
}

export interface HttpVerifyEmailRequest {
  Email: string;
  Tenant: string;
  VerificationToken: string;
}

export interface HttpResendVerificationMailRequest {
  email: string;
  tenant: string;
  captcha: string;
}
