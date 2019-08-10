import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpTenantDeleteRequest extends HttpByIDRequest {
  forced: boolean;
}

export interface HttpTenantVerifyRequest {
  tenant: string;
}

export interface HttpTenantsRequest extends HttpDatabaseRequest {
  Search?: string;
}
