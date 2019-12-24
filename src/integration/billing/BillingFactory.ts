import Billing from './Billing';
import { BillingSetting } from '../../types/Setting';
import Constants from '../../utils/Constants';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import StripeBilling from './stripe/StripeBilling';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Utils from '../../utils/Utils';

export default class BillingFactory {
  static async getBillingImpl(tenantID: string): Promise<Billing<BillingSetting>> {
    // Prevent default user from generating billing
    if (tenantID === Constants.DEFAULT_TENANT) {
      return null;
    }
    // Get the tenant
    const tenant: Tenant = await TenantStorage.getTenant(tenantID);
    // Check if billing is active
    if (Utils.isTenantComponentActive(tenant, Constants.COMPONENTS.PRICING) &&
        Utils.isTenantComponentActive(tenant, Constants.COMPONENTS.BILLING)) {
      // Get the billing's settings
      const settings = await SettingStorage.getBillingSettings(tenantID);
      if (settings) {
        if (settings.stripe) {
          // Return the Stripe implementation
          return new StripeBilling(tenantID, settings.stripe);
        }
      }
    }
    return null;
  }
}
