import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export type HttpCompanyRequest = HttpByIDRequest;

export interface HttpCompaniesRequest extends HttpDatabaseRequest {
  Search?: string;
  Issuer?: boolean;
  WithSites?: boolean;
  WithLogo?: boolean;
}
