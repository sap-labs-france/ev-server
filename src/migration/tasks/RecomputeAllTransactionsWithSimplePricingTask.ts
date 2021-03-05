import global, { ActionsResponse } from '../../types/GlobalType';

import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import OCPPUtils from '../../server/ocpp/utils/OCPPUtils';
import Promise from 'bluebird';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';

const TASK_NAME = 'RecomputeAllTransactionsWithSimplePricingTask';

export default class RecomputeAllTransactionsWithSimplePricingTask extends MigrationTask {
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  async migrate() {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  async migrateTenant(tenant: Tenant) {
    const transactionsUpdated: ActionsResponse = {
      inError: 0,
      inSuccess: 0,
    };
    const timeTotalFrom = new Date().getTime();
    // Get transactions
    const transactionsMDB = await global.database.getCollection<any>(tenant.id, 'transactions')
      .aggregate([
        {
          $match: {
            'stop.price': { $gt: 0 },
            'stop.pricingSource': 'simple',
            'refundData': { $exists: false },
          }
        },
        {
          $project: { '_id': 1 }
        }
      ]).toArray();
    if (transactionsMDB.length > 0) {
      await Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
        module: TASK_NAME, method: 'migrateTenant',
        message: `${transactionsMDB.length} Transaction(s) are going to be recomputed in Tenant '${tenant.name}' ('${tenant.subdomain}')...`,
      });
      await Promise.map(transactionsMDB, async (transactionMDB) => {
        try {
          await OCPPUtils.rebuildTransactionSimplePricing(tenant.id, transactionMDB._id);
          transactionsUpdated.inSuccess++;
        } catch (error) {
          transactionsUpdated.inError++;
          await Logging.logError({
            tenantID: Constants.DEFAULT_TENANT,
            action: ServerAction.MIGRATION,
            module: TASK_NAME, method: 'migrateTenant',
            message: `> ${transactionsUpdated.inError + transactionsUpdated.inSuccess}/${transactionsMDB.length} - Cannot recompute the consumptions of Transaction ID '${transactionMDB._id}' in Tenant '${tenant.name}' ('${tenant.subdomain}')`,
            detailedMessages: { error: error.message, stack: error.stack }
          });
        }
      }, { concurrency: 5 }).then(() => {
        const totalDurationSecs = Math.trunc((new Date().getTime() - timeTotalFrom) / 1000);
        // Log in the default tenant
        void Logging.logActionsResponse(Constants.DEFAULT_TENANT, ServerAction.MIGRATION,
          TASK_NAME, 'migrateTenant', transactionsUpdated,
          `{{inSuccess}} transaction(s) were successfully processed in ${totalDurationSecs} secs in Tenant '${tenant.name}' ('${tenant.subdomain}')`,
          `{{inError}} transaction(s) failed to be processed in ${totalDurationSecs} secs in Tenant '${tenant.name}' ('${tenant.subdomain}')`,
          `{{inSuccess}} transaction(s) were successfully processed in ${totalDurationSecs} secs and {{inError}} failed to be processed in Tenant '${tenant.name}' ('${tenant.subdomain}')`,
          `All the transactions are up to date in Tenant '${tenant.name}' ('${tenant.subdomain}')`
        );
      });
    }
  }

  getVersion(): string {
    return '1.0';
  }

  getName(): string {
    return TASK_NAME;
  }

  isAsynchronous(): boolean {
    return true;
  }
}
