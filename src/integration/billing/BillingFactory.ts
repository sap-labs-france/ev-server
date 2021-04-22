import { BillingSettings, BillingSettingsType } from '../../types/Setting';

import BillingIntegration from './BillingIntegration';
import BillingStorage from '../../storage/mongodb/BillingStorage';
import Logging from '../../utils/Logging';
import { ServerAction } from '../../types/Server';
import StripeBillingIntegration from './stripe/StripeBillingIntegration';
import Tenant from '../../types/Tenant';
import TenantComponents from '../../types/TenantComponents';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'BillingFactory';

export default class BillingFactory {
  static async getBillingImpl(tenantID: string, settings?: BillingSettings): Promise<BillingIntegration> {
    // Get the tenant
    const tenant: Tenant = await TenantStorage.getTenant(tenantID);
    // Check if billing is active
    if (Utils.isTenantComponentActive(tenant, TenantComponents.PRICING) &&
        Utils.isTenantComponentActive(tenant, TenantComponents.BILLING)) {
      if (!settings) {
        // Get the billing's settings
        const allSettings = await BillingStorage.getBillingSettings(tenantID);
        settings = allSettings[0];
      } else {
        // Specific situation to pre-check billing settings
        await Logging.logDebug({
          tenantID: tenant.id,
          action: ServerAction.BILLING,
          module: MODULE_NAME, method: 'getBillingImpl',
          message: 'Now checking billing connectivity with settings not yet persisted'
        });
      }
      if (settings) {
        let billingIntegrationImpl = null;
        switch (settings.type) {
          case BillingSettingsType.STRIPE:
            billingIntegrationImpl = StripeBillingIntegration.getInstance(tenantID, settings);
            break;
        }
        return billingIntegrationImpl;
      }
      await Logging.logDebug({
        tenantID: tenant.id,
        action: ServerAction.BILLING,
        module: MODULE_NAME, method: 'getBillingImpl',
        message: 'Billing settings are not configured'
      });
    }
    return null;
  }
}
