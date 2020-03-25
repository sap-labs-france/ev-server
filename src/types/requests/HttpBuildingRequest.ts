import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpBuildingRequest extends HttpByIDRequest {
  WithSiteArea?: boolean;
}

export interface HttpBuildingsRequest extends HttpDatabaseRequest {
  Search?: string;
  SiteAreaID?: string;
  WithSiteArea?: boolean;
  WithNoSiteArea?: boolean;
}

export interface HttpAssignBuildingsToSiteAreaRequest {
  siteAreaID: string;
  buildingIDs: string[];
}
