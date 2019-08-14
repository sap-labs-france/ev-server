import Constants from '../../utils/Constants';
import ConvergentChargingPricing from '../pricing/convergent-charging/ConvergentChargingPricing';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import SimplePricing from '../pricing/simple-pricing/SimplePricing';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';

export default class PricingFactory {
  static async getPricingImpl(transaction) {
    // Get the tenant
    const tenant: Tenant = await transaction.getTenant();
    // Check if the pricing is active
    if (Utils.isTenantComponentActive(tenant, Constants.COMPONENTS.PRICING)) {
      // Get the pricing's settings
      const setting = await SettingStorage.getSettingByIdentifier(transaction.getTenantID(), Constants.COMPONENTS.PRICING);
      // Check
      if (setting) {
        // Check if CC
        if (setting.content[Constants.SETTING_PRICING_CONTENT_TYPE_CONVERGENT_CHARGING]) {
          // Return the CC implementation
          return new ConvergentChargingPricing(transaction.getTenantID(),
            setting.content[Constants.SETTING_PRICING_CONTENT_TYPE_CONVERGENT_CHARGING], transaction);
        } else if (setting.content[Constants.SETTING_PRICING_CONTENT_TYPE_SIMPLE]) {
          // Return the Simple Pricing implementation
          return new SimplePricing(transaction.getTenantID(), setting.content[Constants.SETTING_PRICING_CONTENT_TYPE_SIMPLE], transaction);
        }
      }
    }
    // Pricing is not active
    return null;
  }
}

