import global, { ActionsResponse } from '../../types/GlobalType';

import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import OCPPUtils from '../../server/ocpp/utils/OCPPUtils';
import Promise from 'bluebird';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import TransactionStorage from '../../storage/mongodb/TransactionStorage';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'RecomputeAllTransactionsConsumptionsTask';

export default class RecomputeAllTransactionsConsumptionsTask extends MigrationTask {
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  async migrate() {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  async migrateTenant(tenant: Tenant) {
    const consumptionsUpdated: ActionsResponse = {
      inError: 0,
      inSuccess: 0,
    };
    const startTime = new Date().getTime();
    // Get transactions
    const transactionsMDB = await global.database.getCollection<any>(tenant.id, 'transactions')
      .aggregate([
        {
          $match: {
            'stop.extraInactivitySecs': { $gt: 0 },
            'stop.extraInactivityComputed': false
          }
        },
        {
          $project: { '_id': 1 }
        }
      ]).toArray();
    if (!Utils.isEmptyArray(transactionsMDB)) {
      void Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'migrateTenant',
        message: `${transactionsMDB.length} Transaction(s) are going to be recomputed in Tenant ${Utils.buildTenantName(tenant)}...`,
      });
      await Promise.map(transactionsMDB, async (transactionMDB) => {
        try {
          // Recompute consumption
          const timeFrom = new Date().getTime();
          // Get the Transaction
          const transaction = await TransactionStorage.getTransaction(tenant.id, transactionMDB._id);
          // Rebuild consumptions
          // FIXME: Power limitation will be lost in consumptions (to check the implementation)
          const nbrOfConsumptions = await OCPPUtils.rebuildTransactionConsumptions(tenant.id, transaction);
          const durationSecs = Math.trunc((new Date().getTime() - timeFrom) / 1000);
          consumptionsUpdated.inSuccess++;
          if (nbrOfConsumptions > 0) {
            void Logging.logDebug({
              tenantID: Constants.DEFAULT_TENANT,
              action: ServerAction.MIGRATION,
              module: MODULE_NAME, method: 'migrateTenant',
              message: `> ${consumptionsUpdated.inError + consumptionsUpdated.inSuccess}/${transactionsMDB.length} - Processed Transaction ID '${transactionMDB._id}' with ${nbrOfConsumptions} consumptions in ${durationSecs}s in Tenant ${Utils.buildTenantName(tenant)}`,
            });
          } else {
            // Delete transaction
            await TransactionStorage.deleteTransaction(tenant.id, transactionMDB._id);
            void Logging.logDebug({
              tenantID: Constants.DEFAULT_TENANT,
              action: ServerAction.MIGRATION,
              module: MODULE_NAME, method: 'migrateTenant',
              message: `> ${consumptionsUpdated.inError + consumptionsUpdated.inSuccess}/${transactionsMDB.length} - Deleted Transaction ID '${transactionMDB._id}' with no consumption in Tenant ${Utils.buildTenantName(tenant)}`,
            });
          }
        } catch (error) {
          consumptionsUpdated.inError++;
          void Logging.logError({
            tenantID: Constants.DEFAULT_TENANT,
            action: ServerAction.MIGRATION,
            module: MODULE_NAME, method: 'migrateTenant',
            message: `> ${consumptionsUpdated.inError + consumptionsUpdated.inSuccess}/${transactionsMDB.length} - Cannot recompute the consumptions of Transaction ID '${transactionMDB._id}' in Tenant ${Utils.buildTenantName(tenant)}`,
            detailedMessages: { error: error.message, stack: error.stack }
          });
        }
      }, { concurrency: 5 }).then(() => {
        const totalDurationSecs = Math.trunc((new Date().getTime() - startTime) / 1000);
        // Log in the default tenant
        void Logging.logActionsResponse(Constants.DEFAULT_TENANT, ServerAction.MIGRATION,
          MODULE_NAME, 'migrateTenant', consumptionsUpdated,
          `{{inSuccess}} transaction(s) were successfully processed in ${totalDurationSecs} secs in Tenant ${Utils.buildTenantName(tenant)}`,
          `{{inError}} transaction(s) failed to be processed in ${totalDurationSecs} secs in Tenant ${Utils.buildTenantName(tenant)}`,
          `{{inSuccess}} transaction(s) were successfully processed in ${totalDurationSecs} secs and {{inError}} failed to be processed in Tenant ${Utils.buildTenantName(tenant)}`,
          `All the transactions are up to date in Tenant ${Utils.buildTenantName(tenant)}`
        );
      });
    }
  }

  getVersion(): string {
    return '1.1';
  }

  getName(): string {
    return 'RecomputeAllTransactionsConsumptionsTask';
  }

  isAsynchronous(): boolean {
    return true;
  }
}
