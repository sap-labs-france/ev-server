const Tenant = require('../../entity/Tenant');
const User = require('../../entity/User');
const PricingStorage = require('../../storage/mongodb/PricingStorage');
const SettingStorage = require('../../storage/mongodb/SettingStorage');
const TransactionStorage = require('../../storage/mongodb/TransactionStorage');
const ConsumptionStorage = require('../../storage/mongodb/ConsumptionStorage');
const Database = require('../../utils/Database');
const DatabaseUtils = require('../../storage/mongodb/DatabaseUtils');
const Utils = require('../../utils/Utils');
const moment = require('moment');
const Transaction = require('../../entity/Transaction');
const momentDurationFormatSetup = require('moment-duration-format');
const Logging = require('../../utils/Logging');
const Constants = require('../../utils/Constants');
const pLimit = require('p-limit');


momentDurationFormatSetup(moment);

class AddConsumptions {

  async migrate() {
    const tenants = await Tenant.getTenants();

    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant) {
    this.startProcess(tenant.getID());
  }

  async startProcess(tenantID) {

    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: {
        "stop": {
          $exists: true
        }
      }
    });
    aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenantID, 'chargingstations'),
        localField: 'chargeBoxID',
        foreignField: '_id',
        as: 'chargeBox'
      }
    });
    aggregation.push({
      $unwind: {"path": "$chargeBox", "preserveNullAndEmptyArrays": true}
    });
    aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenantID, 'siteareas'),
        localField: 'chargeBox.siteAreaID',
        foreignField: '_id',
        as: 'siteArea'
      }
    });
    aggregation.push({
      $unwind: {"path": "$siteArea", "preserveNullAndEmptyArrays": true}
    });

    // Read all transactions
    const transactionsMDB = await global.database.getCollection(tenantID, 'transactions')
      .aggregate(aggregation)
      .toArray();
    // Get the price
    const pricing = await PricingStorage.getPricing(tenantID);
    if (pricing && !(await SettingStorage.getSettingByIdentifier(tenantID, 'pricing'))) {
      //move pricing to settings
      SettingStorage.saveSetting(tenantID,
        {
          "content": {
            "simple": {
              "price": pricing.priceKWH,
              "currency": pricing.priceUnit
            }
          },
          "createdBy": null,
          "createdOn": new Date(),
          "identifier": "pricing"
        });
    }
    const terminatedTransactionsModel = transactionsMDB.filter(t => t.siteArea && t.stop)
      .map(t => {
        const model = {};
        Database.updateTransaction(t, model);
        model.siteAreaID = Database.validateId(t.siteArea._id);
        model.siteID = Database.validateId(t.siteArea.siteID);
        return model;
      });
    Logging.logDebug({
      tenantID: Constants.DEFAULT_TENANT,
      source: "Migration", action: "Migration",
      module: "AddConsumptions", method: "migrate",
      message: `tenant ${tenantID} =>  transactions count ${transactionsMDB.length}, transactions to migrate ${terminatedTransactionsModel.length},  transactions to avoid ${transactionsMDB.length - terminatedTransactionsModel.length} `
    });
    this.totalClount = terminatedTransactionsModel.length;
    this.done = 0;
    this.level = 0;
    this.startTime = moment();
    const limit = pLimit(10);
    const promises = terminatedTransactionsModel.map(transactionModel => limit(() => this.replaceWithConsumptions(tenantID, pricing, transactionModel)));
    await Promise.all(promises);
    const endTime = moment();

    Logging.logDebug({
      tenantID: Constants.DEFAULT_TENANT,
      source: "Migration", action: "Migration",
      module: "AddConsumptions", method: "migrate",
      message: `tenant ${tenantID} => ${terminatedTransactionsModel.length} transactions migrated after ${moment.duration(endTime.diff(this.startTime)).format("mm:ss.SS", {trim: false})}`
    });
  }


  async replaceWithConsumptions(tenantID, pricing, transactionModel) {
    const meterValues = await TransactionStorage.getMeterValues(tenantID, transactionModel.id);
    meterValues.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const consumptions = await this.replayTransaction(tenantID, transactionModel, meterValues, pricing);

    await ConsumptionStorage.deleteConsumptions(tenantID, transactionModel.id);
    await this.insertMany(tenantID, consumptions);
    this.done++;
    const donePercentage = (this.done * 100) / this.totalClount;
    if (donePercentage >= this.level) {
      this.level += 10;
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        source: "Migration", action: "Migration",
        module: "AddConsumptions", method: "replaceWithConsumptions",
        message: `tenant ${tenantID}, done ${(donePercentage).toFixed(2)}% (${this.done}/${this.totalClount}) after ${moment.duration(moment().diff(this.startTime)).format("mm:ss.SS", {trim: false})}`
      });
    }
  }


  async insertMany(tenantID, consumptions) {
    // Debug
    const uniqueTimerID = Logging.traceStart('AddConsumptions', 'insertMany');
    // Check
    await Utils.checkTenant(tenantID);
    // Transfer
    const consumptionMDB = consumptions.map(c => {
      const mdb = {};
      Database.updateConsumption(c, mdb, false);
      return mdb;
    });
    // Modify
    const result = await global.database.getCollection(tenantID, 'consumptions').insertMany(consumptionMDB);
    // Debug
    Logging.traceEnd('AddConsumptions', 'insertMany', uniqueTimerID, {consumptionsCount: consumptions.length});
    // Return
    return result.acknowledged;
  }


  /**
   *
   * @param tenantId
   * @param transactionModel {Transaction}
   * @returns {Transaction}
   */
  resetTransaction(tenantId, transactionModel) {
    const model = Utils.duplicateJSON(transactionModel);
    delete model.stop;
    return new Transaction(tenantId, model);
  }

  /**
   *
   * @param transactionModel {Transaction}
   */
  getStoppingPayload(transactionModel) {
    const model = Utils.duplicateJSON(transactionModel);
    const stopPayload = model.stop;
    return stopPayload;
  }

  computePriceOfConsumption(consumption, pricing) {
    if (!pricing) {
      return {};
    }
    return {
      pricingSource: 'simple',
      amount: (pricing.priceKWH * (consumption.consumption / 1000)).toFixed(6),
      roundedAmount: (pricing.priceKWH * (consumption.consumption / 1000)).toFixed(2),
      currencyCode: pricing.priceUnit,
      cumulatedAmount: (pricing.priceKWH * (consumption.cumulatedConsumption / 1000)).toFixed(2)
    };
  }

  async replayTransaction(tenantId, oldTransactionModel, meterValues, pricing) {
    const stationData = {
      chargeBoxID: oldTransactionModel.chargeBoxID,
      siteID: oldTransactionModel.siteID,
      siteAreaID: oldTransactionModel.siteAreaID
    };
    const transactionCopy = Utils.duplicateJSON(oldTransactionModel);
    transactionCopy.user = new User(tenantId, {id: oldTransactionModel.userID});
    const transaction = this.resetTransaction(tenantId, oldTransactionModel);
    const stopPayload = this.getStoppingPayload(oldTransactionModel);
    stopPayload.user = new User(tenantId, {id: stopPayload.userID});
    const consumptions = [];
    let consumptionData = await transaction.startTransaction(transactionCopy.user);
    let amountData = this.computePriceOfConsumption(consumptionData, pricing);
    consumptions.push({...consumptionData, ...amountData, ...stationData});
    meterValues = meterValues.filter(m => this.isConsumptionMeterValue(m) || this.isSocMeterValue(m));
    for (const meterValue of meterValues) {
      amountData = {};
      consumptionData = await transaction.updateWithMeterValue(meterValue);
      if (this.isConsumptionMeterValue(meterValue)) {
        amountData = this.computePriceOfConsumption(consumptionData, pricing);
      }
      const alreadyExistingConsumption = consumptions.find(c => c.endedAt.getTime() === meterValue.timestamp.getTime());
      if (alreadyExistingConsumption) {
        const sameMeterValues = meterValues.filter(m => m.timestamp.getTime() === meterValue.timestamp.getTime()).filter(m => this.isConsumptionMeterValue(m));
        if (sameMeterValues.length > 1 && meterValue.value === 0) {
          continue;
        } else {
          consumptionData = {...alreadyExistingConsumption, ...consumptionData};
          consumptions.splice(consumptions.indexOf(alreadyExistingConsumption), 1);
        }
      }
      consumptions.push({...consumptionData, ...amountData, ...stationData});
    }
    consumptionData = await transaction.stopTransaction(stopPayload.user, stopPayload.tagID, stopPayload.meterStop, stopPayload.timestamp);
    amountData = this.computePriceOfConsumption(consumptionData, pricing);

    consumptions.push({...consumptionData, ...amountData, ...stationData});

    return consumptions;
  }

  isSocMeterValue(meterValue) {
    return meterValue.attribute
      && (meterValue.attribute.context === 'Sample.Periodic'
        || meterValue.attribute.context === 'Transaction.Begin'
        || meterValue.attribute.context === 'Transaction.End')
      && meterValue.attribute.measurand === 'SoC'
  }

  isConsumptionMeterValue(meterValue) {
    return !meterValue.attribute ||
      (meterValue.attribute.measurand === 'Energy.Active.Import.Register'
        && (meterValue.attribute.context === "Sample.Periodic" || meterValue.attribute.context === "Sample.Clock"));
  }

  getVersion() {
    return "1.0";
  }

  getName() {
    return "AddConsumptions";
  }
}

module.exports = AddConsumptions;
