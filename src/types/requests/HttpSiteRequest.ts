import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpSiteRequest extends HttpByIDRequest {
}

export interface HttpSitesRequest extends HttpDatabaseRequest {
  WithAvailableChargers: boolean;
  WithCompany: boolean;
  UserID: string;
  CompanyID: string;
  SiteID: string;
  ExcludeSitesOfUserID: boolean;
  Search: string;
}

export interface HttpSiteAssignUsersRequest {
  siteID: string;
  userIDs: string[];
  role: string;
}

export interface HttpSiteUserAdminRequest {
  userID: string;
  siteID: string;
  siteAdmin: boolean;
}

export interface HttpSiteOwnerRequest {
  userID: string;
  siteID: string;
  siteOwner: boolean;
}

export interface HttpSiteUsersRequest extends HttpDatabaseRequest {
  Search: string;
  SiteID: string;
}

