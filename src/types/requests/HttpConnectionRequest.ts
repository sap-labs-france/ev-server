import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpConnectionsRequest extends HttpDatabaseRequest {
  UserID?: string;
}

export interface HttpConnectionRequest extends HttpDatabaseRequest {
  ID?: string;
}
