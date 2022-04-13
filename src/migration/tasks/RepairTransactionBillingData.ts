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

const MODULE_NAME = 'RepairTransactionBillingData';

export default class RepairTransactionBillingData extends TenantMigrationTask {

  public async migrateTenant(tenant: Tenant): Promise<void> {
    try {
      const billingImpl = await BillingFactory.getBillingImpl(tenant);
      if (billingImpl && billingImpl instanceof StripeBillingIntegration) {
        await this.repairTransactionsBillingData(tenant, billingImpl);
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
    return '1.0';
  }

  public getName(): string {
    return 'RepairTransactionBillingData';
  }

  public isAsynchronous(): boolean {
    return true;
  }

  public async repairTransactionsBillingData(tenant: Tenant, billingImpl: StripeBillingIntegration): Promise<void> {
    await billingImpl.checkConnection();
    const limit = Constants.BATCH_PAGE_SIZE;
    const filter = {
      // Consider all invoices from January 1st, 2022
      startDateTime: moment('01/01/2022', 'DD/MM/YYYY').toDate()
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
          await Logging.logInfo({
            tenantID: tenant.id,
            action: ServerAction.BILLING_PERFORM_OPERATIONS,
            actionOnUser: billingInvoice.user,
            module: MODULE_NAME, method: 'repairTransactionsBillingData',
            message: `Attempt to repair transaction's billing data for invoice: '${billingInvoice.id}' - '${billingInvoice.number}' `
          });
          await billingImpl.repairTransactionsBillingData(billingInvoice);
          await Logging.logInfo({
            tenantID: tenant.id,
            action: ServerAction.BILLING_PERFORM_OPERATIONS,
            actionOnUser: billingInvoice.user,
            module: MODULE_NAME, method: 'repairTransactionsBillingData',
            message: `Transaction's billing data has been repaired for invoice: '${billingInvoice.id}' - '${billingInvoice.number}' `
          });
        } catch (error) {
          await Logging.logError({
            tenantID: tenant.id,
            action: ServerAction.BILLING_PERFORM_OPERATIONS,
            actionOnUser: billingInvoice.user,
            module: MODULE_NAME, method: 'repairTransactionsBillingData',
            message: `Failed to repair transaction's billing data for invoice: '${billingInvoice.id}' - '${billingInvoice.number}' `,
            detailedMessages: { error: error.stack }
          });
        }
      }
    }
  }
}
