import { PricingSetting, PricingSettingsType } from '../../types/Setting';
import Tenant, { TenantComponents } from '../../types/Tenant';

import PricingIntegration from './PricingIntegration';
import SapConvergentChargingPricingIntegration from './sap-convergent-charging/SapConvergentChargingPricingIntegration';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import SimplePricingIntegration from './simple-pricing/SimplePricingIntegration';
import Utils from '../../utils/Utils';

export default class PricingFactory {
  static async getPricingImpl(tenant: Tenant): Promise<PricingIntegration<PricingSetting>> {
    // Check if the Pricing is active
    if (Utils.isTenantComponentActive(tenant, TenantComponents.PRICING)) {
      // Get the pricing's settings
      const pricingSetting = await SettingStorage.getPricingSettings(tenant);
      // Check
      if (pricingSetting) {
        let pricingIntegrationImpl = null;
        switch (pricingSetting.type) {
          // SAP Convergent Charging
          case PricingSettingsType.CONVERGENT_CHARGING:
            pricingIntegrationImpl = new SapConvergentChargingPricingIntegration(tenant, pricingSetting.convergentCharging);
            break;
          // Simple Pricing
          case PricingSettingsType.SIMPLE:
            pricingIntegrationImpl = new SimplePricingIntegration(tenant, pricingSetting.simple);
            break;
        }
        return pricingIntegrationImpl;
      }
    }
    return null;
  }
}

