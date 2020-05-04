import { RefundSetting, RefundSettingsType } from '../../types/Setting';

import ConcurRefundIntegration from './export-concur';
import Constants from '../../utils/Constants';
import DummyRefundIntegration from './DummyRefundIntegration';
import Logging from '../../utils/Logging';
import RefundIntegration from './RefundIntegration';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import Tenant from '../../types/Tenant';
import TenantComponents from '../../types/TenantComponents';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Utils from '../../utils/Utils';

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
        let ConcurRefundIntegrationImpl;
        switch (setting.type) {
          case RefundSettingsType.CONCUR:
            ConcurRefundIntegrationImpl = new ConcurRefundIntegration(tenantID, setting[Constants.SETTING_REFUND_CONTENT_TYPE_CONCUR]);
            if (ConcurRefundIntegrationImpl instanceof DummyRefundIntegration) {
              return null;
            }
            return ConcurRefundIntegrationImpl;
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
