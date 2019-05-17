const MigrationTask = require('../MigrationTask');
const Tenant = require('../../entity/Tenant');
const Logging = require('../../utils/Logging');
const Constants = require('../../utils/Constants');
const SettingStorage = require('../../storage/mongodb/SettingStorage');
const SimplePricing = require('../../integration/pricing/simple-pricing/SimplePricing');
const moment = require('moment');
const Promise = require("bluebird");

const SUB_DOMAINS = ['slfcah', 'slf'];

class UpdateTransactionSimplePriceTask extends MigrationTask {
  async migrate() {
    for (const subdomain of SUB_DOMAINS) {
      const startDate = moment();
      const tenant = await Tenant.getTenantBySubdomain(subdomain);
      if (!tenant) {
        Logging.logError({
          tenantID: Constants.DEFAULT_TENANT, module: 'UpdateTransactionSimplePriceTask',
          method: 'migrate', action: "Migration", source: 'UpdateTransactionSimplePriceTask',
          message: `Tenant with subdomain '${tenant.getSubdomain()}' does not exists`
        });
        return;
      }

      const setting = await SettingStorage.getSettingByIdentifier(tenant.getID(), Constants.COMPONENTS.PRICING);
      // Check
      if (setting && setting.getContent()['simple']) {
        const simplePricing = new SimplePricing(tenant.getID(), setting.getContent()['simple']);
        await this.updateTransactionPrice(tenant.getID(), simplePricing);
      } else {
        Logging.logInfo({
          tenantID: Constants.DEFAULT_TENANT, module: 'UpdateTransactionSimplePriceTask',
          method: 'migrate', action: "Migration", source: 'UpdateTransactionSimplePriceTask',
          message: `Tenant with subdomain '${tenant.getSubdomain()}' is not configured to use Simple Pricing`
        });
      }

      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        source: "UpdateTransactionSimplePriceTask", action: "Migration",
        module: "UpdateTransactionSimplePriceTask", method: "migrate",
        message: `Tenant with subdomain '${tenant.getSubdomain()}' has been successfully migrated in ${moment().diff(startDate, 'seconds')} seconds`
      });
    }
  }

  async updateTransactionPrice(tenantId, simplePricing) {
    const transactionsCollection = await global.database.getCollection(tenantId, 'transactions');
    const transactions = await transactionsCollection.find().toArray();

    await Promise.map(transactions,
      async transaction => {
        if (transaction.stop && transaction.stop.totalConsumption) {
          const updatedField = await simplePricing.computePrice({consumption: transaction.stop.totalConsumption});
          await transactionsCollection.updateOne({_id: transaction._id}, {
            $set: {
              'stop.price': updatedField.amount,
              'stop.roundedPrice': updatedField.roundedAmount,
              'stop.priceUnit': updatedField.currencyCode,
              'stop.pricingSource': updatedField.pricingSource,
            }
          });
          await this.updateConsumptionPrice(tenantId, simplePricing, transaction._id);
        } else {
          Logging.logWarning({
            tenantID: Constants.DEFAULT_TENANT, module: 'UpdateTransactionSimplePriceTask',
            method: 'updateTransactionPrice', action: "Migration", source: 'UpdateTransactionSimplePriceTask',
            message: `Ignoring transaction ${transaction._id} not finished`
          });
        }
      },
      {concurrency: 10});
  }

  async updateConsumptionPrice(tenantId, simplePricing, transactionId) {
    const consumptionsCollection = await global.database.getCollection(tenantId, 'consumptions');
    const consumptions = await consumptionsCollection.aggregate([
      {$match: {transactionId: transactionId}},
      {$sort: {endedAt: 1}}
    ]).toArray();
    await Promise.map(consumptions,
      async consumption => {
        const updatedField = await simplePricing.computePrice({consumption: consumption.consumption});
        const cumulatedField = await simplePricing.computePrice({consumption: consumption.cumulatedConsumption});

        await consumptionsCollection.updateOne({_id: consumption._id}, {
          $set: {
            amount: updatedField.amount,
            roundedAmount: updatedField.roundedAmount,
            cumulatedAmount: cumulatedField.amount,
          }
        });
      },
      {concurrency: 10});
  }

  isAsynchronous() {
    return true;
  }

  getVersion() {
    return "1.3";
  }

  getName() {
    return "UpdateTransactionSimplePriceTask";
  }
}

module.exports = UpdateTransactionSimplePriceTask;
