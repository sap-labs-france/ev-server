import ConcurRefundConnector from './concur/ConcurRefundConnector';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import RefundConnector from './RefundConnector';
import { RefundSettingType } from '../../types/Setting';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Utils from '../../utils/Utils';

export default class RefundFactory {
  static async getRefundConnector(tenantID: string): Promise<RefundConnector> {
    // Get the tenant
    const tenant: Tenant = await TenantStorage.getTenant(tenantID);
    // Check if refund component is active
    if (Utils.isTenantComponentActive(tenant, Constants.COMPONENTS.REFUND)
    ) {
      const setting = await SettingStorage.getRefundSettings(tenantID);
      // Check
      if (setting) {
        if (setting.type === RefundSettingType.CONCUR) {
          return new ConcurRefundConnector(tenantID, setting[Constants.SETTING_REFUND_CONTENT_TYPE_CONCUR]);
        }
      }
      Logging.logDebug({
        tenantID: tenant.id,
        module: 'RefundFactory',
        method: 'getRefundConnector',
        message: 'Refund settings are not configured'
      });
    }
    // Refund is not active
    return null;
  }
}
