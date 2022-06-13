import PricingDefinition, { PricingEntity } from '../Pricing';

import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpPricingDefinitionGetRequest extends HttpByIDRequest {
  ID: string;
  WithEntityInformation?: boolean;
}

export interface HttpPricingDefinitionsGetRequest extends HttpDatabaseRequest {
  ID?: string;
  Search?: string;
  EntityID?: string;
  EntityType?: PricingEntity;
  WithEntityInformation?: boolean;
}

export interface HttpPricingDefinitionsDeleteRequest extends HttpByIDRequest {
  ID: string;
}

export interface HttpPricingModelResolutionGetRequest extends HttpDatabaseRequest {
  ChargingStationID: string;
  ConnectorID: number;
  UserID?: string
  StartDateTime?: Date;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface HttpPricingDefinitionCreateRequest extends PricingDefinition {
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface HttpPricingDefinitionUpdateRequest extends PricingDefinition {
}
