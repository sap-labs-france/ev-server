import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';
import Connection from '../Connection';

export interface HttpConnectionsRequest extends HttpDatabaseRequest {
  userId?: string;
}
