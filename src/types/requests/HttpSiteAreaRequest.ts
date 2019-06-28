import HttpDatabaseRequest from './HttpDatabaseRequest';
import HttpByIDRequest from './HttpByIDRequest';

export interface HttpSiteAreaRequest extends HttpByIDRequest {
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
