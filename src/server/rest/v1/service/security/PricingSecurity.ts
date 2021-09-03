import { HttpPricingDefinitionRequest, HttpPricingDefinitionsRequest } from '../../../../../types/requests/HttpPricingRequest';

import PricingDefinition from '../../../../../types/Pricing';
import UtilsSecurity from './UtilsSecurity';
import sanitize from 'mongo-sanitize';

export default class PricingSecurity {

  public static filterPricingDefinitionRequestByID(request: any): string {
    return sanitize(request.ID);
  }

  public static filterPricingDefinitionRequest(request: any): HttpPricingDefinitionRequest {
    return {
      ID: sanitize(request.ID)
    };
  }

  public static filterPricingDefinitionsRequest(request: any): HttpPricingDefinitionsRequest {
    const filteredRequest: HttpPricingDefinitionsRequest = {
      Search: sanitize(request.Search),
    } as HttpPricingDefinitionsRequest;
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  static filterPricingDefinitionUpdateRequest(request: any): Partial<PricingDefinition> {
    const filteredRequest = PricingSecurity._filterPricingDefinitionRequest(request);
    return {
      id: sanitize(request.id),
      ...filteredRequest
    };
  }

  public static filterPricingDefinitionCreateRequest(request: any): Partial<PricingDefinition> {
    return PricingSecurity._filterPricingDefinitionRequest(request);
  }

  public static _filterPricingDefinitionRequest(request: any): Partial<PricingDefinition> {
    const filteredRequest = {
      entityID: sanitize(request.entityID),
      entityType: sanitize(request.entityType),
      name: sanitize(request.name),
      description: sanitize(request.description),
      // TODO - not yet sanitized properly
      restrictions: sanitize(request.restrictions),
      dimensions: sanitize(request.dimensions),
    } as Partial<PricingDefinition>;
    return filteredRequest;
  }
}
