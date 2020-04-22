import { SmartChargingSetting, SmartChargingSettingsType } from '../../types/Setting';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import SmartCharging from './SmartCharging';
import Tenant from '../../types/Tenant';
import TenantComponents from '../../types/TenantComponents';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Utils from '../../utils/Utils';
import path from 'path';

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
          const SapSmartCharging = await Utils.importModule(path.join(__dirname, '/sap-smart-charging/SapSmartCharging'));
          // Return the CC implementation
          return new SapSmartCharging(tenantID, smartChargingSetting.sapSmartCharging);
        }
      }
    }
    // Smart Charging is not active
    return null;
  }
}
