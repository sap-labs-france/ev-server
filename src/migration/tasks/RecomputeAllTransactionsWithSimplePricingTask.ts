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
    const dateOfPricingChangeTo16cts = new Date('2019-06-14');
    // Get transactions
    const transactionsMDB = await global.database.getCollection<any>(tenant.id, 'transactions')
      .aggregate([
        {
          $match: {
            'stop.price': { $gt: 0 },
            'stop.pricingSource': 'simple',
            'refundData': { $exists: false },
            'migrationTag': { $ne: `${TASK_NAME}~${this.getVersion()}` },
          }
        },
        {
          $project: { '_id': 1, 'migrationFlag': 1 }
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
        let pricePerkWh = 0;
        try {
          // Get the transaction
          const transaction = await TransactionStorage.getTransaction(tenant.id, transactionMDB._id);
          // Flag the transaction as migrated
          transaction.migrationTag = `${TASK_NAME}~${this.getVersion()}`;
          // Force the price to 0.16 for SLF and SLFCAH tenants
          if ((transaction.timestamp.getTime() > dateOfPricingChangeTo16cts.getTime()) &&
              (tenant.id === '5be9b03f1014d900089930d9' || tenant.id === '5be7fb271014d90008992f06')) {
            pricePerkWh = 0.16;
          }
          // Rebuild the pricing
          await OCPPUtils.rebuildTransactionSimplePricing(tenant.id, transaction, pricePerkWh);
          // Double check if final pricing is correct
          if (pricePerkWh > 0) {
            const pricedTransaction = await TransactionStorage.getTransaction(tenant.id, transactionMDB._id);
            if ((Utils.computeSimplePrice(pricePerkWh, pricedTransaction.stop.totalConsumptionWh) !== pricedTransaction.stop.price)) {
              // Rebuild Consumptions
              await OCPPUtils.rebuildTransactionConsumptions(tenant.id, pricedTransaction);
              // Check
              const recomputedConsumptionTransaction = await TransactionStorage.getTransaction(tenant.id, transactionMDB._id);
              if (recomputedConsumptionTransaction.stop.price === Utils.computeSimplePrice(pricePerkWh, recomputedConsumptionTransaction.stop.totalConsumptionWh)) {
                transactionsUpdated.inSuccess++;
                console.log(chalk.green('🚀 ~ RESULT OK'));
              } else {
                transactionsUpdated.inError++;
              }
            } else {
              transactionsUpdated.inSuccess++;
            }
          } else {
            transactionsUpdated.inSuccess++;
          }
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
