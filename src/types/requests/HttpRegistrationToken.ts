import HttpDatabaseRequest from './HttpDatabaseRequest';
import RegistrationToken from '../RegistrationToken';

export interface HttpRegistrationTokenRequest {
  siteAreaID: string;
  expirationDate: Date;
}

export interface HttpRegistrationTokensRequest extends HttpDatabaseRequest {
  siteAreaID: string;
}

export interface HttpRegistrationTokensResponse {
  count: number;
  result: RegistrationToken[];
}

