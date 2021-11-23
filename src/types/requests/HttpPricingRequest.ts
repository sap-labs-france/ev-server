import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpPricingDefinitionRequest extends HttpByIDRequest {
  ID: string;
  WithEntityInformation?: boolean;
}

export interface HttpPricingDefinitionsRequest extends HttpDatabaseRequest {
  ID?: string;
  Search?: string;
  EntityID?: string;
  EntityType?: string;
  WithEntityInformation?: boolean;
}
