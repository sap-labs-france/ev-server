import { HttpPricingModelRequest, HttpPricingModelsRequest } from '../../../../../types/requests/HttpPricingRequest';

import PricingModel from '../../../../../types/Pricing';
import UtilsSecurity from './UtilsSecurity';
import sanitize from 'mongo-sanitize';

export default class PricingSecurity {

  public static filterPricingModelRequestByID(request: any): string {
    return sanitize(request.ID);
  }

  public static filterPricingRequest(request: any): HttpPricingModelRequest {
    return {
      ID: sanitize(request.ID)
    };
  }

  public static filterPricingModelsRequest(request: any): HttpPricingModelsRequest {
    const filteredRequest: HttpPricingModelsRequest = {
      Search: sanitize(request.Search),
    } as HttpPricingModelsRequest;
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  static filterPricingModelUpdateRequest(request: any): Partial<PricingModel> {
    const filteredRequest = PricingSecurity._filterPricingModelRequest(request);
    return {
      id: sanitize(request.id),
      ...filteredRequest
    };
  }

  public static filterPricingModelCreateRequest(request: any): Partial<PricingModel> {
    return PricingSecurity._filterPricingModelRequest(request);
  }

  public static _filterPricingModelRequest(request: any): Partial<PricingModel> {
    const filteredRequest = {
      name: sanitize(request.name),
      address: UtilsSecurity.filterAddressRequest(request.address)
    } as Partial<PricingModel>;
    return filteredRequest;
  }
}
