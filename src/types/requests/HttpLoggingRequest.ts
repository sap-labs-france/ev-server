import { LogLevel, LogType } from '../Log';

import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpLogsRequest extends HttpDatabaseRequest {
  Search?: string;
  StartDateTime: Date;
  EndDateTime: Date;
  Level: LogLevel;
  Source: string;
  Host: string;
  SortDate: string;
  Type: LogType;
  Action: string;
  UserID: string;
}
