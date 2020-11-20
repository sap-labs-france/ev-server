import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpCompaniesRequest extends HttpDatabaseRequest {
  Search?: string;
  Issuer?: boolean;
  WithSites?: boolean;
  WithLogo?: boolean;
  LocCoordinates?: number[];
  LocMaxDistanceMeters?: number;
}

export interface HttpCompanyLogoRequest extends HttpByIDRequest {
  TenantID: string;
}
