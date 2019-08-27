import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';

export default class PricingSecurity {
  // Pricing
  static filterPricingResponse(pricing, loggedUser) {
    const filteredPricing: any = {};
    if (!pricing) {
      return null;
    }
    if (!Authorizations.isAdmin(loggedUser.role)) {
      return null;
    }
    // Set
    filteredPricing.timestamp = pricing.timestamp;
    filteredPricing.priceKWH = pricing.priceKWH;
    filteredPricing.priceUnit = pricing.priceUnit;
    // Return
    return filteredPricing;
  }

  // eslint-disable-next-line no-unused-vars
  static filterPricingUpdateRequest(request: any) {
    const filteredRequest: any = {};
    // Set
    filteredRequest.priceKWH = sanitize(request.priceKWH);
    filteredRequest.priceUnit = sanitize(request.priceUnit);
    return filteredRequest;
  }
}

