import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpSiteRequest extends HttpByIDRequest {
  WithCompany?: boolean;
}

export interface HttpSitesRequest extends HttpDatabaseRequest {
  Search: string;
  Issuer: boolean;
  WithAvailableChargers: boolean;
  WithCompany: boolean;
  UserID: string;
  CompanyID: string;
  SiteID: string;
  ExcludeSitesOfUserID: boolean;
  LocCoordinates?: number[];
  LocMaxDistanceMeters?: number;
}

export interface HttpSiteImageRequest extends HttpByIDRequest {
  TenantID: string;
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

