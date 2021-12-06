import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';
import RegistrationToken from '../RegistrationToken';

export interface HttpRegistrationTokensRequest extends HttpDatabaseRequest {
  SiteAreaID: string;
}

export interface HttpRegistrationTokenRequest extends HttpByIDRequest {
  ID: string;
}

export interface HttpRegistrationTokensResponse {
  count: number;
  result: RegistrationToken[];
}

