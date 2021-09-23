import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpOCPIEndpointsRequest extends HttpDatabaseRequest{
  ID?: string;
  Search?: string;
}

export interface HttpOCPIEndpointByIdRequest {
  id: string;
}

export interface HttpOCPIEndpointGenerateLocalTokenRequest extends HttpOCPIEndpointByIdRequest {
  name: string;
}

export interface HttpOCPIEndpointRequest extends HttpByIDRequest {
  ID: string;
}
