import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';
import OCPIEndpoint from '../ocpi/OCPIEndpoint';

export interface HttpOCPIEndpointsGetRequest extends HttpDatabaseRequest {
  ID?: string;
  Search?: string;
}

export interface HttpOCPIEndpointCommandRequest {
  id: string;
}

export interface HttpOCPIEndpointGetRequest extends HttpByIDRequest {
  ID: string;
}

export interface HttpOCPIEndpointDeleteRequest extends HttpByIDRequest {
  ID: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface HttpOCPIEndpointUpdateRequest extends OCPIEndpoint {
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface HttpOCPIEndpointCreateRequest extends OCPIEndpoint {
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface HttpOCPIEndpointPingRequest extends OCPIEndpoint {
}
