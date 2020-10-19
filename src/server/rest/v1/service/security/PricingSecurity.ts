import Authorizations from '../../../../../authorization/Authorizations';
import { Pricing } from '../../../../../types/Pricing';
import UserToken from '../../../../../types/UserToken';
import sanitize from 'mongo-sanitize';

export default class PricingSecurity {
  // Pricing
  static filterPricingResponse(pricing: Pricing, loggedUser: UserToken): Pricing {
    const filteredPricing: Pricing = {} as Pricing;
    if (!pricing) {
      return null;
    }
    if (!Authorizations.isAdmin(loggedUser)) {
      return null;
    }
    // Set
    filteredPricing.timestamp = pricing.timestamp;
    filteredPricing.pricekWh = pricing.pricekWh;
    filteredPricing.priceUnit = pricing.priceUnit;
    // Return
    return filteredPricing;
  }

  static filterPricingUpdateRequest(request: any): Pricing {
    const filteredRequest: Pricing = {} as Pricing;
    // Set
    filteredRequest.pricekWh = sanitize(request.pricekWh);
    filteredRequest.priceUnit = sanitize(request.priceUnit);
    return filteredRequest;
  }
}

