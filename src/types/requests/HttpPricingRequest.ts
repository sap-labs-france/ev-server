import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpPricingDefinitionRequest extends HttpByIDRequest {
  ID: string;
}

export interface HttpPricingDefinitionsRequest extends HttpDatabaseRequest {
  Search?: string;
}
