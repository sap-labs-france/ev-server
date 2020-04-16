import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpSiteAreaRequest extends HttpByIDRequest {
  WithSite?: boolean;
  WithChargeBoxes?: boolean;
}

export interface HttpSiteAreasRequest extends HttpDatabaseRequest {
  Issuer: boolean;
  Search: string;
  SiteID?: string;
  WithSite?: boolean;
  WithChargeBoxes?: boolean;
  WithAvailableChargers: boolean;
}
