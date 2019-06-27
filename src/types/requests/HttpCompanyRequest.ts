import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpCompanyRequest {
  ID: string;
}

export interface HttpCompaniesRequest extends HttpDatabaseRequest {
  Search?: string;
  WithSites?: boolean;
}
