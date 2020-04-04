import { SmartChargingSetting, SmartChargingSettingsType } from '../../types/Setting';
import SmartCharging from './SmartCharging';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Tenant from '../../types/Tenant';
import TenantComponents from '../../types/TenantComponents';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import Utils from '../../utils/Utils';
import SapSmartCharging from './sap-smart-charging/SapSmartCharging';

export default class SmartChargingFactory {
  static async getSmartChargingImpl(tenantID: string): Promise<SmartCharging<SmartChargingSetting>> {
    // Get the tenant
    const tenant: Tenant = await TenantStorage.getTenant(tenantID);
    // Check if the pricing is active
    if (Utils.isTenantComponentActive(tenant, TenantComponents.SMART_CHARGING)) {
      // Get the Smart Charging's settings
      const smartChargingSetting = await SettingStorage.getSmartChargingSettings(tenantID);
      if (smartChargingSetting) {
        // SAP Convergent Charging
        if (smartChargingSetting.type === SmartChargingSettingsType.SAP_SMART_CHARGING) {
          // Return the CC implementation
          return new SapSmartCharging(tenantID, smartChargingSetting.sapSmartCharging);
        }
      }
    }
    // Pricing is not active
    return null;
  }
}
