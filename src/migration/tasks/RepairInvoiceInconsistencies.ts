import BillingFactory from '../../integration/billing/BillingFactory';
import BillingStorage from '../../storage/mongodb/BillingStorage';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import { ServerAction } from '../../types/Server';
import StripeBillingIntegration from '../../integration/billing/stripe/StripeBillingIntegration';
import Tenant from '../../types/Tenant';
import TenantMigrationTask from '../TenantMigrationTask';
import Utils from '../../utils/Utils';
import moment from 'moment';

const MODULE_NAME = 'RepairInvoiceInconsistencies';

export default class RepairInvoiceInconsistencies extends TenantMigrationTask {

  public async migrateTenant(tenant: Tenant): Promise<void> {
    try {
      const billingImpl = await BillingFactory.getBillingImpl(tenant);
      if (billingImpl && billingImpl instanceof StripeBillingIntegration) {
        await this.repairInvoices(tenant, billingImpl);
        await Logging.logDebug({
          tenantID: Constants.DEFAULT_TENANT_ID,
          module: MODULE_NAME, method: 'migrateTenant',
          action: ServerAction.MIGRATION,
          message: `Invoice consistency has been checked for tenant: ${Utils.buildTenantName(tenant)}`
        });
      }
    } catch (error) {
      await Logging.logError({
        tenantID: tenant.id,
        action: ServerAction.BILLING_PERFORM_OPERATIONS,
        module: MODULE_NAME, method: 'repairInvoices',
        message: `Failed to repair invoice in tenant: ${tenant.subdomain}`,
        detailedMessages: { error: error.stack }
      });
    }
  }

  public getVersion(): string {
    return '1.2';
  }

  public getName(): string {
    return 'RepairInvoiceInconsistenciesTask';
  }

  public isAsynchronous(): boolean {
    return true;
  }

  public async repairInvoices(tenant: Tenant, billingImpl: StripeBillingIntegration): Promise<void> {
    await billingImpl.checkConnection();
    const limit = Constants.BATCH_PAGE_SIZE;
    const filter = {
      // startDateTime: moment().date(0).date(1).startOf('day').toDate() // 1st day of the previous month 00:00:00 (AM)
      startDateTime: moment('01/12/2021', 'DD/MM/YYYY').toDate()
    };
    const sort = { createdOn: 1 };
    let skip = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const invoices = await BillingStorage.getInvoices(tenant, filter, { sort, limit, skip });
      if (Utils.isEmptyArray(invoices.result)) {
        break;
      }
      skip += limit;
      for (const billingInvoice of invoices.result) {
        try {
          // Skip invoices that are already PAID or not relevant for the current billing process
          if (!billingInvoice.sessions) {
            await Logging.logInfo({
              tenantID: tenant.id,
              action: ServerAction.BILLING_PERFORM_OPERATIONS,
              actionOnUser: billingInvoice.user,
              module: MODULE_NAME, method: 'repairInvoices',
              message: `Attempt to repair invoice: '${billingInvoice.id}' - '${billingInvoice.number}' `
            });
            await billingImpl.repairInvoice(billingInvoice);
            await Logging.logInfo({
              tenantID: tenant.id,
              action: ServerAction.BILLING_PERFORM_OPERATIONS,
              actionOnUser: billingInvoice.user,
              module: MODULE_NAME, method: 'repairInvoices',
              message: `Invoice has been repaired: '${billingInvoice.id}' - '${billingInvoice.number}' `
            });
          }
        } catch (error) {
          await Logging.logError({
            tenantID: tenant.id,
            action: ServerAction.BILLING_PERFORM_OPERATIONS,
            actionOnUser: billingInvoice.user,
            module: MODULE_NAME, method: 'repairInvoices',
            message: `Failed to repair invoice: '${billingInvoice.id}' - '${billingInvoice.number}' `,
            detailedMessages: { error: error.stack }
          });
        }
      }
    }
  }
}
