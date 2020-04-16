import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpCompaniesRequest extends HttpDatabaseRequest {
  Search?: string;
  Issuer?: boolean;
  WithSites?: boolean;
  WithLogo?: boolean;
}
