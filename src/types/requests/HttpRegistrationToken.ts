import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpRegistrationTokensGetRequest extends HttpDatabaseRequest {
  Search: string;
  SiteAreaID: string;
}

export interface HttpRegistrationTokenGetRequest extends HttpByIDRequest {
  ID: string;
}

export interface HttpRegistrationTokenRevokeRequest extends HttpByIDRequest {
  ID: string;
}
