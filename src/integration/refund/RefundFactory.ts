import SettingStorage from '../../storage/mongodb/SettingStorage';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import { RefundSetting, RefundSettingsType } from '../../types/Setting';
import Tenant from '../../types/Tenant';
import TenantComponents from '../../types/TenantComponents';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import DummyRefundIntegration from './dummy/DummyRefundIntegration';
import ConcurRefundIntegration from './export/concur';
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
        let refundIntegrationImpl = null;
        switch (setting.type) {
          case RefundSettingsType.CONCUR:
            refundIntegrationImpl = new ConcurRefundIntegration(tenantID, setting[RefundSettingsType.CONCUR]);
            break;
        }
        // Check if missing implementation
        if (refundIntegrationImpl instanceof DummyRefundIntegration) {
          return null;
        }
        // Return the Refund implementation
        return refundIntegrationImpl;
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
