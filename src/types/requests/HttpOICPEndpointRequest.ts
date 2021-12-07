import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpOICPEndpointsRequest extends HttpDatabaseRequest{
  ID?: string;
  Search?: string;
}

export interface HttpOICPEndpointRequest extends HttpByIDRequest {
  ID: string;
}
