import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';
import { PricingEntity } from '../Pricing';

export interface HttpPricingDefinitionRequest extends HttpByIDRequest {
  ID: string;
  WithEntityInformation?: boolean;
}

export interface HttpPricingDefinitionsRequest extends HttpDatabaseRequest {
  ID?: string;
  Search?: string;
  EntityID?: string;
  EntityType?: PricingEntity;
  WithEntityInformation?: boolean;
}
