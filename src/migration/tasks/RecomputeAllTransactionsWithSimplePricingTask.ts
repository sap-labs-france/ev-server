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
import chalk from 'chalk';

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
            'chargeBoxID':'SAP-Mougins-15',
            'timestamp': { $lt: new Date('2021-03-15') },
            'stop.totalConsumptionWh': { $gt: 0 },
            'stop.pricingSource': 'simple',
            'refundData': { $exists: false },
            'migrationTag': { $ne: `${TASK_NAME}~${this.getVersion()}` },
          }
        },
        {
          $project: { '_id': 1, 'migrationFlag': 1 }
        }
      ]).toArray();
    if (!Utils.isEmptyArray(transactionsMDB)) {
      let message = `${transactionsMDB.length} Transaction(s) are going to be recomputed in Tenant ${Utils.buildTenantName(tenant)}...`;
      await Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
        module: TASK_NAME, method: 'migrateTenant',
        message,
      });
      Utils.isDevelopmentEnv() && console.debug(chalk.yellow(`${new Date().toISOString()} - ${message}`));
      await Promise.map(transactionsMDB, async (transactionMDB) => {
        const numberOfProcessedTransactions = transactionsUpdated.inError + transactionsUpdated.inSuccess;
        if (numberOfProcessedTransactions > 0 && (numberOfProcessedTransactions % 100) === 0) {
          message = `> ${transactionsUpdated.inError + transactionsUpdated.inSuccess}/${transactionsMDB.length} - Transaction consumptions recomputed in Tenant ${Utils.buildTenantName(tenant)}`;
          await Logging.logDebug({
            tenantID: Constants.DEFAULT_TENANT,
            action: ServerAction.MIGRATION,
            module: TASK_NAME, method: 'migrateTenant',
            message
          });
          Utils.isDevelopmentEnv() && console.debug(chalk.yellow(`${new Date().toISOString()} - ${message}`));
        }
        try {
          // Get the transaction
          const transaction = await TransactionStorage.getTransaction(tenant.id, transactionMDB._id);
          // Flag the transaction as migrated
          transaction.migrationTag = `${TASK_NAME}~${this.getVersion()}`;
          // Rebuild the pricing
          await OCPPUtils.rebuildTransactionSimplePricing(tenant.id, transaction);
          // Read the priced transaction
          // FIXME: Power limitation will be lost in consumptions (to check the implementation)
          const pricedTransaction = await TransactionStorage.getTransaction(tenant.id, transactionMDB._id);
          // Rebuild Consumptions
          await OCPPUtils.rebuildTransactionConsumptions(tenant.id, pricedTransaction);
          transactionsUpdated.inSuccess++;
        } catch (error) {
          transactionsUpdated.inError++;
          await Logging.logError({
            tenantID: Constants.DEFAULT_TENANT,
            action: ServerAction.MIGRATION,
            module: TASK_NAME, method: 'migrateTenant',
            message: `> ${transactionsUpdated.inError + transactionsUpdated.inSuccess}/${transactionsMDB.length} - Cannot recompute the consumptions of Transaction ID '${transactionMDB._id}' in Tenant ${Utils.buildTenantName(tenant)}`,
            detailedMessages: { error: error.message, stack: error.stack }
          });
        }
      }, { concurrency: 5 }).then(() => {
        const totalDurationSecs = Math.trunc((new Date().getTime() - timeTotalFrom) / 1000);
        // Log in the default tenant
        void Logging.logActionsResponse(Constants.DEFAULT_TENANT, ServerAction.MIGRATION,
          TASK_NAME, 'migrateTenant', transactionsUpdated,
          `{{inSuccess}} transaction(s) were successfully processed in ${totalDurationSecs} secs in Tenant ${Utils.buildTenantName(tenant)}`,
          `{{inError}} transaction(s) failed to be processed in ${totalDurationSecs} secs in Tenant ${Utils.buildTenantName(tenant)}`,
          `{{inSuccess}} transaction(s) were successfully processed in ${totalDurationSecs} secs and {{inError}} failed to be processed in Tenant ${Utils.buildTenantName(tenant)}`,
          `All the transactions are up to date in Tenant ${Utils.buildTenantName(tenant)}`
        );
      });
    }
  }

  getVersion(): string {
    return '1.5';
  }

  getName(): string {
    return TASK_NAME;
  }

  isAsynchronous(): boolean {
    return true;
  }
}
