const Constants = require('../../../utils/Constants');
const Logging = require('../../../utils/Logging');
const Database = require('../../../utils/Database');
const Utils = require('../../../utils/Utils');
const crypto = require('crypto');

let _centralRestServer;
let _db;

class PricingStorage {
	static setCentralRestServer(centralRestServer) {
		_centralRestServer = centralRestServer;
	}

	static setDatabase(db) {
		_db = db;
	}

	static async handleGetPricing() {
		// Read DB
		let pricingsMDB = await _db.collection('pricings')
			.find({})
			.limit(1)
			.toArray();
		// Set
		let pricing = null;
		if (pricingsMDB && pricingsMDB.length > 0) {
			// Set
			pricing = {};
			Database.updatePricing(pricingsMDB[0], pricing);
		}
		// Ok
		return pricing;
	}

	static async handleSavePricing(pricingToSave) {
		// Check date
		pricingToSave.timestamp = Utils.convertToDate(pricingToSave.timestamp);
		// Transfer
		let pricing = {};
		Database.updatePricing(pricingToSave, pricing, false)
		// Modify
		console.log(pricing);
	    await _db.collection('pricings').findOneAndUpdate(
			{},
			{$set: pricing},
			{upsert: true, new: true, returnOriginal: false});
	}
}

module.exports = PricingStorage;
