import { SmartChargingSetting, SmartChargingSettingsType } from '../../types/Setting';

import DummySapSmartChargingIntegration from './DummySmartChargingIntegration';
import SapSmartChargingIntegration from './export-sap-smart-charging';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import SmartChargingIntegration from './SmartChargingIntegration';
import Tenant from '../../types/Tenant';
import TenantComponents from '../../types/TenantComponents';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Utils from '../../utils/Utils';

export default class SmartChargingFactory {
  static async getSmartChargingImpl(tenantID: string): Promise<SmartChargingIntegration<SmartChargingSetting>> {
    // Get the tenant
    const tenant: Tenant = await TenantStorage.getTenant(tenantID);
    // Check if the pricing is active
    if (Utils.isTenantComponentActive(tenant, TenantComponents.SMART_CHARGING)) {
      // Get the Smart Charging's settings
      const smartChargingSetting = await SettingStorage.getSmartChargingSettings(tenantID);
      if (smartChargingSetting) {
        // SAP Smart Charging
        if (smartChargingSetting.type === SmartChargingSettingsType.SAP_SMART_CHARGING) {
          const SapSmartChargingIntegrationImpl = new SapSmartChargingIntegration(tenantID, smartChargingSetting.sapSmartCharging);
          if (SapSmartChargingIntegrationImpl instanceof DummySapSmartChargingIntegration) {
            return null;
          }
          // Return the SAP Smart Charging implementation
          return SapSmartChargingIntegrationImpl;
        }
      }
    }
    // Smart Charging is not active
    return null;
  }
}
