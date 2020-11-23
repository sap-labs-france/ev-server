import global, { FilterParams } from '../../types/GlobalType';

import Constants from '../../utils/Constants';
import Consumption from '../../types/Consumption';
import Cypher from '../../utils/Cypher';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'ConsumptionStorage';

export default class ConsumptionStorage {
  static async saveConsumption(tenantID: string, consumptionToSave: Consumption): Promise<string> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'saveConsumption');
    // Check
    await Utils.checkTenant(tenantID);
    // Set the ID
    if (!consumptionToSave.id) {
      const timestamp = Utils.convertToDate(consumptionToSave.endedAt);
      if (consumptionToSave.transactionId) {
        consumptionToSave.id = Cypher.hash(`${consumptionToSave.transactionId}~${timestamp.toISOString()}`);
      } else if (consumptionToSave.assetID) {
        consumptionToSave.id = Cypher.hash(`${consumptionToSave.assetID}~${timestamp.toISOString()}`);
      } else {
        throw new Error('Consumption cannot be saved: no Transaction ID or Asset ID provided');
      }
    }
    // Transfer
    const consumptionMDB: any = {
      _id: consumptionToSave.id,
      startedAt: Utils.convertToDate(consumptionToSave.startedAt),
      endedAt: Utils.convertToDate(consumptionToSave.endedAt),
      transactionId: Utils.convertToInt(consumptionToSave.transactionId),
      chargeBoxID: consumptionToSave.chargeBoxID,
      connectorId: Utils.convertToInt(consumptionToSave.connectorId),
      siteAreaID: Utils.convertToObjectID(consumptionToSave.siteAreaID),
      siteID: Utils.convertToObjectID(consumptionToSave.siteID),
      assetID: Utils.convertToObjectID(consumptionToSave.assetID),
      consumptionWh: Utils.convertToFloat(consumptionToSave.consumptionWh),
      consumptionAmps: Utils.convertToFloat(consumptionToSave.consumptionAmps),
      cumulatedAmount: Utils.convertToFloat(consumptionToSave.cumulatedAmount),
      cumulatedConsumptionWh: Utils.convertToFloat(consumptionToSave.cumulatedConsumptionWh),
      cumulatedConsumptionAmps: Utils.convertToFloat(consumptionToSave.cumulatedConsumptionAmps),
      pricingSource: consumptionToSave.pricingSource,
      amount: Utils.convertToFloat(consumptionToSave.amount),
      roundedAmount: Utils.convertToFloat(consumptionToSave.roundedAmount),
      currencyCode: consumptionToSave.currencyCode,
      instantWatts: Utils.convertToFloat(consumptionToSave.instantWatts),
      instantWattsL1: Utils.convertToFloat(consumptionToSave.instantWattsL1),
      instantWattsL2: Utils.convertToFloat(consumptionToSave.instantWattsL2),
      instantWattsL3: Utils.convertToFloat(consumptionToSave.instantWattsL3),
      instantWattsDC: Utils.convertToFloat(consumptionToSave.instantWattsDC),
      instantAmps: Utils.convertToFloat(consumptionToSave.instantAmps),
      instantAmpsL1: Utils.convertToFloat(consumptionToSave.instantAmpsL1),
      instantAmpsL2: Utils.convertToFloat(consumptionToSave.instantAmpsL2),
      instantAmpsL3: Utils.convertToFloat(consumptionToSave.instantAmpsL3),
      instantAmpsDC: Utils.convertToFloat(consumptionToSave.instantAmpsDC),
      instantVolts: Utils.convertToFloat(consumptionToSave.instantVolts),
      instantVoltsL1: Utils.convertToFloat(consumptionToSave.instantVoltsL1),
      instantVoltsL2: Utils.convertToFloat(consumptionToSave.instantVoltsL2),
      instantVoltsL3: Utils.convertToFloat(consumptionToSave.instantVoltsL3),
      instantVoltsDC: Utils.convertToFloat(consumptionToSave.instantVoltsDC),
      totalInactivitySecs: Utils.convertToInt(consumptionToSave.totalInactivitySecs),
      totalDurationSecs: Utils.convertToInt(consumptionToSave.totalDurationSecs),
      stateOfCharge: Utils.convertToInt(consumptionToSave.stateOfCharge),
      limitAmps: Utils.convertToInt(consumptionToSave.limitAmps),
      limitWatts: Utils.convertToInt(consumptionToSave.limitWatts),
      limitSource: consumptionToSave.limitSource,
      userID: Utils.convertToObjectID(consumptionToSave.userID),
      smartChargingActive: Utils.convertToBoolean(consumptionToSave.smartChargingActive),
      limitSiteAreaWatts: consumptionToSave.limitSiteAreaWatts ? Utils.convertToInt(consumptionToSave.limitSiteAreaWatts) : null,
      limitSiteAreaAmps: consumptionToSave.limitSiteAreaAmps ? Utils.convertToInt(consumptionToSave.limitSiteAreaAmps) : null,
      limitSiteAreaSource: consumptionToSave.limitSiteAreaSource ? consumptionToSave.limitSiteAreaSource : null,
    };
    // Modify
    await global.database.getCollection<any>(tenantID, 'consumptions').findOneAndUpdate(
      { '_id': consumptionMDB._id },
      { $set: consumptionMDB },
      { upsert: true });
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'saveConsumption', uniqueTimerID, consumptionMDB);
    // Return
    return consumptionMDB._id;
  }

  static async deleteConsumptions(tenantID: string, transactionIDs: number[]): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'deleteConsumptions');
    // Check
    await Utils.checkTenant(tenantID);
    // DeleFte
    await global.database.getCollection<any>(tenantID, 'consumptions')
      .deleteMany({ 'transactionId': { $in: transactionIDs } });
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'deleteConsumptions', uniqueTimerID, { transactionIDs });
  }

  static async getAssetConsumptions(tenantID: string, params: { assetID: string; startDate: Date; endDate: Date }, projectFields?: string[]): Promise<Consumption[]> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getAssetConsumptions');
    // Check
    await Utils.checkTenant(tenantID);
    // Create filters
    const filters: FilterParams = {};
    // ID
    if (params.assetID) {
      filters.assetID = Utils.convertToObjectID(params.assetID);
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
        instantWatts: { $sum: '$instantWatts' },
        instantAmps: { $sum: '$instantAmps' },
        limitWatts: { $last: '$limitSiteAreaWatts' },
        limitAmps: { $last: '$limitSiteAreaAmps' }
      }
    });
    // Rebuild the date
    aggregation.push({
      $addFields: {
        startedAt: {
          $dateFromParts: { 'year': '$_id.year', 'month': '$_id.month', 'day': '$_id.day', 'hour': '$_id.hour', 'minute': '$_id.minute' }
        }
      }
    });
    // Same date
    aggregation.push({
      $addFields: {
        endedAt: '$startedAt'
      }
    });
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'assetID');
    aggregation.push({
      $sort: {
        startedAt: 1
      }
    });
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const consumptionsMDB = await global.database.getCollection<Consumption>(tenantID, 'consumptions')
      .aggregate(...aggregation, { allowDiskUse: true })
      .toArray();
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'getAssetConsumptions', uniqueTimerID, consumptionsMDB);
    return consumptionsMDB;
  }

  static async getSiteAreaConsumptions(tenantID: string,
    params: { siteAreaID: string; startDate: Date; endDate: Date },
    projectFields?: string[]): Promise<Consumption[]> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getSiteAreaConsumptions');
    // Check
    await Utils.checkTenant(tenantID);
    // Create filters
    const filters: FilterParams = {};
    // ID
    if (params.siteAreaID) {
      filters.siteAreaID = Utils.convertToObjectID(params.siteAreaID);
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
        instantWatts: { $sum: '$instantWatts' },
        instantAmps: { $sum: '$instantAmps' },
        limitWatts: { $last: '$limitSiteAreaWatts' },
        limitAmps: { $last: '$limitSiteAreaAmps' }
      }
    });
    // Rebuild the date
    aggregation.push({
      $addFields: {
        startedAt: {
          $dateFromParts: { 'year': '$_id.year', 'month': '$_id.month', 'day': '$_id.day', 'hour': '$_id.hour', 'minute': '$_id.minute' }
        }
      }
    });
    // Same date
    aggregation.push({
      $addFields: {
        endedAt: '$startedAt'
      }
    });
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteAreaID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userID');
    aggregation.push({
      $sort: {
        startedAt: 1
      }
    });
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields, ['_id']);
    // Read DB
    const consumptionsMDB = await global.database.getCollection<Consumption>(tenantID, 'consumptions')
      .aggregate(...aggregation, { allowDiskUse: true })
      .toArray();
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'getSiteAreaConsumptions', uniqueTimerID, consumptionsMDB);
    return consumptionsMDB;
  }

  static async getTransactionConsumptions(tenantID: string, params: { transactionId: number },
    dbParams: DbParams = Constants.DB_PARAMS_MAX_LIMIT, projectFields?: string[]): Promise<DataResult<Consumption>> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getTransactionConsumptions');
    // Check
    await Utils.checkTenant(tenantID);
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: {
        transactionId: Utils.convertToInt(params.transactionId)
      }
    });
    // TODO: To remove when new version of Mobile App will be released (> V1.3.22)
    aggregation.push({
      $addFields: { date: '$startedAt' }
    });
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteAreaID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userID');
    // Sort
    if (!dbParams.sort) {
      dbParams.sort = { startedAt: 1 };
    }
    aggregation.push({
      $sort: dbParams.sort
    });
    // Skip
    aggregation.push({
      $skip: dbParams.skip
    });
    // Limit
    aggregation.push({
      $limit: dbParams.limit
    });
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const consumptionsMDB = await global.database.getCollection<Consumption>(tenantID, 'consumptions')
      .aggregate(aggregation, { allowDiskUse: true })
      .toArray();
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'getTransactionConsumptions', uniqueTimerID, consumptionsMDB);
    return {
      count: consumptionsMDB.length,
      result: consumptionsMDB
    };
  }

  static async getLastTransactionConsumption(tenantID: string, params: { transactionId: number }): Promise<Consumption> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getLastTransactionConsumption');
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
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteAreaID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userID');
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Sort
    aggregation.push({
      $sort: { startedAt: -1 }
    });
    // Limit
    aggregation.push({
      $limit: 1
    });
    let consumption: Consumption = null;
    // Read DB
    const consumptionsMDB = await global.database.getCollection<Consumption>(tenantID, 'consumptions')
      .aggregate(aggregation, { allowDiskUse: true })
      .toArray();
    if (consumptionsMDB && consumptionsMDB.length > 0) {
      consumption = consumptionsMDB[0];
    }
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'getLastTransactionConsumption', uniqueTimerID, consumptionsMDB);
    return consumption;
  }

  static async getOptimizedTransactionConsumptions(tenantID: string, params: { transactionId: number }, projectFields?: string[]): Promise<Consumption[]> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getOptimizedTransactionConsumptions');
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
      $addFields: { roundedInstantPower: { $round: [{ $divide: ['$instantWatts', 100] }] } }
    });
    // TODO: To remove when new version of Mobile App will be released (> V1.3.22)
    aggregation.push({
      $addFields: { date: '$startedAt' }
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
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteAreaID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userID');
    aggregation.push({
      $sort: { 'consumptions.startedAt': 1 }
    });
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const consumptionsMDB = await global.database.getCollection<any>(tenantID, 'consumptions')
      .aggregate(aggregation, { allowDiskUse: true })
      .toArray();
    // TODO: Handle this coding into MongoDB request
    const consumptions: Consumption[] = [];
    for (const consumptionMDB of consumptionsMDB) {
      let lastConsumption: Consumption = null;
      let lastConsumtionRemoved = false;
      // Simplify grouped consumption
      for (let i = 0; i <= consumptionMDB.consumptions.length - 3; i++) {
        if (!lastConsumption) {
          lastConsumption = consumptionMDB.consumptions[i];
        }
        if (lastConsumption.endedAt && consumptionMDB.consumptions[i + 1].startedAt &&
            lastConsumption.endedAt.getTime() === consumptionMDB.consumptions[i + 1].startedAt.getTime()) {
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
    Logging.traceEnd(tenantID, MODULE_NAME, 'getOptimizedTransactionConsumptions', uniqueTimerID, consumptions);
    return consumptions;
  }
}
