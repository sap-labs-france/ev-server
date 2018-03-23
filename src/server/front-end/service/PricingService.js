const sanitize = require('mongo-sanitize');
const CentralRestServerAuthorization = require('../CentralRestServerAuthorization');
const Logging = require('../../../utils/Logging');
const Utils = require('../../../utils/Utils');
const Database = require('../../../utils/Database');
const UtilsSecurity = require('./UtilsService').UtilsSecurity;

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

class PricingSecurity {
	// Pricing
	static filterPricingResponse(pricing, loggedUser) {
		let filteredPricing = {};
		if (!pricing) {
			return null;
		}
		if (!CentralRestServerAuthorization.isAdmin(loggedUser)) {
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
		let filteredRequest = {};
		// Set
		filteredRequest.priceKWH = sanitize(request.priceKWH);
		filteredRequest.priceUnit = sanitize(request.priceUnit);
		return filteredRequest;
	}
}

module.exports = {
	"PricingService": PricingService,
	"PricingSecurity": PricingSecurity
};
