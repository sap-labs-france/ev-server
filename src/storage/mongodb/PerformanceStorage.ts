import global, { FilterParams } from '../../types/GlobalType';

import Constants from '../../utils/Constants';
import DatabaseUtils from './DatabaseUtils';
import { DeletedResult } from '../../types/DataResult';
import { ObjectId } from 'mongodb';
import PerformanceRecord from '../../types/Performance';
import PerformanceValidatorStorage from '../validator/PerformanceValidatorStorage';
import Utils from '../../utils/Utils';

const PERFS_ENABLED = true;

// TODO: To remove when switched to k8s with Prometheus
export default class PerformanceStorage {
  public static async savePerformanceRecord(performanceRecord: PerformanceRecord): Promise<string> {
    if (PERFS_ENABLED) {
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

  public static async updatePerformanceRecord(performanceRecord: PerformanceRecord): Promise<void> {
    if (PERFS_ENABLED) {
      // Validate
      const performanceRecordMDB = PerformanceValidatorStorage.getInstance().validatePerformance(performanceRecord);
      // Convert to ObjectID
      DatabaseUtils.switchIDToMongoDBID(performanceRecordMDB);
      // Update
      await global.database.getCollection<PerformanceRecord>(Constants.DEFAULT_TENANT_ID, 'performances').findOneAndUpdate(
        { _id: performanceRecordMDB['_id'] },
        { $set: performanceRecordMDB },
        { upsert: true, returnDocument: 'after' }
      );
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
}
