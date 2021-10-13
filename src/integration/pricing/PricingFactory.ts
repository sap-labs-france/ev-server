import FeatureToggles, { Feature } from '../../utils/FeatureToggles';
import { PricingSetting, PricingSettingsType } from '../../types/Setting';
import Tenant, { TenantComponents } from '../../types/Tenant';

import BuiltInPricingIntegration from './simple-pricing/BuiltInPricingIntegration';
import PricingIntegration from './PricingIntegration';
import SapConvergentChargingPricingIntegration from './sap-convergent-charging/SapConvergentChargingPricingIntegration';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import SimplePricingIntegration from './simple-pricing/SimplePricingIntegration';
import Utils from '../../utils/Utils';

export default class PricingFactory {
  static async getPricingImpl(tenant: Tenant): Promise<PricingIntegration<PricingSetting>> {
    // Check if the Pricing is active
    if (Utils.isTenantComponentActive(tenant, TenantComponents.PRICING)) {
      // Get the pricing settings
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
            // Simple Pricing implementation
            if (FeatureToggles.isFeatureActive(Feature.PRICING_NEW_MODEL)) {
              pricingIntegrationImpl = new BuiltInPricingIntegration(tenant, pricingSetting.simple);
            } else {
              pricingIntegrationImpl = new SimplePricingIntegration(tenant, pricingSetting.simple);
            }
            break;
        }
        return pricingIntegrationImpl;
      }
    }
    return null;
  }
}

