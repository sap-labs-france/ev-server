import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpCompanyRequest extends HttpByIDRequest {
  ID: string;
}

export interface HttpCompaniesRequest extends HttpDatabaseRequest {
  Search?: string;
  Issuer?: boolean;
  WithSite?: boolean;
  WithLogo?: boolean;
  LocCoordinates?: number[];
  LocLongitude?: number;
  LocLatitude?: number;
  LocMaxDistanceMeters?: number;
}

export interface HttpCompanyLogoRequest extends HttpCompanyRequest {
  TenantID: string;
}
