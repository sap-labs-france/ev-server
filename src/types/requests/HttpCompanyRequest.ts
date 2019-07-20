import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpCompanyRequest extends HttpByIDRequest {
}

export interface HttpCompaniesRequest extends HttpDatabaseRequest {
  Search?: string;
  WithSites?: boolean;
  WithLogo?: boolean;
}
