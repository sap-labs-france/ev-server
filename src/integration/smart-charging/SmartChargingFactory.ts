import { SmartChargingSetting, SmartChargingSettingsType } from '../../types/Setting';
import Tenant, { TenantComponents } from '../../types/Tenant';

import SapSmartChargingIntegration from './sap-smart-charging/SapSmartChargingIntegration';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import SmartChargingIntegration from './SmartChargingIntegration';
import Utils from '../../utils/Utils';

export default class SmartChargingFactory {
  public static async getSmartChargingImpl(tenant: Tenant): Promise<SmartChargingIntegration<SmartChargingSetting>> {
    // Check if Smart Charging is active
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
        return smartChargingIntegrationImpl;
      }
    }
    return null;
  }
}
