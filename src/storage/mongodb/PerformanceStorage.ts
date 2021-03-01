import Constants from '../../utils/Constants';
import Performance from '../../types/Performance';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

export default class PerformanceStorage {
  static async savePerformance(performance: Performance): Promise<void> {
    // Set
    const performanceMDB: any = {
      tenantID: performance.tenantID && performance.tenantID !== Constants.DEFAULT_TENANT ? Utils.convertToObjectID(performance.tenantID) : Constants.DEFAULT_TENANT,
      timestamp: Utils.convertToDate(performance.timestamp),
      host: performance.host,
      memoryTotalGb: performance.memoryTotalGb,
      memoryFreeGb: performance.memoryFreeGb,
      loadAverageLastMin: performance.loadAverageLastMin,
      process: performance.process,
      source: performance.source,
      module: performance.module,
      method: performance.method,
      action: performance.action,
    };
    // Add user only if provided
    if (performance.userID) {
      performanceMDB.userID = Utils.convertToObjectID(performance.userID);
    }
    // Add parent only if provided
    if (performance.parentID) {
      performanceMDB.parentID = Utils.convertToObjectID(performance.parentID);
    }
    // Add nbr charging stations only if provided
    if (Utils.convertToInt(performance.numberOfChargingStations) > 0) {
      performanceMDB.numberOfChargingStations = Utils.convertToInt(performance.numberOfChargingStations);
    }
    // Add duration only if provided
    if (Utils.convertToInt(performance.durationMs) > 0) {
      performanceMDB.durationMs = Utils.convertToInt(performance.durationMs);
    }
    // Add size only if provided
    if (Utils.convertToInt(performance.sizeKb) > 0) {
      performanceMDB.sizeKb = Utils.convertToInt(performance.sizeKb);
    }
    // Add HTTP only when provided (httpMethod is always provided)
    if (performance.httpMethod) {
      performanceMDB.httpMethod = performance.httpMethod;
      performanceMDB.httpCode = Utils.convertToInt(performance.httpCode);
      performanceMDB.httpUrl = performance.httpUrl;
    }
    // Insert
    await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'performances')
      .insertOne(performanceMDB);
  }
}
