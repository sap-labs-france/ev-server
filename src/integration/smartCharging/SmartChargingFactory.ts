import Constants from '../../utils/Constants';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Utils from '../../utils/Utils';
import Logging from '../../utils/Logging';
import SapSmartChargingConnector from './sapSmartCharging/sapSmartChargingConnector';
import SmartChargingConnector from './SmartChargingConnector';

export default class SmartChargingFactory {
  static async getSmartChargingConnector(tenantID: string): Promise<SmartChargingConnector> {
    // Get the tenant
    const tenant: Tenant = await TenantStorage.getTenant(tenantID);
    // Check if refund component is active
    if (Utils.isTenantComponentActive(tenant, Constants.COMPONENTS.SMART_CHARGING)
    ) {
      console.log(tenantID);
      const setting = await SettingStorage.getSettingByIdentifier('5be7fb271014d90008992f06', Constants.COMPONENTS.SMART_CHARGING);
      // Check
      if (setting && setting.content[Constants.SETTING_SMART_CHARGING_CONTENT_TYPE_SAP_SMART_CHARGING]) {
        return new SapSmartChargingConnector(tenantID, setting.content[Constants.SETTING_SMART_CHARGING_CONTENT_TYPE_SAP_SMART_CHARGING]);
      }
      Logging.logDebug({
        tenantID: tenant.id,
        module: 'SmartChargingFactory',
        method: 'getSmartChargingConnector',
        message: 'Smart Charging settings are not configured'
      });

    }
    // Refund is not active
    return null;
  }
}
