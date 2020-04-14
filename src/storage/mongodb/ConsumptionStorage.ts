import Consumption from '../../types/Consumption';
import Cypher from '../../utils/Cypher';
import Logging from '../../utils/Logging';
import { SiteAreaConsumptionValues } from '../../types/SiteArea';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'ConsumptionStorage';

export default class ConsumptionStorage {
  static async saveConsumption(tenantID: string, consumptionToSave: Consumption): Promise<string> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'saveConsumption');
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
      limitAmps: Utils.convertToInt(consumptionToSave.limitAmps),
      limitWatts: Utils.convertToInt(consumptionToSave.limitWatts),
      limitSource: consumptionToSave.limitSource,
      userID: consumptionToSave.userID
    };
    // Modify
    const result = await global.database.getCollection<any>(tenantID, 'consumptions').findOneAndUpdate(
      { '_id': consumptionMDB._id },
      { $set: consumptionMDB },
      { upsert: true });
    // Debug
    Logging.traceEnd(MODULE_NAME, 'saveConsumption', uniqueTimerID, { consumptionToSave: consumptionToSave });
    // Return
    return consumptionMDB._id;
  }

  static async deleteConsumptions(tenantID: string, transactionIDs: number[]): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'deleteConsumptions');
    // Check
    await Utils.checkTenant(tenantID);
    // DeleFte
    await global.database.getCollection<any>(tenantID, 'consumptions')
      .deleteMany({ 'transactionId': { $in: transactionIDs } });
    // Debug
    Logging.traceEnd(MODULE_NAME, 'deleteConsumptions', uniqueTimerID, { transactionIDs });
  }

  static async getSiteAreaConsumption(tenantID: string, params: { siteAreaId: string; startDate: Date; endDate: Date }): Promise<SiteAreaConsumptionValues[]> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getSiteAreaConsumption');
    // Check
    await Utils.checkTenant(tenantID);
    // Create filters
    const filters: any = {};
    // ID
    if (params.siteAreaId) {
      filters.siteAreaID = params.siteAreaId;
    }
    // Date provided?
    if (params.startDate || params.endDate) {
      filters.startedAt = {};
    }
    // Start date
    if (params.startDate) {
      filters.startedAt.$gte = Utils.convertToDate(params.startDate);
    }
    // End date
    if (params.endDate) {
      filters.startedAt.$lte = Utils.convertToDate(params.endDate);
    }
    // Create Aggregation
    const aggregation = [];
    // Filters
    if (filters) {
      aggregation.push({
        $match: filters
      });
    }
    // Group consumption values per minute
    aggregation.push({
      $group: {
        _id: {
          year: { '$year': '$startedAt' },
          month: { '$month': '$startedAt' },
          day: { '$dayOfMonth': '$startedAt' },
          hour: { '$hour': '$startedAt' },
          minute: { '$minute': '$startedAt' }
        },
        instantPower: { $sum: '$instantPower' },
      }
    });
    // Rebuild the date
    aggregation.push({
      $addFields: {
        date: {
          $dateFromParts: { 'year' : '$_id.year', 'month' : '$_id.month', 'day': '$_id.day', 'hour': '$_id.hour', 'minute': '$_id.minute' }
        }
      }
    });
    aggregation.push({
      $sort: {
        date: 1
      }
    });
    // Read DB
    const consumptionsMDB = await global.database.getCollection<any>(tenantID, 'consumptions')
      .aggregate(...aggregation, { allowDiskUse: true })
      .toArray();
    // Debug
    Logging.traceEnd(MODULE_NAME, 'getSiteAreaConsumption', uniqueTimerID, { siteAreaId: params.siteAreaId });
    return consumptionsMDB;
  }

  static async getConsumptions(tenantID: string, params: { transactionId: number }): Promise<Consumption[]> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getConsumption');
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
    aggregation.push({
      $addFields: {
        roundedInstantPower: { $round: [{ $divide: ['$instantPower', 100] }] }
      }
    });
    // Triming excess values
    aggregation.push({
      $group: {
        _id: {
          roundedInstantPower: '$roundedInstantPower',
          limitWatts: '$limitWatts'
        },
        consumptions: { $push: '$$ROOT' }
      }
    });
    aggregation.push({
      $sort: { 'consumptions.startedAt': 1 }
    });
    // Read DB
    const consumptionsMDB = await global.database.getCollection<any>(tenantID, 'consumptions')
      .aggregate(aggregation, { allowDiskUse: true })
      .toArray();
    // Do the optimization in the code!!!
    const consumptions: Consumption[] = [];
    for (const consumptionMDB of consumptionsMDB) {
      let lastConsumption: Consumption = null;
      let lastConsumtionRemoved = false;
      // Simplify grouped consumption
      for (let i = 0; i <= consumptionMDB.consumptions.length - 3; i++) {
        if (!lastConsumption) {
          lastConsumption = consumptionMDB.consumptions[i];
        }
        if (lastConsumption.endedAt.getTime() === consumptionMDB.consumptions[i + 1].startedAt.getTime()) {
          // Remove
          lastConsumption = consumptionMDB.consumptions[i + 1];
          consumptionMDB.consumptions.splice(i + 1, 1);
          lastConsumtionRemoved = true;
          i--;
        } else {
          // Insert the last consumption before it changes
          if (lastConsumtionRemoved) {
            consumptionMDB.consumptions.splice(i, 0, lastConsumption);
            lastConsumtionRemoved = false;
            i++;
          }
          lastConsumption = consumptionMDB.consumptions[i + 1];
        }
      }
      // Unwind
      for (const consumption of consumptionMDB.consumptions) {
        consumptions.push(consumption);
      }
    }
    // Sort
    consumptions.sort((cons1, cons2) => cons1.endedAt.getTime() - cons2.endedAt.getTime());
    // Debug
    Logging.traceEnd(MODULE_NAME, 'getConsumption', uniqueTimerID, { transactionId: params.transactionId });
    return consumptions;
  }
}
