import Constants from '../../utils/Constants';
import ConvergentChargingPricing from '../pricing/convergent-charging/ConvergentChargingPricing';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import SimplePricing from '../pricing/simple-pricing/SimplePricing';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Transaction from '../../types/Transaction';
import Utils from '../../utils/Utils';

export default class PricingFactory {
  static async getPricingImpl(tenantID: string, transaction: Transaction) {
    // Get the tenant
    const tenant: Tenant = await TenantStorage.getTenant(tenantID);
    // Check if the pricing is active
    if (Utils.isTenantComponentActive(tenant, Constants.COMPONENTS.PRICING)) {
      // Get the pricing's settings
      const setting = await SettingStorage.getSettingByIdentifier(tenantID, Constants.COMPONENTS.PRICING);
      // Check
      if (setting) {
        // Check if CC
        if (setting.content['convergentCharging']) {
          // Return the CC implementation
          return new ConvergentChargingPricing(tenantID, setting.content['convergentCharging'], transaction);
        } else if (setting.content['simple']) {
          // Return the Simple Pricing implementation
          return new SimplePricing(tenantID, setting.content['simple'], transaction);
        }
      }
    }
    // Pricing is not active
    return null;
  }
}

