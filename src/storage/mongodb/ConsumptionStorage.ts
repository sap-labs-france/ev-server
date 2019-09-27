import Cypher from '../../utils/Cypher';
import global from '../../types/GlobalType';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import Consumption from '../../types/Consumption';
import DatabaseUtils from './DatabaseUtils';

export default class ConsumptionStorage {
  static async saveConsumption(tenantID: string, consumptionToSave: Consumption): Promise<string> {
    // Debug
    const uniqueTimerID = Logging.traceStart('ConsumptionStorage', 'saveConsumption');
    // Check
    await Utils.checkTenant(tenantID);
    // Set the ID
    if (!consumptionToSave.id) {
      // Set the ID
      const timestamp = Utils.convertToDate(consumptionToSave.endedAt);
      consumptionToSave.id = Cypher.hash(`${consumptionToSave.transactionId}~${timestamp.toISOString()}`);
    }
    // Transfer
    const consumptionMDB: any = {
      _id: consumptionToSave.id,
      startedAt: Utils.convertToDate(consumptionToSave.startedAt),
      endedAt: Utils.convertToDate(consumptionToSave.endedAt),
      transactionId: Utils.convertToInt(consumptionToSave.transactionId),
      chargeBoxID: consumptionToSave.chargeBoxID,
      connectorId: Utils.convertToInt(consumptionToSave.connectorId),
      siteAreaID: consumptionToSave.siteAreaID,
      siteID: consumptionToSave.siteID,
      consumption: Utils.convertToFloat(consumptionToSave.consumption),
      cumulatedAmount: Utils.convertToFloat(consumptionToSave.cumulatedAmount),
      cumulatedConsumption: Utils.convertToFloat(consumptionToSave.cumulatedConsumption),
      pricingSource: consumptionToSave.pricingSource,
      amount: Utils.convertToFloat(consumptionToSave.amount),
      roundedAmount: Utils.convertToFloat(consumptionToSave.roundedAmount),
      currencyCode: consumptionToSave.currencyCode,
      instantPower: Utils.convertToFloat(consumptionToSave.instantPower),
      totalInactivitySecs: Utils.convertToInt(consumptionToSave.totalInactivitySecs),
      totalDurationSecs: Utils.convertToInt(consumptionToSave.totalDurationSecs),
      stateOfCharge: Utils.convertToInt(consumptionToSave.stateOfCharge),
      userID: consumptionToSave.userID
    };
    // Modify
    const result = await global.database.getCollection<any>(tenantID, 'consumptions').findOneAndUpdate(
      { '_id': consumptionMDB._id },
      { $set: consumptionMDB },
      { upsert: true });
    // Debug
    Logging.traceEnd('ConsumptionStorage', 'saveConsumption', uniqueTimerID, { consumptionToSave: consumptionToSave });
    // Return
    return consumptionMDB._id;
  }

  static async deleteConsumptions(tenantID: string, transactionId: number): Promise<void> {
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

  static async getConsumptions(tenantID: string, params: { transactionId: number }): Promise<Consumption[]> {
    // Debug
    const uniqueTimerID = Logging.traceStart('ConsumptionStorage', 'getConsumption');
    // Check
    await Utils.checkTenant(tenantID);
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: {
        transactionId: Utils.convertToInt(params.transactionId)
      }
    });
    // Triming excess values
    aggregation.push({
      $group: {
        _id: {
          cumulatedConsumption: '$cumulatedConsumption',
          consumption: '$consumption',
          cumulatedAmount: '$cumulatedAmount'
        },
        userID: { $last: '$userID' },
        chargeBoxID: { $last: '$chargeBoxID' },
        siteID: { $last: '$siteID' },
        siteAreaID: { $last: '$siteAreaID' },
        connectorId: { $last: '$connectorId' },
        transactionId: { $last: '$transactionId' },
        endedAt: { $max: '$endedAt' },
        startedAt: { $min: '$startedAt' },
        cumulatedConsumption: { $last: '$cumulatedConsumption' },
        consumption: { $last: '$consumption' },
        stateOfCharge: { $last: '$stateOfCharge' },
        instantPower: { $max: '$instantPower' },
        totalInactivitySecs: { $max: '$totalInactivitySecs' },
        pricingSource: { $last: '$pricingSource' },
        amount: { $last: '$amount' },
        cumulatedAmount: { $last: '$cumulatedAmount' },
        roundedAmount: { $last: '$roundedAmount' },
        currencyCode: { $last: '$currencyCode' }
      }
    });
    // Convert Object ID to string
    DatabaseUtils.convertObjectIDToString(aggregation, 'siteAreaID');
    DatabaseUtils.convertObjectIDToString(aggregation, 'siteID');
    DatabaseUtils.convertObjectIDToString(aggregation, 'userID');
    // Sort
    aggregation.push({ $sort: { endedAt: 1 } });
    // Read DB
    const consumptionsMDB = await global.database.getCollection<any>(tenantID, 'consumptions')
      .aggregate(aggregation, { allowDiskUse: true })
      .toArray();
    // Debug
    Logging.traceEnd('ConsumptionStorage', 'getConsumption', uniqueTimerID, { transactionId: params.transactionId });
    return consumptionsMDB;
  }
}
