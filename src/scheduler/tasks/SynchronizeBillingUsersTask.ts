import BillingFactory from '../../integration/billing/BillingFactory';
import NotificationHandler from '../../notification/NotificationHandler';
import SchedulerTask from '../SchedulerTask';
import { TaskConfig } from '../../types/TaskConfig';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';

export default class SynchronizeBillingUsersTask extends SchedulerTask {
  async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
    const billingImpl = await BillingFactory.getBillingImpl(tenant.id);
    if (billingImpl) {
      const synchronizeAction = await billingImpl.synchronizeUsers(tenant.id);
      if (synchronizeAction.error > 0) {
        await NotificationHandler.sendBillingUserSynchronizationFailed(
          tenant.id,
          {
            nbrUsersInError: synchronizeAction.error,
            evseDashboardURL: Utils.buildEvseURL(tenant.subdomain),
            evseDashnoardBillingURL: await Utils.buildEvseBillingSettingsURL(tenant.id)
          }
        );
      }
    }
  }
}
