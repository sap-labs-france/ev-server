import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpTenantVerifyRequest {
  tenant: string;
}

export interface HttpTenantGetRequest extends HttpByIDRequest {
  ID: string;
}

export interface HttpTenantDeleteRequest extends HttpByIDRequest {
  ID: string;
}

export interface HttpTenantsGetRequest extends HttpDatabaseRequest {
  Search?: string;
  WithLogo?: boolean;
  WithComponents?: boolean;
}

export interface HttpTenantLogoGetRequest {
  ID?: string;
  Subdomain?: string;
}

export interface HttpVerifyTenantRequest {
  tenant?: string;
  Tenant?: string;
  Subdomain?: string;
  ID?: string;
  TenantID?: string;
}
