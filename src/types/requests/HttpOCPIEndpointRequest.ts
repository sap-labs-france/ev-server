import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpOCPIEndpointsRequest extends HttpDatabaseRequest{
  Search?: string;
}
