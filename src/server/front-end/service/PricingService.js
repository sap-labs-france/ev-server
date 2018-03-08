const SecurityRestObjectFiltering = require('../SecurityRestObjectFiltering');
const CentralRestServerAuthorization = require('../CentralRestServerAuthorization');
const Logging = require('../../../utils/Logging');
const Utils = require('../../../utils/Utils');
const Database = require('../../../utils/Database');

class PricingService {
	static handleGetPricing(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "PricingService",
			method: "handleGetPricing",
			message: `Read Pricing`
		});
		// Check auth
		if (!CentralRestServerAuthorization.canReadPricing(req.user)) {
			// Not Authorized!
			throw new AppAuthError(
				action, CentralRestServerAuthorization.ENTITY_PRICING,
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
					SecurityRestObjectFiltering.filterPricingResponse(
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
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "PricingService",
			method: "handleUpdatePricing",
			message: `Update Pricing to '${req.body.priceKWH} ${req.body.priceUnit}'`,
			detailedMessages: req.body
		});
		// Check auth
		if (!CentralRestServerAuthorization.canUpdatePricing(req.user)) {
			// Not Authorized!
			throw new AppAuthError(
				action, CentralRestServerAuthorization.ENTITY_PRICING,
				null,
				560, "PricingService", "handleUpdatePricing",
				req.user);
		}
		// Filter
		let filteredRequest = SecurityRestObjectFiltering.filterPricingUpdateRequest(req.body, req.user);
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
