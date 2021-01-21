import { RefundSetting, RefundSettingsType } from '../../types/Setting';

import ConcurRefundIntegration from './export/concur';
import DummyRefundIntegration from './dummy/DummyRefundIntegration';
import Logging from '../../utils/Logging';
import RefundIntegration from './RefundIntegration';
import { ServerAction } from '../../types/Server';
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
        action: ServerAction.REFUND,
        module: MODULE_NAME,
        method: 'getRefundImpl',
        message: 'Refund settings are not configured'
      });
    }
    // Refund is not active
    return null;
  }
}
