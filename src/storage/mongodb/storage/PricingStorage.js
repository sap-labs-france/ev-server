const Logging = require('../../../utils/Logging');
const Database = require('../../../utils/Database');
const MDBPricing = require('../model/MDBPricing');
const crypto = require('crypto');

let _centralRestServer;

class PricingStorage {
	static setCentralRestServer(centralRestServer) {
		_centralRestServer = centralRestServer;
	}

	static handleGetPricing() {
		// Exec request
		return MDBPricing.findOne({}).then((pricingMDB) => {
			var pricing;
			if (pricingMDB) {
				// Set
				pricing = {};
				Database.updatePricing(pricingMDB, pricing);
			}
			// Ok
			return pricing;
		});
	}

	static handleSavePricing(pricing) {
		// Get
		return MDBPricing.findOneAndUpdate({}, pricing, {
				new: true,
				upsert: true
			}).then((pricingMDB) => {
				return pricingMDB;
		});
	}
}

module.exports = PricingStorage;
