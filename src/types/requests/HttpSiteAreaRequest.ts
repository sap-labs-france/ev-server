import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpSiteAreaRequest {
  ID: string;
  WithSite?: boolean;
  WithChargeBoxes?: boolean;
}

export interface HttpSiteAreasRequest extends HttpDatabaseRequest {
  Search: string;
  SiteID?: string;
  WithSite?: boolean;
  WithChargeBoxes?: boolean;
  WithAvailableChargers: boolean;
}
