import { RefundSetting, RefundSettingsType } from '../../types/Setting';
import Tenant, { TenantComponents } from '../../types/Tenant';

import Logging from '../../utils/Logging';
import RefundIntegration from './RefundIntegration';
import SapConcurRefundIntegration from './sap-concur/SapConcurRefundIntegration';
import { ServerAction } from '../../types/Server';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'RefundFactory';

export default class RefundFactory {
  public static async getRefundImpl(tenant: Tenant): Promise<RefundIntegration<RefundSetting>> {
    // Check if Refund component is active
    if (Utils.isTenantComponentActive(tenant, TenantComponents.REFUND)) {
      const setting = await SettingStorage.getRefundSettings(tenant);
      if (setting) {
        let refundIntegrationImpl = null;
        switch (setting.type) {
          // SAP Concur
          case RefundSettingsType.CONCUR:
            refundIntegrationImpl = new SapConcurRefundIntegration(tenant, setting[RefundSettingsType.CONCUR]);
            break;
        }
        return refundIntegrationImpl;
      }
      await Logging.logDebug({
        tenantID: tenant.id,
        action: ServerAction.REFUND,
        module: MODULE_NAME,
        method: 'getRefundImpl',
        message: 'Refund settings are not configured'
      });
    }
    return null;
  }
}
