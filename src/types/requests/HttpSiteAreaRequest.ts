import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';
import SiteArea from '../SiteArea';

export interface HttpSiteAreaGetRequest extends HttpByIDRequest {
  ID: string;
  WithSite?: boolean;
  WithParentSiteArea?: boolean;
  WithChargingStations?: boolean;
}

export interface HttpSiteAreaDeleteRequest extends HttpByIDRequest {
  ID: string;
}

export interface HttpSiteAreasGetRequest extends HttpDatabaseRequest {
  Issuer: boolean;
  Search: string;
  SiteID?: string;
  ExcludeSiteAreaID?: string;
  CompanyID?: string;
  WithSite?: boolean;
  WithParentSiteArea?: boolean;
  WithChargingStations?: boolean;
  WithAvailableChargers: boolean;
  LocLongitude?: number;
  LocLatitude?: number;
  LocCoordinates?: number[];
  LocMaxDistanceMeters?: number;
}

export interface HttpSiteAreaConsumptionsGetRequest {
  SiteAreaID: string;
  StartDate: Date;
  EndDate: Date;
}

export interface HttpAssignChargingStationToSiteAreaRequest {
  siteAreaID: string;
  chargingStationIDs: string[];
}

export interface HttpSiteAreaImageGetRequest extends HttpByIDRequest {
  ID: string;
}

export interface HttpAssignAssetsToSiteAreaRequest {
  siteAreaID: string;
  assetIDs: string[];
}

export interface HttpSiteAreaUpdateRequest extends SiteArea {
  subSiteAreasAction?: string;
}

export interface HttpSiteAreaCreateRequest extends SiteArea {
  subSiteAreasAction?: string;
}
