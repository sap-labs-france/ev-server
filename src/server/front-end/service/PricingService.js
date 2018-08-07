const Authorizations = require('../../../authorization/Authorizations');
const Logging = require('../../../utils/Logging');
const Database = require('../../../utils/Database');
const PricingSecurity = require('./security/PricingSecurity');

class PricingService {
	static handleGetPricing(action, req, res, next) {
		// Check auth
		if (!Authorizations.canReadPricing(req.user)) {
			// Not Authorized!
			throw new AppAuthError(
				action, Constants.ENTITY_PRICING,
				null,
				560, "PricingService", "handleGetPricing",
				req.user);
		}
		// Get the Pricing
		global.storage.getPricing().then((pricing) => {
			// Return
			if (pricing) {
				res.json(
					// Filter
					PricingSecurity.filterPricingResponse(
						pricing, req.user)
				);
			} else {
				res.json({});
			}
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleUpdatePricing(action, req, res, next) {
		// Check auth
		if (!Authorizations.canUpdatePricing(req.user)) {
			// Not Authorized!
			throw new AppAuthError(
				action, Constants.ENTITY_PRICING,
				null,
				560, "PricingService", "handleUpdatePricing",
				req.user);
		}
		// Filter
		let filteredRequest = PricingSecurity.filterPricingUpdateRequest(req.body, req.user);
		// Check
		if (!filteredRequest.priceKWH || isNaN(filteredRequest.priceKWH)) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The price ${filteredRequest.priceKWH} has not a correct format`), req, res, next);
			return;
		}
		// Update
		let pricing = {};
		Database.updatePricing(filteredRequest, pricing);
		// Set timestamp
		pricing.timestamp = new Date();
		// Get
		global.storage.savePricing(pricing).then((pricingMDB) => {
			Logging.logSecurityInfo({
				user: req.user, action: action,
				module: "PricingService",
				method: "handleUpdatePricing",
				message: `Pricing has been updated to '${req.body.priceKWH} ${req.body.priceUnit}'`,
				detailedMessages: req.body
			});
			// Ok
			res.json({status: `Success`});
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}
}

module.exports = PricingService;
