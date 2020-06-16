import OCPPUtils from '../../server/ocpp/utils/OCPPUtils';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import global, { ActionsResponse } from '../../types/GlobalType';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import MigrationTask from '../MigrationTask';
import Promise from 'bluebird';
import TransactionStorage from '../../storage/mongodb/TransactionStorage';

const MODULE_NAME = 'RecomputeAllTransactionsConsumptionsTask';

export default class RecomputeAllTransactionsConsumptionsTask extends MigrationTask {
  async migrate() {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant) {
    const consumptionsUpdated: ActionsResponse = {
      inError: 0,
      inSuccess: 0,
    };
    const timeTotalFrom = new Date().getTime();
    // Get all transactions
    const transactionsMDB = await global.database.getCollection<any>(tenant.id, 'consumptions')
      .aggregate([
        { $match: { instantVolts: { $exists: false } } },
        { $group: { _id: '$transactionId' } }
      ]).toArray();
    if (transactionsMDB.length > 0) {
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'migrateTenant',
        message: `${transactionsMDB.length} Transaction are going to be recomputed in Tenant '${tenant.name}' ('${tenant.subdomain}')...`,
      });
      await Promise.map(transactionsMDB, async (transactionMDB) => {
        try {
          // Recompute consumption
          const timeFrom = new Date().getTime();
          const nbrOfConsumptions = await OCPPUtils.recomputeTransactionConsumptions(tenant.id, transactionMDB._id);
          const durationSecs = Math.trunc((new Date().getTime() - timeFrom) / 1000);
          consumptionsUpdated.inSuccess++;
          if (nbrOfConsumptions > 0) {
            Logging.logDebug({
              tenantID: Constants.DEFAULT_TENANT,
              action: ServerAction.MIGRATION,
              module: MODULE_NAME, method: 'migrateTenant',
              message: `> ${consumptionsUpdated.inError + consumptionsUpdated.inSuccess}/${transactionsMDB.length} - Processed Transaction ID '${transactionMDB._id}' with ${nbrOfConsumptions} consumptions in ${durationSecs}s in Tenant '${tenant.name}' ('${tenant.subdomain}')`,
            });
          } else {
            // Delete transaction
            await TransactionStorage.deleteTransaction(tenant.id, transactionMDB._id);
            Logging.logDebug({
              tenantID: Constants.DEFAULT_TENANT,
              action: ServerAction.MIGRATION,
              module: MODULE_NAME, method: 'migrateTenant',
              message: `> ${consumptionsUpdated.inError + consumptionsUpdated.inSuccess}/${transactionsMDB.length} - Deleted Transaction ID '${transactionMDB._id}' with no consumption in Tenant '${tenant.name}' ('${tenant.subdomain}')`,
            });
          }
        } catch (error) {
          consumptionsUpdated.inError++;
          Logging.logError({
            tenantID: Constants.DEFAULT_TENANT,
            action: ServerAction.MIGRATION,
            module: MODULE_NAME, method: 'migrateTenant',
            message: `> ${consumptionsUpdated.inError + consumptionsUpdated.inSuccess}/${transactionsMDB.length} - Cannot recompute the consumptions of Transaction ID '${transactionMDB._id}' in Tenant '${tenant.name}' ('${tenant.subdomain}')`,
            detailedMessages: { error: error.message, stack: error.stack }
          });
        }
      }, { concurrency: 5 }).then(() => {
        const totalDurationSecs = Math.trunc((new Date().getTime() - timeTotalFrom) / 1000);
        // Log in the default tenant
        Utils.logActionsResponse(Constants.DEFAULT_TENANT, ServerAction.MIGRATION,
          MODULE_NAME, 'migrateTenant', consumptionsUpdated,
          `{{inSuccess}} transaction(s) were successfully processed in ${totalDurationSecs} secs in Tenant '${tenant.name}' ('${tenant.subdomain}')`,
          `{{inError}} transaction(s) failed to be processed in ${totalDurationSecs} secs in Tenant '${tenant.name}' ('${tenant.subdomain}')`,
          `{{inSuccess}} transaction(s) were successfully processed in ${totalDurationSecs} secs and {{inError}} failed to be processed in Tenant '${tenant.name}' ('${tenant.subdomain}')`,
          `All the transactions are up to date in Tenant '${tenant.name}' ('${tenant.subdomain}')`
        );
      });
    }
  }

  getVersion() {
    return '1.0';
  }

  getName() {
    return 'RecomputeAllTransactionsConsumptionsTask';
  }

  isAsynchronous() {
    return true;
  }
}
