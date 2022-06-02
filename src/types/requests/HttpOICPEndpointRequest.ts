import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';
import OICPEndpoint from '../oicp/OICPEndpoint';

export interface HttpOICPEndpointsGetRequest extends HttpDatabaseRequest{
  ID?: string;
  Search?: string;
}

export interface HttpOICPEndpointGetRequest extends HttpByIDRequest {
  ID: string;
}

export interface HttpOICPEndpointDeleteRequest extends HttpByIDRequest {
  ID: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface HttpOICPEndpointPingRequest extends OICPEndpoint {
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface HttpOICPEndpointCreateRequest extends OICPEndpoint {
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface HttpOICPEndpointUpdateRequest extends OICPEndpoint {
}
