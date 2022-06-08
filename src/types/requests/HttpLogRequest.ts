import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';
import { LogLevel } from '../Log';

export interface HttpLogGetRequest extends HttpByIDRequest {
  ID: string;
}

export interface HttpLogsGetRequest extends HttpDatabaseRequest {
  Search?: string;
  StartDateTime: Date;
  EndDateTime: Date;
  Level: LogLevel;
  Source: string;
  Host: string;
  Action: string;
  UserID: string;
  SiteID: string;
  ChargingStationID: string;
}
