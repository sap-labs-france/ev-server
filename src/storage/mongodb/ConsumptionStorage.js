const Database = require('../../utils/Database');
const Utils = require('../../utils/Utils');
const Logging = require('../../utils/Logging');
const Consumption = require('../../entity/Consumption');

class ConsumptionStorage {

  /**
   *
   * @param tenantID
   * @param consumptionToSave
   * @returns {Promise<Consumption>}
   */
  static async saveConsumption(tenantID, consumptionToSave) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ConsumptionStorage', 'saveConsumption');
    // Check
    await Utils.checkTenant(tenantID);
    // Set the ID
    if (!consumptionToSave.id) {
      consumptionToSave.id = ConsumptionStorage.computeConsumptionId(consumptionToSave);
    }
    // Transfer
    const consumption = {};
    Database.updateConsumption(consumptionToSave, consumption, false);
    // Modify
    const result = await global.database.getCollection(tenantID, 'consumptions').findOneAndUpdate(
      {"_id": consumptionToSave.id},
      {
        $set: consumption
      },
      {upsert: true, new: true, returnOriginal: false});
    // Debug
    Logging.traceEnd('ConsumptionStorage', 'saveConsumption', uniqueTimerID, {consumptionToSave: consumptionToSave});
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

  static computeConsumptionId(consumptionData) {

    const dataId = consumptionData.transactionId + consumptionData.endedAt;

    let hash = 0, i, chr;
    if (dataId.length === 0) return hash;
    for (i = 0; i < dataId.length; i++) {
      chr = dataId.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32bit integer
    }

    return hash > 0 ? hash : hash * -1;
  }

}

module.exports = ConsumptionStorage;
