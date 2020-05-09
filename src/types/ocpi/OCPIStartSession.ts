import { OCPIToken } from './OCPIToken';

export interface OCPIStartSession {
  response_url: string;
  token: OCPIToken;
  location_id: string;
  evse_uid: string;
  authorization_id: string;
}
