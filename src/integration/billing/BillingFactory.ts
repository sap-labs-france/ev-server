import SettingStorage from '../../storage/mongodb/SettingStorage';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import { BillingSetting, BillingSettingsType } from '../../types/Setting';
import Tenant from '../../types/Tenant';
import TenantComponents from '../../types/TenantComponents';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import BillingIntegration from './BillingIntegration';
import StripeBillingIntegration from './stripe/StripeBillingIntegration';

const MODULE_NAME = 'BillingFactory';

export default class BillingFactory {
  static async getBillingImpl(tenantID: string): Promise<BillingIntegration<BillingSetting>> {
    // Prevent default user from generating billing
    if (tenantID === Constants.DEFAULT_TENANT) {
      return null;
    }
    // Get the tenant
    const tenant: Tenant = await TenantStorage.getTenant(tenantID);
    // Check if billing is active
    if (Utils.isTenantComponentActive(tenant, TenantComponents.PRICING) &&
        Utils.isTenantComponentActive(tenant, TenantComponents.BILLING)) {
      // Get the billing's settings
      const settings = await SettingStorage.getBillingSettings(tenantID);
      if (settings) {
        switch (settings.type) {
          case BillingSettingsType.STRIPE:
            return new StripeBillingIntegration(tenantID, settings.stripe);
          default:
            break;
        }
      }
      Logging.logDebug({
        tenantID: tenant.id,
        module: MODULE_NAME, method: 'getBillingImpl',
        message: 'Billing settings are not configured'
      });
    }
    return null;
  }
}
