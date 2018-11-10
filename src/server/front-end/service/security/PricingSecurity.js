const sanitize = require('mongo-sanitize');
const Authorizations = require('../../../../authorization/Authorizations');

class PricingSecurity {
	// Pricing
	static filterPricingResponse(pricing, loggedUser) {
		const filteredPricing = {};
		if (!pricing) {
			return null;
		}
		if (!Authorizations.isAdmin(loggedUser)) {
			return null;
		}
		// Set
		filteredPricing.timestamp = pricing.timestamp;
		filteredPricing.priceKWH = pricing.priceKWH;
		filteredPricing.priceUnit = pricing.priceUnit;
		// Return
		return filteredPricing;
	}

	static filterPricingUpdateRequest(request, loggedUser) {
		const filteredRequest = {};
		// Set
		filteredRequest.priceKWH = sanitize(request.priceKWH);
		filteredRequest.priceUnit = sanitize(request.priceUnit);
		return filteredRequest;
	}
}

module.exports = PricingSecurity;
