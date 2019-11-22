import HttpDatabaseRequest from './HttpDatabaseRequest';
import User from '../User';
import Tag from '../Tag';

export interface HttpUserRequest extends Partial<User> {
  passwords: {password?: string};
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
  Search: string;
  SiteID: string;
  Role: string;
  Status: string;
  ErrorType?: string;
  ExcludeSiteID: string;
}

export interface HttpUserSitesRequest extends HttpDatabaseRequest {
  Search: string;
  UserID: string;
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
  hash: string;
}
export interface HttpCheckEulaRequest {
  Email: string;
  Tenant: string;
}
export interface HttpRegisterUserRequest extends HttpLoginRequest {
  name: string;
  firstName: string;
  captcha: string;
  status: string;
  passwords: {password: string}; // Frontend...
}

export interface HttpVerifyEmailRequest {
  Email: string;
  tenant: string;
  VerificationToken: string;
}

export interface HttpResendVerificationMailRequest {
  email: string;
  tenant: string;
  captcha: string;
}
