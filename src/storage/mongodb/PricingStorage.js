const Database = require('../../utils/Database');
const Utils = require('../../utils/Utils');
const BackendError = require('../../exception/BackendError');

class PricingStorage {
  static async getPricing(tenantID) {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const pricingsMDB = await global.database.getCollection(tenantID, 'pricings')
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

  static async savePricing(tenantID, pricingToSave) {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check date
    pricingToSave.timestamp = Utils.convertToDate(pricingToSave.timestamp);
    // Transfer
    const pricing = {};
    Database.updatePricing(pricingToSave, pricing, false)
    // Modify
    await global.database.getCollection(tenantID, 'pricings').findOneAndUpdate(
      {},
      {$set: pricing},
      {upsert: true, new: true, returnOriginal: false});
  }
}

module.exports = PricingStorage;
