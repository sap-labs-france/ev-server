import { PricingSettings, PricingSettingsType } from '../../types/Setting';
import Tenant, { TenantComponents } from '../../types/Tenant';
import global, { ActionsResponse } from '../../types/GlobalType';

import Constants from '../../utils/Constants';
import ConsumptionStorage from '../../storage/mongodb/ConsumptionStorage';
import Logging from '../../utils/Logging';
import { ServerAction } from '../../types/Server';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import TenantMigrationTask from '../TenantMigrationTask';
import Transaction from '../../types/Transaction';
import TransactionStorage from '../../storage/mongodb/TransactionStorage';
import Utils from '../../utils/Utils';
import chalk from 'chalk';

const MODULE_NAME = 'RepairTransactionPricedAtZero';

export default class RepairTransactionPricedAtZero extends TenantMigrationTask {
  pricingSettings: PricingSettings;

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  public async migrateTenant(tenant: Tenant) {
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
            'timestamp': { $gt: new Date('2021-11-24') },
            'stop.timestamp': { $lt: new Date('2021-12-15') },
            'stop.price': 0,
            'stop.totalConsumptionWh': { $gt: 0 } ,
            'stop.pricingSource': 'simple',
            'refundData': { $exists: false }
          }
        },
        {
          $project: { '_id': 1 }
        }
      ]).toArray();
    // Load Simple Pricing Settings
    await this.loadSimplePricingSettings(tenant);
    if (transactionsMDB.length > 0 && this.pricingSettings?.simple?.price > 0) {
      let message = `${transactionsMDB.length} Transaction(s) are going to be repaired in Tenant ${Utils.buildTenantName(tenant)}...`;
      await Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT_ID,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'migrateTenant',
        message,
      });
      Utils.isDevelopmentEnv() && console.debug(chalk.yellow(`${new Date().toISOString()} - ${message}`));
      await Promise.map(transactionsMDB, async (transactionMDB) => {
        const numberOfProcessedTransactions = transactionsUpdated.inError + transactionsUpdated.inSuccess;
        if (numberOfProcessedTransactions > 0 && (numberOfProcessedTransactions % 100) === 0) {
          message = `> ${transactionsUpdated.inError + transactionsUpdated.inSuccess}/${transactionsMDB.length} - Transaction consumptions recomputed in Tenant ${Utils.buildTenantName(tenant)}`;
          await Logging.logDebug({
            tenantID: Constants.DEFAULT_TENANT_ID,
            action: ServerAction.MIGRATION,
            module: MODULE_NAME, method: 'migrateTenant',
            message
          });
          Utils.isDevelopmentEnv() && console.debug(chalk.yellow(`${new Date().toISOString()} - ${message}`));
        }
        try {
          // Get the transaction
          const transaction = await TransactionStorage.getTransaction(tenant, transactionMDB._id);
          // Transaction to be repaired to not have a pricing model
          if (!transaction.pricingModel) {
            // Price the consumptions again
            await this.priceAllConsumptionsAgain(tenant, transaction);
            // Price the transaction again
            await this.priceTransactionAgain(tenant, transaction);
          }
          transactionsUpdated.inSuccess++;
        } catch (error) {
          transactionsUpdated.inError++;
          await Logging.logError({
            tenantID: Constants.DEFAULT_TENANT_ID,
            action: ServerAction.MIGRATION,
            module: MODULE_NAME, method: 'migrateTenant',
            message: `> ${transactionsUpdated.inError + transactionsUpdated.inSuccess}/${transactionsMDB.length} - Cannot price transaction: '${transactionMDB._id}' in Tenant ${Utils.buildTenantName(tenant)}`,
            detailedMessages: { error: error.message, stack: error.stack }
          });
        }
      }, { concurrency: 5 }).then(() => {
        const totalDurationSecs = Math.trunc((new Date().getTime() - timeTotalFrom) / 1000);
        // Log in the default tenant
        void Logging.logActionsResponse(Constants.DEFAULT_TENANT_ID, ServerAction.MIGRATION,
          MODULE_NAME, 'migrateTenant', transactionsUpdated,
          `{{inSuccess}} transaction(s) were successfully processed in ${totalDurationSecs} secs in Tenant ${Utils.buildTenantName(tenant)}`,
          `{{inError}} transaction(s) failed to be processed in ${totalDurationSecs} secs in Tenant ${Utils.buildTenantName(tenant)}`,
          `{{inSuccess}} transaction(s) were successfully processed in ${totalDurationSecs} secs and {{inError}} failed to be processed in Tenant ${Utils.buildTenantName(tenant)}`,
          `All the transactions are up to date in Tenant ${Utils.buildTenantName(tenant)}`
        );
      });
    }
  }

  public getVersion(): string {
    return '1.1';
  }

  public getName(): string {
    return 'RepairTransactionPricedAtZeroTask';
  }

  public isAsynchronous(): boolean {
    return true;
  }

  private async loadSimplePricingSettings(tenant: Tenant): Promise<void> {
    if (Utils.isTenantComponentActive(tenant, TenantComponents.PRICING)) {
      const pricingSettings = await SettingStorage.getPricingSettings(tenant);
      if (pricingSettings?.type === PricingSettingsType.SIMPLE) {
        this.pricingSettings = pricingSettings;
      }
    }
  }

  private async priceAllConsumptionsAgain(tenant: Tenant, transaction: Transaction): Promise<void> {
    const pricePerkWh = this.pricingSettings.simple.price;
    let cumulatedPrice = 0;
    // Get the consumptions
    const consumptionDataResult = await ConsumptionStorage.getTransactionConsumptions(tenant, { transactionId: transaction.id });
    const consumptions = consumptionDataResult.result;
    for (const consumption of consumptions) {
      // Update the price
      const amount = Utils.computeSimplePrice(pricePerkWh, consumption.consumptionWh);
      cumulatedPrice = Utils.createDecimal(cumulatedPrice).plus(amount).toNumber();
      consumption.amount = amount;
      consumption.roundedAmount = Utils.truncTo(amount, 2);
      consumption.cumulatedAmount = cumulatedPrice;
      // Update the consumption
      await ConsumptionStorage.saveConsumption(tenant, consumption);
    }
  }

  private async priceTransactionAgain(tenant: Tenant, transaction: Transaction): Promise<void> {
    const pricePerkWh = this.pricingSettings.simple.price;
    // Apply simple pricing logic
    const price = Utils.createDecimal(transaction.stop.totalConsumptionWh).mul(pricePerkWh).div(1000).toNumber();
    transaction.stop.price = price;
    transaction.stop.roundedPrice = Utils.truncTo(price, 2);
    // Save
    await TransactionStorage.saveTransaction(tenant, transaction);
  }
}
