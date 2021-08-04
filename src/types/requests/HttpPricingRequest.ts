import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpPricingRequest extends HttpByIDRequest {
  ID: string;
}

export interface HttpPricingsRequest extends HttpDatabaseRequest {
  Search?: string;
}
