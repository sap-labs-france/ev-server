import SettingStorage from '../../storage/mongodb/SettingStorage';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import { RefundSetting, RefundSettingsType } from '../../types/Setting';
import Tenant from '../../types/Tenant';
import TenantComponents from '../../types/TenantComponents';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import ConcurRefundIntegration from './concur/ConcurRefundIntegration';
import RefundIntegration from './RefundIntegration';

const MODULE_NAME = 'RefundFactory';

export default class RefundFactory {
  static async getRefundImpl(tenantID: string): Promise<RefundIntegration<RefundSetting>> {
    // Get the tenant
    const tenant: Tenant = await TenantStorage.getTenant(tenantID);
    // Check if refund component is active
    if (Utils.isTenantComponentActive(tenant, TenantComponents.REFUND)) {
      const setting = await SettingStorage.getRefundSettings(tenantID);
      // Check
      if (setting) {
        switch (setting.type) {
          case RefundSettingsType.CONCUR:
            return new ConcurRefundIntegration(tenantID, setting[Constants.SETTING_REFUND_CONTENT_TYPE_CONCUR]);
          default:
            break;
        }
      }
      Logging.logDebug({
        tenantID: tenant.id,
        module: MODULE_NAME,
        method: 'getRefundImpl',
        message: 'Refund settings are not configured'
      });
    }
    // Refund is not active
    return null;
  }
}
