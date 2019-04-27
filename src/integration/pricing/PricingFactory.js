const Constants = require('../../utils/Constants');
const SettingStorage = require('../../storage/mongodb/SettingStorage');
const ConvergentChargingPricing = require("../pricing/convergent-charging/ConvergentChargingPricing");
const SimplePricing = require("../pricing/simple-pricing/SimplePricing");

class PricingFactory {
  static async getPricingImpl(transaction) {
    // Get the tenant
    const tenant = await transaction.getTenant();
    // Check if the pricing is active
    if (tenant.isComponentActive(Constants.COMPONENTS.PRICING)) {
      // Get the pricing's settings
      const setting = await SettingStorage.getSettingByIdentifier(transaction.getTenantID(), Constants.COMPONENTS.PRICING);
      // Check
      if (setting) {
        // Check if CC
        if (setting.getContent()['convergentCharging']) {
          // Return the CC implementation
          return new ConvergentChargingPricing(transaction.getTenantID(), setting.getContent()['convergentCharging'], transaction);
        } else if (setting.getContent()['simple']) {
          // Return the Simple Pricing implementation
          return new SimplePricing(transaction.getTenantID(), setting.getContent()['simple'], transaction);
        }
      }
    }
    // Pricing is not active
    return null;
  }
}

module.exports = PricingFactory;