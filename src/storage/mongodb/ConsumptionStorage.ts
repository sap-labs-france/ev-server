import { Point, Simplify, SimplifyTo } from 'curvereduce';
import global, { FilterParams, GroupParams } from '../../types/GlobalType';

import Constants from '../../utils/Constants';
import Consumption from '../../types/Consumption';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import { SiteAreaValueTypes } from '../../types/SiteArea';
import Tenant from '../../types/Tenant';
import { UpdateResult } from 'mongodb';
import Utils from '../../utils/Utils';
import sizeof from 'object-sizeof';

const MODULE_NAME = 'ConsumptionStorage';

export default class ConsumptionStorage {
  public static async updateConsumptionsWithOrganizationIDs(tenant: Tenant, siteID: string, siteAreaID: string): Promise<number> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    const result = await global.database.getCollection<any>(tenant.id, 'consumptions').updateMany(
      {
        siteAreaID: DatabaseUtils.convertToObjectID(siteAreaID),
      },
      {
        $set: {
          siteID: DatabaseUtils.convertToObjectID(siteID),
        }
      }) as UpdateResult;
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'updateConsumptionsWithOrganizationIDs', startTime, { siteID });
    return result.modifiedCount;
  }

  public static async saveConsumption(tenant: Tenant, consumptionToSave: Consumption): Promise<string> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Build
    const consumptionMDB = ConsumptionStorage.buildConsumptionMDB(consumptionToSave);
    // Modify
    await global.database.getCollection<any>(tenant.id, 'consumptions').findOneAndUpdate(
      { '_id': consumptionMDB._id },
      { $set: consumptionMDB },
      { upsert: true });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveConsumption', startTime, consumptionMDB);
    return consumptionMDB._id;
  }

  public static async saveConsumptions(tenant: Tenant, consumptionsToSave: Consumption[]): Promise<string[]> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    const consumptionsMDB = [];
    for (const consumptionToSave of consumptionsToSave) {
      // Build
      const consumptionMDB = ConsumptionStorage.buildConsumptionMDB(consumptionToSave);
      // Add
      consumptionsMDB.push(consumptionMDB);
    }
    // Insert
    await global.database.getCollection<any>(tenant.id, 'consumptions').insertMany(consumptionsMDB);
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveConsumptions', startTime, consumptionsToSave);
    return consumptionsMDB.map((consumptionMDB) => consumptionMDB._id);
  }

  public static async deleteConsumptions(tenant: Tenant, transactionIDs: number[]): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // DeleFte
    await global.database.getCollection<any>(tenant.id, 'consumptions')
      .deleteMany({ 'transactionId': { $in: transactionIDs } });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'deleteConsumptions', startTime, { transactionIDs });
  }

  public static async getAssetConsumptions(tenant: Tenant, params: { assetID: string; startDate: Date; endDate: Date }, projectFields?: string[]): Promise<Consumption[]> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Create filters
    const filters: FilterParams = {};
    // ID
    if (params.assetID) {
      filters.assetID = DatabaseUtils.convertToObjectID(params.assetID);
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
        instantWatts: { $avg: '$instantWatts' },
        instantAmps: { $avg: '$instantAmps' },
        limitWatts: { $last: '$limitSiteAreaWatts' },
        limitAmps: { $last: '$limitSiteAreaAmps' },
        stateOfCharge: { $last: '$stateOfCharge' },
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
    const consumptionsMDB = await global.database.getCollection<any>(tenant.id, 'consumptions')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as Consumption[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getAssetConsumptions', startTime, aggregation, consumptionsMDB);
    return consumptionsMDB;
  }

  public static async getLastAssetConsumption(tenant: Tenant, params: { assetID: string }): Promise<Consumption> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: {
        assetID: DatabaseUtils.convertToObjectID(params.assetID)
      }
    });
    // Sort
    aggregation.push({
      $sort: { startedAt: -1 }
    });
    // Limit
    aggregation.push({
      $limit: 1
    });
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteAreaID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userID');
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Read DB
    const consumptionsMDB = await global.database.getCollection<any>(tenant.id, 'consumptions')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as Consumption[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getLastAssetConsumption', startTime, aggregation, consumptionsMDB);
    return !Utils.isEmptyArray(consumptionsMDB) ? consumptionsMDB[0] : null;
  }

  public static async getSiteAreaConsumptions(tenant: Tenant,
      params: { siteAreaIDs: string[]; startDate: Date; endDate: Date }): Promise<Consumption[]> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Create filters
    const filters: FilterParams = {};
    // ID
    if (!Utils.isEmptyArray(params.siteAreaIDs)) {
      filters.siteAreaID = {
        $in: params.siteAreaIDs.map((siteAreaID) => DatabaseUtils.convertToObjectID(siteAreaID))
      };
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
    // grouping fields
    const groupFields: GroupParams = {
      _id: {
        year: { '$year': '$startedAt' },
        month: { '$month': '$startedAt' },
        day: { '$dayOfMonth': '$startedAt' },
        hour: { '$hour': '$startedAt' },
        minute: { '$minute': '$startedAt' },
        assetID: '$assetID',
        chargeBoxID: '$chargeBoxID',
        connectorID: '$connectorId',
      },
      InstantWattsT: { $avg: '$instantWatts' },
      InstantAmpsT: { $avg: '$instantAmps' },
      LimitWattsT: { $last: '$limitSiteAreaWatts' },
      LimitAmpsT: { $last: '$limitSiteAreaAmps' },
    };
    aggregation.push({
      $group: groupFields
    });
    // add fields
    aggregation.push({
      $addFields: {
        '_id.productionAsset': {
          $and: [{
            $lt: ['$InstantWattsT', 0]
          },{
            $ne: ['$_id.assetID', null]
          }]
        },
        '_id.consumptionAsset': {
          $and: [{
            $gte: ['$InstantWattsT', 0]
          },{
            $ne: ['$_id.assetID', null]
          }]
        },
        '_id.chargingStation': {
          $and: [{
            $ne: ['$_id.chargeBoxID', null]
          },{
            $ne: ['$_id.connectorID', null]
          }]
        }
      }
    });
    const groupFieldsByType: GroupParams = {
      _id: {
        year: '$_id.year',
        month: '$_id.month',
        day: '$_id.day',
        hour: '$_id.hour',
        minute: '$_id.minute',
        productionAsset: '$_id.productionAsset',
        consumptionAsset: '$_id.consumptionAsset',
        chargingStation: '$_id.chargingStation',
      },
      'InstantWattsT': {
        $sum: '$InstantWattsT'
      },
      'InstantAmpsT': {
        $sum: '$InstantAmpsT'
      },
      'LimitWattsT': {
        $last: '$LimitWattsT'
      },
      'LimitAmpsT': {
        $last: '$LimitAmpsT'
      }
    };
    // group based on type
    aggregation.push({
      $group: groupFieldsByType
    });
    aggregation.push({
      $group: {
        _id: {
          year: '$_id.year',
          month: '$_id.month',
          day: '$_id.day',
          hour: '$_id.hour',
          minute: '$_id.minute',
        },
        [SiteAreaValueTypes.ASSET_CONSUMPTION_WATTS]: {
          $sum: {
            $cond: [
              { $eq: ['$_id.consumptionAsset', true] },
              '$InstantWattsT',
              0
            ]
          }
        },
        [SiteAreaValueTypes.ASSET_CONSUMPTION_AMPS]: {
          $sum: {
            $cond: [
              { $eq: ['$_id.consumptionAsset', true] },
              '$InstantAmpsT',
              0
            ]
          }
        },
        [SiteAreaValueTypes.ASSET_PRODUCTION_WATTS]: {
          $sum: {
            $cond: [
              { $eq: ['$_id.productionAsset', true] },
              '$InstantWattsT',
              0
            ]
          }
        },
        [SiteAreaValueTypes.ASSET_PRODUCTION_AMPS]: {
          $sum: {
            $cond: [
              { $eq: ['$_id.productionAsset', true] },
              '$InstantAmpsT',
              0
            ]
          }
        },
        [SiteAreaValueTypes.CHARGING_STATION_CONSUMPTION_WATTS]: {
          $sum: {
            $cond: [
              { $eq: ['$_id.chargingStation', true] },
              '$InstantWattsT',
              0
            ]
          }
        },
        [SiteAreaValueTypes.CHARGING_STATION_CONSUMPTION_AMPS]: {
          $sum: {
            $cond: [
              { $eq: ['$_id.chargingStation', true] },
              '$InstantAmpsT',
              0
            ]
          }
        },
        'limitWatts': {
          $last: '$LimitWattsT'
        },
        'limitAmps': {
          $last: '$LimitAmpsT'
        }
      }
    });
    aggregation.push({
      $addFields: {
        startedAt: {
          $dateFromParts: { 'year': '$_id.year', 'month': '$_id.month', 'day': '$_id.day', 'hour': '$_id.hour', 'minute': '$_id.minute' }
        },
        [SiteAreaValueTypes.NET_CONSUMPTION_WATTS]: {
          $sum: ['$' + SiteAreaValueTypes.ASSET_CONSUMPTION_WATTS, '$' + SiteAreaValueTypes.ASSET_PRODUCTION_WATTS, '$' + SiteAreaValueTypes.CHARGING_STATION_CONSUMPTION_WATTS]
        },
        [SiteAreaValueTypes.NET_CONSUMPTION_AMPS]: {
          $sum: ['$' + SiteAreaValueTypes.ASSET_CONSUMPTION_AMPS, '$' + SiteAreaValueTypes.ASSET_PRODUCTION_AMPS, '$' + SiteAreaValueTypes.CHARGING_STATION_CONSUMPTION_AMPS]
        }
      }
    });
    aggregation.push({
      $sort: {
        startedAt: 1
      }
    });
    aggregation.push({
      $project: {
        _id: 0
      }
    });
    // Read DB
    const consumptionsMDB = await global.database.getCollection<any>(tenant.id, 'consumptions')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as Consumption[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getSiteAreaConsumptions', startTime, aggregation, consumptionsMDB);
    return consumptionsMDB;
  }

  public static async getSiteAreaChargingStationConsumptions(tenant: Tenant,
      params: { siteAreaID: string; startDate: Date; endDate: Date }, dbParams: DbParams = Constants.DB_PARAMS_MAX_LIMIT,
      projectFields?: string[]): Promise<DataResult<Consumption>> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Sort
    if (!dbParams.sort) {
      dbParams.sort = { endedAt: 1 };
    }
    // Create Aggregation
    const aggregation = [];
    // Create filters
    const filters: FilterParams = {};
    // ID
    if (params.siteAreaID) {
      filters.siteAreaID = DatabaseUtils.convertToObjectID(params.siteAreaID);
    }
    // Date provided?
    if (params.startDate || params.endDate) {
      filters.endedAt = {};
    }
    // Start date
    if (params.startDate) {
      filters.endedAt.$gte = Utils.convertToDate(params.startDate);
    }
    // End date
    if (params.endDate) {
      filters.endedAt.$lte = Utils.convertToDate(params.endDate);
    }
    // Check that charging station is set
    filters.chargeBoxID = { '$ne': null };
    // Filters
    if (filters) {
      aggregation.push({
        $match: filters
      });
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
    // Group consumption values per minute
    aggregation.push({
      $group: {
        _id: {
          year: { '$year': '$endedAt' },
          month: { '$month': '$endedAt' },
          day: { '$dayOfMonth': '$endedAt' },
          hour: { '$hour': '$endedAt' },
          minute: { '$minute': '$endedAt' }
        },
        instantWatts: { $sum: '$instantWatts' },
        instantWattsL1: { $sum: '$instantWattsL1' },
        instantWattsL2: { $sum: '$instantWattsL2' },
        instantWattsL3: { $sum: '$instantWattsL3' },
        instantAmps: { $sum: '$instantAmps' },
        limitWatts: { $last: '$limitSiteAreaWatts' },
        limitAmps: { $last: '$limitSiteAreaAmps' }
      }
    });
    // Rebuild the date
    aggregation.push({
      $addFields: {
        endedAt: {
          $dateFromParts: { 'year': '$_id.year', 'month': '$_id.month', 'day': '$_id.day', 'hour': '$_id.hour', 'minute': '$_id.minute' }
        }
      }
    });
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields, ['_id']);
    // Read DB
    const consumptionsMDB = await global.database.getCollection<any>(tenant.id, 'consumptions')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as Consumption[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getSiteAreaChargingStationConsumptions', startTime, aggregation, consumptionsMDB);
    return {
      count: consumptionsMDB.length,
      result: consumptionsMDB
    };
  }

  public static async getTransactionConsumptions(tenant: Tenant, params: { transactionId: number },
      dbParams: DbParams = Constants.DB_PARAMS_MAX_LIMIT, projectFields?: string[]): Promise<DataResult<Consumption>> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
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
    const consumptionsMDB = await global.database.getCollection<any>(tenant.id, 'consumptions')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as Consumption[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getTransactionConsumptions', startTime, aggregation, consumptionsMDB);
    return {
      count: consumptionsMDB.length,
      result: consumptionsMDB
    };
  }

  public static async getOptimizedTransactionConsumptions(tenant: Tenant, params: { transactionId: number }, projectFields?: string[]): Promise<DataResult<Consumption>> {
    // Get all consumptions
    const consumptionsMDB = await ConsumptionStorage.getTransactionConsumptions(
      tenant, params, Constants.DB_PARAMS_MAX_LIMIT, projectFields);
    const startTime = Logging.traceDatabaseRequestStart();
    // Optimize the curves
    // Create the Points
    const consumptionsXY: Point[] = consumptionsMDB.result.map((consumptionMDB) => (
      {
        x: consumptionMDB.endedAt.getTime(),
        // Convert Watts to kWatts to have the same proportion as the amount to detect the variation
        y:
          (consumptionMDB.instantWatts ?? 0) / 1000 +
          (consumptionMDB.instantWattsDC ?? 0) / 1000 +
          (consumptionMDB.limitWatts ?? 0) / 1000 +
          (consumptionMDB.cumulatedAmount ?? 0) +
          (consumptionMDB.cumulatedConsumptionWh ?? 0) / 1000
      }
    ));
    // Simplify with Ramer Douglas Peucker algo
    const simplifiedConsumptionsXY = Simplify(consumptionsXY, 1);
    // Create a Map to reference Y points
    const simplifiedConsumptionsMapXY = new Map<number, null>();
    for (const simplifiedConsumptionXY of simplifiedConsumptionsXY) {
      simplifiedConsumptionsMapXY.set(simplifiedConsumptionXY.x, null);
    }
    // Filter Consumptions
    consumptionsMDB.result = consumptionsMDB.result.filter((consumptionMDB) =>
      simplifiedConsumptionsMapXY.has(consumptionMDB.endedAt.getTime()));
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getOptimizedTransactionConsumptions', startTime, consumptionsMDB);
    return consumptionsMDB;
  }

  public static async getLastTransactionConsumption(tenant: Tenant, params: { transactionId: number }): Promise<Consumption> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
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
    const consumptionsMDB = await global.database.getCollection<any>(tenant.id, 'consumptions')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as Consumption[];
    if (!Utils.isEmptyArray(consumptionsMDB)) {
      consumption = consumptionsMDB[0];
    }
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getLastTransactionConsumption', startTime, aggregation, consumptionsMDB);
    return consumption;
  }

  private static buildConsumptionMDB(consumption: Consumption): any {
    // Set the ID
    if (!consumption.id) {
      const timestamp = Utils.convertToDate(consumption.endedAt);
      if (consumption.transactionId) {
        consumption.id = Utils.hash(`${consumption.transactionId}~${timestamp.toISOString()}`);
      } else if (consumption.assetID) {
        consumption.id = Utils.hash(`${consumption.assetID}~${timestamp.toISOString()}`);
      } else {
        throw new Error('Consumption cannot be saved: no Transaction ID or Asset ID provided');
      }
    }
    return {
      _id: consumption.id,
      startedAt: Utils.convertToDate(consumption.startedAt),
      endedAt: Utils.convertToDate(consumption.endedAt),
      transactionId: Utils.convertToInt(consumption.transactionId),
      chargeBoxID: consumption.chargeBoxID,
      connectorId: Utils.convertToInt(consumption.connectorId),
      siteAreaID: DatabaseUtils.convertToObjectID(consumption.siteAreaID),
      siteID: DatabaseUtils.convertToObjectID(consumption.siteID),
      assetID: DatabaseUtils.convertToObjectID(consumption.assetID),
      consumptionWh: Utils.convertToFloat(consumption.consumptionWh),
      consumptionAmps: Utils.convertToFloat(consumption.consumptionAmps),
      cumulatedAmount: Utils.convertToFloat(consumption.cumulatedAmount),
      cumulatedConsumptionWh: Utils.convertToFloat(consumption.cumulatedConsumptionWh),
      cumulatedConsumptionAmps: Utils.convertToFloat(consumption.cumulatedConsumptionAmps),
      pricingSource: consumption.pricingSource,
      amount: Utils.convertToFloat(consumption.amount),
      roundedAmount: Utils.convertToFloat(consumption.roundedAmount),
      currencyCode: consumption.currencyCode,
      instantWatts: Utils.convertToFloat(consumption.instantWatts),
      instantWattsL1: Utils.convertToFloat(consumption.instantWattsL1),
      instantWattsL2: Utils.convertToFloat(consumption.instantWattsL2),
      instantWattsL3: Utils.convertToFloat(consumption.instantWattsL3),
      instantWattsDC: Utils.convertToFloat(consumption.instantWattsDC),
      instantAmps: Utils.convertToFloat(consumption.instantAmps),
      instantAmpsL1: Utils.convertToFloat(consumption.instantAmpsL1),
      instantAmpsL2: Utils.convertToFloat(consumption.instantAmpsL2),
      instantAmpsL3: Utils.convertToFloat(consumption.instantAmpsL3),
      instantAmpsDC: Utils.convertToFloat(consumption.instantAmpsDC),
      instantVolts: Utils.convertToFloat(consumption.instantVolts),
      instantVoltsL1: Utils.convertToFloat(consumption.instantVoltsL1),
      instantVoltsL2: Utils.convertToFloat(consumption.instantVoltsL2),
      instantVoltsL3: Utils.convertToFloat(consumption.instantVoltsL3),
      instantVoltsDC: Utils.convertToFloat(consumption.instantVoltsDC),
      inactivitySecs: Utils.convertToInt(consumption.inactivitySecs),
      totalInactivitySecs: Utils.convertToInt(consumption.totalInactivitySecs),
      totalDurationSecs: Utils.convertToInt(consumption.totalDurationSecs),
      stateOfCharge: !Utils.isNullOrUndefined(consumption.stateOfCharge) ? Utils.convertToInt(consumption.stateOfCharge) : null,
      limitAmps: Utils.convertToInt(consumption.limitAmps),
      limitWatts: Utils.convertToInt(consumption.limitWatts),
      limitSource: consumption.limitSource,
      userID: DatabaseUtils.convertToObjectID(consumption.userID),
      smartChargingActive: Utils.convertToBoolean(consumption.smartChargingActive),
      limitSiteAreaWatts: consumption.limitSiteAreaWatts ? Utils.convertToInt(consumption.limitSiteAreaWatts) : null,
      limitSiteAreaAmps: consumption.limitSiteAreaAmps ? Utils.convertToInt(consumption.limitSiteAreaAmps) : null,
      limitSiteAreaSource: consumption.limitSiteAreaSource ? consumption.limitSiteAreaSource : null,
    };
  }
}
