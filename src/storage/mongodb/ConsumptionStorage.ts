import Database from '../../utils/Database';
import Utils from '../../utils/Utils';
import Logging from '../../utils/Logging';
import Consumption from '../../entity/Consumption';
import crypto from 'crypto';
import global from '../../types/GlobalType';


export default class ConsumptionStorage {
  static async saveConsumption(tenantID, consumptionToSave) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ConsumptionStorage', 'saveConsumption');
    // Check
    await Utils.checkTenant(tenantID);
    // Set the ID
    if (!consumptionToSave.id) {
      // Set the ID
      const timestamp = Utils.convertToDate(consumptionToSave.endedAt);
      consumptionToSave.id = crypto.createHash('sha256')
        .update(`${consumptionToSave.transactionId}~${timestamp.toISOString()}`)
        .digest("hex");
    }
    // Transfer
    const consumption: any = {};
    Database.updateConsumption(consumptionToSave, consumption, false);
    // Modify
    const result = await global.database.getCollection<any>(tenantID, 'consumptions').findOneAndUpdate(
      { "_id": consumptionToSave.id },
      {
        $set: consumption
      },
      { upsert: true, returnOriginal: false });
    // Debug
    Logging.traceEnd('ConsumptionStorage', 'saveConsumption', uniqueTimerID, { consumptionToSave: consumptionToSave });
    // Return
    return new Consumption(tenantID, result.value);
  }

  static async deleteConsumptions(tenantID, transactionId) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ConsumptionStorage', 'deleteConsumptions');
    // Check
    await Utils.checkTenant(tenantID);
    // Delete
    await global.database.getCollection<any>(tenantID, 'consumptions')
      .deleteMany({ 'transactionId': transactionId });
    // Debug
    Logging.traceEnd('ConsumptionStorage', 'deleteConsumptions', uniqueTimerID, { transactionId });
  }

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
    const consumptionsMDB = await global.database.getCollection<any>(tenantID, 'consumptions')
      .aggregate(aggregation, { allowDiskUse: true })
      .toArray();
    // Debug
    Logging.traceEnd('ConsumptionStorage', 'getConsumption', uniqueTimerID, { transactionId, endedAt });
    // Found?
    if (consumptionsMDB && consumptionsMDB.length > 0) {
      return new Consumption(tenantID, consumptionsMDB[0]);
    }
    return null;
  }

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
    // Triming excess values
    aggregation.push({
      $group: {
        _id: {
          cumulatedConsumption: "$cumulatedConsumption",
          consumption: "$consumption",
          cumulatedAmount: "$cumulatedAmount"
        },
        userID: { $last: "$userID" },
        chargeBoxID: { $last: "$chargeBoxID" },
        siteID: { $last: "$siteID" },
        siteAreaID: { $last: "$siteAreaID" },
        connectorId: { $last: "$connectorId" },
        transactionId: { $last: "$transactionId" },
        endedAt: { $max: "$endedAt" },
        startedAt: { $min: "$startedAt" },
        cumulatedConsumption: { $last: "$cumulatedConsumption" },
        consumption: { $last: "$consumption" },
        stateOfCharge: { $last: "$stateOfCharge" },
        instantPower: { $max: "$instantPower" },
        totalInactivitySecs: { $max: "$totalInactivitySecs" },
        pricingSource: { $last: "$pricingSource" },
        amount: { $last: "$amount" },
        cumulatedAmount: { $last: "$cumulatedAmount" },
        roundedAmount: { $last: "$roundedAmount" },
        currencyCode: { $last: "$currencyCode" }
      }
    });
    // Sort values
    aggregation.push({ $sort: { endedAt: 1 } });
    // Read DB
    const consumptionsMDB = await global.database.getCollection<any>(tenantID, 'consumptions')
      .aggregate(aggregation, { allowDiskUse: true })
      .toArray();
    // Debug
    Logging.traceEnd('ConsumptionStorage', 'getConsumption', uniqueTimerID, { transactionId });
    // Found?
    if (consumptionsMDB && consumptionsMDB.length > 0) {
      return consumptionsMDB.map((c) => {
        return new Consumption(tenantID, c);
      });
    }
    return null;
  }
}
