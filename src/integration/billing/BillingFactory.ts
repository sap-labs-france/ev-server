import Tenant, { TenantComponents } from '../../types/Tenant';

import BillingIntegration from './BillingIntegration';
import { BillingSettingsType } from '../../types/Setting';
import Logging from '../../utils/Logging';
import { ServerAction } from '../../types/Server';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import StripeBillingIntegration from './stripe/StripeBillingIntegration';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'BillingFactory';

export default class BillingFactory {
  public static async getBillingImpl(tenant: Tenant): Promise<BillingIntegration> {
    // Check if billing is active
    if (Utils.isTenantComponentActive(tenant, TenantComponents.PRICING) &&
        Utils.isTenantComponentActive(tenant, TenantComponents.BILLING)) {
      // Get the billing's settings
      const settings = await SettingStorage.getBillingSetting(tenant);
      if (settings) {
        let billingIntegrationImpl = null;
        switch (settings.type) {
          case BillingSettingsType.STRIPE:
            billingIntegrationImpl = StripeBillingIntegration.getInstance(tenant, settings);
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
