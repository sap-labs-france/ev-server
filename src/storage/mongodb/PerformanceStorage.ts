import { ObjectId } from 'mongodb';
import { DeletedResult } from '../../types/DataResult';
import global, { FilterParams } from '../../types/GlobalType';
import PerformanceRecord, { PerformanceRecordGroup } from '../../types/Performance';

import Constants from '../../utils/Constants';
import { MetricLabels } from '../../utils/Logging';
import Utils from '../../utils/Utils';
import PerformanceValidatorStorage from '../validator/PerformanceValidatorStorage';
import DatabaseUtils from './DatabaseUtils';

const PERFS_ENABLED = true;

// TODO: To remove when switched to k8s with Prometheus
export default class PerformanceStorage {
  public static async savePerformanceRecord(performanceRecord: PerformanceRecord, metric:MetricLabels): Promise<string> {

    if (PERFS_ENABLED) {
      PerformanceStorage.savePrometheusMetric(performanceRecord, metric);
      // Remove default Tenant
      if (!performanceRecord.tenantSubdomain || performanceRecord.tenantSubdomain === Constants.DEFAULT_TENANT_ID) {
        delete performanceRecord.tenantSubdomain;
      }
      // Validate
      performanceRecord = PerformanceValidatorStorage.getInstance().validatePerformance(performanceRecord);
      // Insert
      const result = await global.database.getCollection<any>(Constants.DEFAULT_TENANT_ID, 'performances')
        .insertOne(performanceRecord);
      // Set
      performanceRecord.id = result.insertedId.toString();
      return performanceRecord.id;
    }
    return Promise.resolve(new ObjectId().toString());
  }

  public static async updatePerformanceRecord(performanceRecord: PerformanceRecord, metric: MetricLabels): Promise<void> {
    // PerformanceStorage.savePrometheusMetric(performanceRecord, metric);
    if (PERFS_ENABLED) {
      // Validate
      const performanceRecordMDB = PerformanceValidatorStorage.getInstance().validatePerformance(performanceRecord);
      // Convert to ObjectID
      DatabaseUtils.switchIDToMongoDBID(performanceRecordMDB);
      // Update
      const ret = await global.database.getCollection<PerformanceRecord>(Constants.DEFAULT_TENANT_ID, 'performances').findOneAndUpdate(
        { _id: performanceRecordMDB['_id'] },
        { $set: performanceRecordMDB },
        { upsert: true, returnDocument: 'after' }
      );
      const perRecordReturned = ret.value as PerformanceRecord;
      PerformanceStorage.savePrometheusMetric(perRecordReturned, metric);
    }
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
    const result = await global.database.getCollection<any>(Constants.DEFAULT_TENANT_ID, 'performances')
      .deleteMany(filters);
    // Return the result
    return { acknowledged: result.acknowledged, deletedCount: result.deletedCount };
  }

  private static savePrometheusMetric(performanceRecord: PerformanceRecord, metric:MetricLabels) {
    const grafanaGroup = performanceRecord.group.replace('-', '');
    const values = Object.values(metric.labelvalues).toString();
    const hashCode = Utils.positiveHashcode(values);
    if (performanceRecord.durationMs) {
      if (performanceRecord.group === PerformanceRecordGroup.MONGO_DB) {
        const durationMetric = global.monitoringServer.getComposedMetric(grafanaGroup, 'DurationMs', hashCode, 'duration in milliseconds', Object.keys(metric.labelvalues));
        durationMetric.setValue(metric.labelvalues, performanceRecord.durationMs);
      } else {
        const durationMetric = global.monitoringServer.getAvgMetric(grafanaGroup, 'DurationMs', hashCode, 'duration in milliseconds', Object.keys(metric.labelvalues));
        durationMetric.setValue(metric.labelvalues, performanceRecord.durationMs);
      }
    }
    if (performanceRecord.reqSizeKb) {
      const durationMetric = global.monitoringServer.getAvgMetric(grafanaGroup, 'RequestSizeKb', hashCode, 'request size kb', Object.keys(metric.labelvalues));
      durationMetric.setValue(metric.labelvalues, performanceRecord.reqSizeKb);
    }
    if (performanceRecord.resSizeKb) {
      const durationMetric = global.monitoringServer.getAvgMetric(grafanaGroup, 'ResponseSizeKb', hashCode, 'response size kb', Object.keys(metric.labelvalues));
      durationMetric.setValue(metric.labelvalues, performanceRecord.resSizeKb);
    }
  }
}

