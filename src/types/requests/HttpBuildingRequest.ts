import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpBuildingRequest extends HttpByIDRequest {
  WithSiteArea?: boolean;
}

export interface HttpBuildingsRequest extends HttpDatabaseRequest {
  Search?: string;
  WithSiteArea?: boolean;
}
