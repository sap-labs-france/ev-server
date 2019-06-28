import HttpDatabaseRequest from './HttpDatabaseRequest';
import HttpByIDRequest from './HttpByIDRequest';

export interface HttpCompanyRequest extends HttpByIDRequest {
}

export interface HttpCompaniesRequest extends HttpDatabaseRequest {
  Search?: string;
  WithSites?: boolean;
  WithLogo?: boolean;
}
