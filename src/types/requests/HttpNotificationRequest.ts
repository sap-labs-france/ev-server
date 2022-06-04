import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpNotificationGetRequest extends HttpDatabaseRequest {
  UserID: string;
  DateFrom: Date;
  Channel: string;
}

export interface HttpEndUserReportErrorGetRequest {
  subject: string;
  description: string;
  mobile: string;
}
