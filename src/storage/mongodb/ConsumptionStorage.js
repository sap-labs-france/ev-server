const Database = require('../../utils/Database');
const Utils = require('../../utils/Utils');
const Logging = require('../../utils/Logging');
const Consumption = require('../../entity/Consumption');
const ObjectID = require('mongodb').ObjectID;

class ConsumptionStorage {

  /**
   *
   * @param tenantID
   * @param consumptionModel
   * @returns {Promise<Consumption>}
   */
  static async saveConsumption(tenantID, consumptionModel) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ConsumptionStorage', 'saveConsumption');
    // Check
    await Utils.checkTenant(tenantID);

    const previousConsumption = await this.getConsumption(tenantID, consumptionModel.transactionId, consumptionModel.endedAt);
    if (previousConsumption) {
      consumptionModel = {...previousConsumption.getModel(), ...consumptionModel};
    }
    if (consumptionModel.id === undefined) {
      consumptionModel.id = new ObjectID();
    }
    // Transfer
    const consumptionMDB = {};
    Database.updateConsumption(consumptionModel, consumptionMDB, false);
    // Modify
    const result = await global.database.getCollection(tenantID, 'consumptions').findOneAndUpdate(
      {"transactionId": consumptionMDB.transactionId, endedAt: consumptionMDB.endedAt},
      {
        $set: consumptionMDB
      },
      {upsert: true, new: true, returnOriginal: false});
    // Debug
    Logging.traceEnd('ConsumptionStorage', 'saveConsumption', uniqueTimerID, {consumptionToSave: consumptionModel});
    // Return
    return new Consumption(tenantID, result.value);
  }

  static async deleteConsumptions(tenantID, transactionId) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ConsumptionStorage', 'deleteConsumptions');
    // Check
    await Utils.checkTenant(tenantID);
    // Delete
    await global.database.getCollection(tenantID, 'consumptions')
      .deleteMany({'transactionId': transactionId});
    // Debug
    Logging.traceEnd('ConsumptionStorage', 'deleteConsumptions', uniqueTimerID, {transactionId});
  }

  /**
   * Get the unique consumption of a transaction at a given point of time
   * @param tenantID {string}
   * @param transactionId {number}
   * @param timestamp{Date}
   * @returns {Promise<Consumption>}
   */
  static async getConsumption(tenantID, transactionId, endedAt) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ConsumptionStorage', 'getConsumption');
    // Check
    await Utils.checkTenant(tenantID);
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: {
        transactionId: Utils.convertToInt(transactionId),
        endedAt: new Date(endedAt)
      }
    });
    // Read DB
    const consumptionsMDB = await global.database.getCollection(tenantID, 'consumptions')
      .aggregate(aggregation)
      .toArray();
    // Debug
    Logging.traceEnd('ConsumptionStorage', 'getConsumption', uniqueTimerID, {transactionId, endedAt});
    // Found?
    if (consumptionsMDB && consumptionsMDB.length > 0) {
      return new Consumption(tenantID, consumptionsMDB[0]);
    }
    return null;
  }

  /**
   *
   * @param tenantID
   * @param transactionId
   * @returns {Promise<Consumption[]>}
   */
  static async getConsumptions(tenantID, transactionId) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ConsumptionStorage', 'getConsumption');
    // Check
    await Utils.checkTenant(tenantID);
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: {
        transactionId: Utils.convertToInt(transactionId)
      }
    });
    // Read DB
    const consumptionsMDB = await global.database.getCollection(tenantID, 'consumptions')
      .aggregate(aggregation)
      .toArray();
    // Debug
    Logging.traceEnd('ConsumptionStorage', 'getConsumption', uniqueTimerID, {transactionId});
    // Found?
    if (consumptionsMDB && consumptionsMDB.length > 0) {
      return consumptionsMDB.map(c => new Consumption(tenantID, c));
    }
    return null;
  }

}

module.exports = ConsumptionStorage;
