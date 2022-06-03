import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpConnectionsGetRequest extends HttpDatabaseRequest {
  UserID?: string;
}

export interface HttpConnectionGetRequest extends HttpByIDRequest {
  ID: string;
}

export interface HttpConnectionDeleteRequest extends HttpByIDRequest {
  ID: string;
}
