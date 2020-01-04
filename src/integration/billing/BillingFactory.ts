import { BillingSetting, BillingSettingsType } from '../../types/Setting';
import Billing from './Billing';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
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
        switch (settings.type) {
          case BillingSettingsType.STRIPE:
            return new StripeBilling(tenantID, settings.stripe);
          default:
            break;
        }
      }
      Logging.logDebug({
        tenantID: tenant.id,
        module: 'BillingFactory',
        method: 'getBillingImpl',
        message: 'Billing settings are not configured'
      });
    }
    return null;
  }
}
