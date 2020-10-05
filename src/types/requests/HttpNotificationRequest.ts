import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpNotificationRequest extends HttpDatabaseRequest {
  UserID: string;
  DateFrom: Date;
  Channel: string;
}

export interface HttpEndUserReportErrorRequest {
  errorTitle: string;
  errorDescription: string;
  phone: string;
}
