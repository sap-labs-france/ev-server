import Connection from '../Connection';
import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpConnectionsRequest extends HttpDatabaseRequest {
  userId?: string;
}
