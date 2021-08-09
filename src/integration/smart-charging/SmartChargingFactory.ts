import { SmartChargingSetting, SmartChargingSettingsType } from '../../types/Setting';

import DummySapSmartChargingIntegration from './dummy/DummySmartChargingIntegration';
import SapSmartChargingIntegration from './export/sap-smart-charging';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import SmartChargingIntegration from './SmartChargingIntegration';
import Tenant from '../../types/Tenant';
import TenantComponents from '../../types/TenantComponents';
import Utils from '../../utils/Utils';

export default class SmartChargingFactory {
  static async getSmartChargingImpl(tenant: Tenant): Promise<SmartChargingIntegration<SmartChargingSetting>> {
    // Check if the pricing is active
    if (Utils.isTenantComponentActive(tenant, TenantComponents.SMART_CHARGING)) {
      // Get the Smart Charging's settings
      const smartChargingSetting = await SettingStorage.getSmartChargingSettings(tenant);
      if (smartChargingSetting) {
        let smartChargingIntegrationImpl = null;
        switch (smartChargingSetting.type) {
          // SAP Smart Charging
          case SmartChargingSettingsType.SAP_SMART_CHARGING:
            smartChargingIntegrationImpl = new SapSmartChargingIntegration(tenant, smartChargingSetting.sapSmartCharging);
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
