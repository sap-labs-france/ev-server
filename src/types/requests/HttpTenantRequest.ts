import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpTenantVerifyRequest {
  tenant: string;
}

export interface HttpTenantsRequest extends HttpDatabaseRequest {
  Search?: string;
}
