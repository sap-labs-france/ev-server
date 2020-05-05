import { BillingSetting, BillingSettingsType } from '../../types/Setting';

import BillingIntegration from './BillingIntegration';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import StripeBillingIntegration from './stripe/StripeBillingIntegration';
import Tenant from '../../types/Tenant';
import TenantComponents from '../../types/TenantComponents';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Utils from '../../utils/Utils';

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
        let billingIntegrationImpl;
        switch (settings.type) {
          case BillingSettingsType.STRIPE:
            billingIntegrationImpl = new StripeBillingIntegration(tenantID, settings.stripe);
            break;
          default:
            billingIntegrationImpl = null;
            break;
        }
        return billingIntegrationImpl;
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
