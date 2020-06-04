import SettingStorage from '../../storage/mongodb/SettingStorage';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import { SmartChargingSetting, SmartChargingSettingsType } from '../../types/Setting';
import Tenant from '../../types/Tenant';
import TenantComponents from '../../types/TenantComponents';
import Utils from '../../utils/Utils';
import DummySapSmartChargingIntegration from './dummy/DummySmartChargingIntegration';
import SapSmartChargingIntegration from './export/sap-smart-charging';
import SmartChargingIntegration from './SmartChargingIntegration';

export default class SmartChargingFactory {
  static async getSmartChargingImpl(tenantID: string): Promise<SmartChargingIntegration<SmartChargingSetting>> {
    // Get the tenant
    const tenant: Tenant = await TenantStorage.getTenant(tenantID);
    // Check if the pricing is active
    if (Utils.isTenantComponentActive(tenant, TenantComponents.SMART_CHARGING)) {
      // Get the Smart Charging's settings
      const smartChargingSetting = await SettingStorage.getSmartChargingSettings(tenantID);
      if (smartChargingSetting) {
        let smartChargingIntegrationImpl = null;
        switch (smartChargingSetting.type) {
          // SAP Smart Charging
          case SmartChargingSettingsType.SAP_SMART_CHARGING:
            smartChargingIntegrationImpl = new SapSmartChargingIntegration(tenantID, smartChargingSetting.sapSmartCharging);
            break;
        }
        // Check if missing implementation
        if (smartChargingIntegrationImpl instanceof DummySapSmartChargingIntegration) {
          return null;
        }
        // Return the Smart Charging implementation
        return smartChargingIntegrationImpl;
      }
    }
    // Smart Charging is not active
    return null;
  }
}
