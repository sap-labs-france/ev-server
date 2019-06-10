import Database from '../../utils/Database';
import Utils from '../../utils/Utils';
import Logging from '../../utils/Logging';
import TSGlobal from '../../types/GlobalType';
declare var global: TSGlobal;

export default class PricingStorage {

  static async getPricing(tenantID) {
    // Debug
    const uniqueTimerID = Logging.traceStart('PricingStorage', 'getPricing');
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
    // Debug
    Logging.traceEnd('PricingStorage', 'getPricing', uniqueTimerID);
    // Ok
    return pricing;
  }

  static async savePricing(tenantID, pricingToSave) {
    // Debug
    const uniqueTimerID = Logging.traceStart('PricingStorage', 'savePricing');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check date
    pricingToSave.timestamp = Utils.convertToDate(pricingToSave.timestamp);
    // Transfer
    const pricing: any = {};
    Database.updatePricing(pricingToSave, pricing, false);
    // Modify
    await global.database.getCollection(tenantID, 'pricings').findOneAndUpdate(
      {},
      { $set: pricing },
      { upsert: true, returnOriginal: false });
    // Debug
    Logging.traceEnd('PricingStorage', 'savePricing', uniqueTimerID, { pricingToSave });
  }
}
