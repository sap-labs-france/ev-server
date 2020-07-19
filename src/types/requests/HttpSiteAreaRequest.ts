import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpSiteAreaRequest extends HttpByIDRequest {
  WithSite?: boolean;
  WithChargingStations?: boolean;
}

export interface HttpSiteAreasRequest extends HttpDatabaseRequest {
  Issuer: boolean;
  Search: string;
  SiteID?: string;
  WithSite?: boolean;
  WithChargeBoxes?: boolean;
  WithAvailableChargers: boolean;
  PosCoordinates?: number[];
  PosMaxDistanceMeters?: number;
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

export interface HttpAssignAssetsToSiteAreaRequest {
  siteAreaID: string;
  assetIDs: string[];
}
