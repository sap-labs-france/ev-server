import PerformanceRecord, { PerformanceRecordGroup } from '../../types/Performance';
import global, { FilterParams } from '../../types/GlobalType';

import Constants from '../../utils/Constants';
import DatabaseUtils from './DatabaseUtils';
import { DeletedResult } from '../../types/DataResult';
import { LabelValues } from 'prom-client';
import { ObjectId } from 'mongodb';
import PerformanceValidatorStorage from '../validator/PerformanceValidatorStorage';
import Utils from '../../utils/Utils';

const PERFS_ENABLED = true;

// TODO: To remove when switched to k8s with Prometheus
export default class PerformanceStorage {
  public static async savePerformanceRecord(performanceRecord: PerformanceRecord, labelValues:LabelValues<string>): Promise<string> {
    if (PERFS_ENABLED) {
      if (Utils.isMonitoringEnabled()) {
        PerformanceStorage.savePrometheusMetric(performanceRecord, labelValues);
      }
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

  public static async updatePerformanceRecord(performanceRecord: PerformanceRecord, labelValues: LabelValues<string>): Promise<void> {
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
      if (Utils.isMonitoringEnabled() && ret?.value) {
        const perRecordReturned = ret.value as PerformanceRecord;
        if (!labelValues) {
          labelValues = { tenant: perRecordReturned.tenantSubdomain };
        }
        PerformanceStorage.savePrometheusMetric(perRecordReturned, labelValues);
      }
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

  private static savePrometheusMetric(performanceRecord: PerformanceRecord, labelValues:LabelValues<string>) {
    // const grafanaGroup = performanceRecord.group.replace('-', ''); // ACHTUNG - does not work - only replaces the first occurrence!
    const grafanaGroup = performanceRecord.group.replace(/-/g, '');
    const values = Object.values(labelValues).toString();
    const hashCode = Utils.positiveHashCode(values);
    const labels = Object.keys(labelValues);
    try {
      if (performanceRecord.durationMs) {
        if (performanceRecord.group === PerformanceRecordGroup.MONGO_DB) {
          const durationMetric = global.monitoringServer.getCountAvgClearableMetric(grafanaGroup, 'DurationMs', hashCode, 'duration in milliseconds', 'number of invocations', labels);
          durationMetric.setValue(labelValues, performanceRecord.durationMs);
        } else {
          const durationMetric = global.monitoringServer.getAvgClearableMetric(grafanaGroup, 'DurationMs', hashCode, 'duration in milliseconds', labels);
          durationMetric.setValue(labelValues, performanceRecord.durationMs);
        }
      }
      if (performanceRecord.reqSizeKb) {
        const durationMetric = global.monitoringServer.getAvgClearableMetric(grafanaGroup, 'RequestSizeKb', hashCode, 'request size kb', labels);
        durationMetric.setValue(labelValues, performanceRecord.reqSizeKb);
      }
      if (performanceRecord.resSizeKb) {
        const durationMetric = global.monitoringServer.getAvgClearableMetric(grafanaGroup, 'ResponseSizeKb', hashCode, 'response size kb', labels);
        durationMetric.setValue(labelValues, performanceRecord.resSizeKb);
      }
    } catch (error) {
      throw new Error(`Failed to save performance metrics - group: '${grafanaGroup}' - hashCode: '${hashCode}', labels: '${JSON.stringify(labels)}' - message: '${error.message}'`);
    }
  }
}

