import global, { FilterParams } from '../../types/GlobalType';

import Constants from '../../utils/Constants';
import DatabaseUtils from './DatabaseUtils';
import { DeletedResult } from '../../types/DataResult';
import PerformanceRecord from '../../types/Performance';
import Utils from '../../utils/Utils';

export default class PerformanceStorage {
  public static async savePerformanceRecord(performanceRecord: PerformanceRecord): Promise<void> {
    // Set
    const performanceRecordMDB: any = {
      tenantID: performanceRecord.tenantID && performanceRecord.tenantID !== Constants.DEFAULT_TENANT ?
        DatabaseUtils.convertToObjectID(performanceRecord.tenantID) : Constants.DEFAULT_TENANT,
      timestamp: Utils.convertToDate(performanceRecord.timestamp),
      host: performanceRecord.host,
      numberOfCPU: performanceRecord.numberOfCPU,
      modelOfCPU: performanceRecord.modelOfCPU,
      memoryTotalGb: performanceRecord.memoryTotalGb,
      memoryFreeGb: performanceRecord.memoryFreeGb,
      loadAverageLastMin: performanceRecord.loadAverageLastMin,
      process: performanceRecord.process,
      processMemoryUsage: performanceRecord.processMemoryUsage,
      processCPUUsage: performanceRecord.processCPUUsage,
      source: performanceRecord.source,
      module: performanceRecord.module,
      method: performanceRecord.method,
      action: performanceRecord.action,
      group: performanceRecord.group,
    };
    // Add user only if provided
    if (performanceRecord.userID) {
      performanceRecordMDB.userID = DatabaseUtils.convertToObjectID(performanceRecord.userID);
    }
    // Add parent only if provided
    if (performanceRecord.parentID) {
      performanceRecordMDB.parentID = DatabaseUtils.convertToObjectID(performanceRecord.parentID);
    }
    // Add nbr charging stations only if provided
    if (Utils.convertToInt(performanceRecord.numberOfChargingStations) > 0) {
      performanceRecordMDB.numberOfChargingStations = Utils.convertToInt(performanceRecord.numberOfChargingStations);
    }
    // Add duration only if provided
    if (Utils.convertToInt(performanceRecord.durationMs) > 0) {
      performanceRecordMDB.durationMs = Utils.convertToInt(performanceRecord.durationMs);
    }
    // Add size only if provided
    if (Utils.convertToInt(performanceRecord.sizeKb) > 0) {
      performanceRecordMDB.sizeKb = Utils.convertToInt(performanceRecord.sizeKb);
    }
    // Add HTTP only when provided (httpMethod is always provided)
    if (performanceRecord.httpMethod) {
      performanceRecordMDB.httpMethod = performanceRecord.httpMethod;
      performanceRecordMDB.httpCode = Utils.convertToInt(performanceRecord.httpCode);
      performanceRecordMDB.httpUrl = performanceRecord.httpUrl;
    }
    // Add Charging Station
    if (performanceRecord.chargingStationID) {
      performanceRecordMDB.chargingStationID = performanceRecord.chargingStationID;
    }
    // Insert
    await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'performances')
      .insertOne(performanceRecordMDB);
  }

  public static async deletePerformanceRecords(params?: { deleteUpToDate: Date }): Promise<DeletedResult> {
    // Build filter
    const filters: FilterParams = {};
    // Date provided?
    if (params?.deleteUpToDate) {
      filters.timestamp = {};
      filters.timestamp.$lte = Utils.convertToDate(params.deleteUpToDate);
    }
    // Delete
    const result = await global.database.getCollection<PerformanceRecord>(Constants.DEFAULT_TENANT, 'performances')
      .deleteMany(filters);
    // Return the result
    return { acknowledged: result.acknowledged, deletedCount: result.deletedCount };
  }
}
