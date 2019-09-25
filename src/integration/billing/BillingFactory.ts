import Constants from '../../utils/Constants';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import StripeBilling from './stripe/StripeBilling';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Utils from '../../utils/Utils';

export default class BillingFactory {
  static async getBillingImpl(tenantID: string) {
    // Get the tenant
    const tenant: Tenant = await TenantStorage.getTenant(tenantID);
    // Check if billing is active
    if (Utils.isTenantComponentActive(tenant, Constants.COMPONENTS.PRICING) &&
      Utils.isTenantComponentActive(tenant, Constants.COMPONENTS.BILLING)
    ) {
      // Get the billing's settings
      const settings = await SettingStorage.getSettingByIdentifier(tenantID, Constants.COMPONENTS.BILLING);
      // Check
      if (settings) {
        const pricingSettings = await SettingStorage.getSettingByIdentifier(tenantID, Constants.COMPONENTS.PRICING);
        let currency = 'EUR';
        if (pricingSettings.content && pricingSettings.content.simple) {
          currency = pricingSettings.content.simple.currency;
        } else if (pricingSettings.content && pricingSettings.content.convergentCharging) {
          if (pricingSettings.content.convergentCharging['currency']) {
            currency = pricingSettings.content.convergentCharging['currency'];
          }
        }
        // Stripe
        if (settings.content[Constants.SETTING_BILLING_CONTENT_TYPE_STRIPE]) {
          // Return the Stripe implementation
          return new StripeBilling(tenantID,
            settings.content[Constants.SETTING_BILLING_CONTENT_TYPE_STRIPE], currency);
        }
      }
    }
    // Billing is not active
    return null;
  }
}
