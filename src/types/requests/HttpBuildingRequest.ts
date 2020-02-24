import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export type HttpBuildingRequest = HttpByIDRequest;

export interface HttpBuildingsRequest extends HttpDatabaseRequest {
  Search?: string;
  Issuer?: boolean;
  WithSites?: boolean;
  WithLogo?: boolean;
}
