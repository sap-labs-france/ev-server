import RegistrationToken from '../RegistrationToken';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpRegistrationTokenRequest {
  siteAreaID: string;
}

export interface HttpRegistrationTokensRequest extends HttpDatabaseRequest {
  siteAreaID: string;
}

export interface HttpRegistrationTokensResponse {
  count: number;
  result: RegistrationToken[];
}

