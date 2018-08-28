const Database = require('../../utils/Database');
const Utils = require('../../utils/Utils');

class PricingStorage {
	static async getPricing() {
		// Read DB
		let pricingsMDB = await global.db.collection('pricings')
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

	static async savePricing(pricingToSave) {
		// Check date
		pricingToSave.timestamp = Utils.convertToDate(pricingToSave.timestamp);
		// Transfer
		let pricing = {};
		Database.updatePricing(pricingToSave, pricing, false)
		// Modify
	    await global.db.collection('pricings').findOneAndUpdate(
			{},
			{$set: pricing},
			{upsert: true, new: true, returnOriginal: false});
	}
}

module.exports = PricingStorage;
