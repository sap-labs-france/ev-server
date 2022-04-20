import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpSiteAreaRequest extends HttpByIDRequest {
  ID: string;
  WithSite?: boolean;
  WithParentSiteArea?: boolean;
  WithChargingStations?: boolean;
}

export interface HttpSiteAreasRequest extends HttpDatabaseRequest {
  Issuer: boolean;
  Search: string;
  SiteID?: string;
  ExcludeSiteAreaID?: string;
  CompanyID?: string;
  WithSite?: boolean;
  WithParentSiteArea?: boolean;
  WithChargeBoxes?: boolean;
  WithAvailableChargers: boolean;
  LocLongitude?: number;
  LocLatitude?: number;
  LocCoordinates?: number[];
  LocMaxDistanceMeters?: number;
}

export interface HttpSiteAreaConsumptionsRequest {
  SiteAreaID: string;
  StartDate: Date;
  EndDate: Date;
}

export interface HttpAssignChargingStationToSiteAreaRequest {
  siteAreaID: string;
  chargingStationIDs: string[];
}

export interface HttpSiteAreaImageRequest extends HttpByIDRequest {
  ID: string;
  TenantID: string;
}

export interface HttpAssignAssetsToSiteAreaRequest {
  siteAreaID: string;
  assetIDs: string[];
}
