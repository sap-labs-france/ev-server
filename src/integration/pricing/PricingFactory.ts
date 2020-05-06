import { PricingSetting, PricingSettingsType } from '../../types/Setting';

import ConvergentChargingPricingIntegration from './export/convergent-charging';
import DummyPricingIntegration from './dummy/DummyPricingIntegration';
import PricingIntegration from './PricingIntegration';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import SimplePricingIntegration from './simple-pricing/SimplePricingIntegration';
import Tenant from '../../types/Tenant';
import TenantComponents from '../../types/TenantComponents';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Utils from '../../utils/Utils';

export default class PricingFactory {
  static async getPricingImpl(tenantID: string): Promise<PricingIntegration<PricingSetting>> {
    // Get the tenant
    const tenant: Tenant = await TenantStorage.getTenant(tenantID);
    // Check if the pricing is active
    if (Utils.isTenantComponentActive(tenant, TenantComponents.PRICING)) {
      // Get the pricing's settings
      const pricingSetting = await SettingStorage.getPricingSettings(tenantID);
      // Check
      if (pricingSetting) {
        let pricingIntegrationImpl;
        switch (pricingSetting.type) {
          // SAP Convergent Charging
          case PricingSettingsType.CONVERGENT_CHARGING:
            // SAP Convergent Charging implementation
            pricingIntegrationImpl = new ConvergentChargingPricingIntegration(tenantID, pricingSetting.convergentCharging);
            break;
          // Simple Pricing
          case PricingSettingsType.SIMPLE:
            // Simple Pricing implementation
            pricingIntegrationImpl = new SimplePricingIntegration(tenantID, pricingSetting.simple);
            break;
          default:
            pricingIntegrationImpl = null;
            break;
        }
        // Check if missing implementation
        if (pricingIntegrationImpl instanceof DummyPricingIntegration) {
          pricingIntegrationImpl = null;
        }
        // Return the Pricing Integration implementation
        return pricingIntegrationImpl;
      }
    }
    // Pricing is not active
    return null;
  }
}

