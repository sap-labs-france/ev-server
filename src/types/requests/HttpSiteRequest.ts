import HttpDatabaseRequest from "./HttpDatabaseRequest";
import HttpByIDRequest from "./HttpByIDRequest";

export interface HttpSiteRequest extends HttpByIDRequest {
}

export interface HttpSitesRequest extends HttpDatabaseRequest {
  WithAvailableChargers: boolean;
  WithCompany: boolean;
  UserID: string;
  CompanyID: string;
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

export interface HttpSiteUsersRequest extends HttpDatabaseRequest {
  SiteID: string;
}

