import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpPricingModelRequest extends HttpByIDRequest {
  ID: string;
}

export interface HttpPricingModelsRequest extends HttpDatabaseRequest {
  Search?: string;
}
