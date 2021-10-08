import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpPricingDefinitionRequest extends HttpByIDRequest {
  ID: string;
}

export interface HttpPricingDefinitionsRequest extends HttpDatabaseRequest {
  ID?: string;
  Search?: string;
  EntityID?: string;
}
