import { HttpPricingRequest, HttpPricingsRequest } from '../../../../../types/requests/HttpPricingRequest';

import Pricing from '../../../../../types/Pricing';
import UtilsSecurity from './UtilsSecurity';
import sanitize from 'mongo-sanitize';

export default class PricingSecurity {

  public static filterPricingRequestByID(request: any): string {
    return sanitize(request.ID);
  }

  public static filterPricingRequest(request: any): HttpPricingRequest {
    return {
      ID: sanitize(request.ID)
    };
  }

  public static filterPricingsRequest(request: any): HttpPricingsRequest {
    const filteredRequest: HttpPricingsRequest = {
      Search: sanitize(request.Search),
    } as HttpPricingsRequest;
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  static filterPricingUpdateRequest(request: any): Partial<Pricing> {
    const filteredRequest = PricingSecurity._filterPricingRequest(request);
    return {
      id: sanitize(request.id),
      ...filteredRequest
    };
  }

  public static filterPricingCreateRequest(request: any): Partial<Pricing> {
    return PricingSecurity._filterPricingRequest(request);
  }

  public static _filterPricingRequest(request: any): Partial<Pricing> {
    const filteredRequest = {
      name: sanitize(request.name),
      address: UtilsSecurity.filterAddressRequest(request.address)
    } as Partial<Pricing>;
    return filteredRequest;
  }
}
