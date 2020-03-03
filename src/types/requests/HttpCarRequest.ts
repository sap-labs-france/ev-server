import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export type HttpCarRequest = HttpByIDRequest;

export interface HttpCarsRequest extends HttpDatabaseRequest {
  Search?: string;
}
