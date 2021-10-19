import global, { FilterParams } from '../../types/GlobalType';

import Constants from '../../utils/Constants';
import DatabaseUtils from './DatabaseUtils';
import { DeletedResult } from '../../types/DataResult';
import PerformanceRecord from '../../types/Performance';
import PerformanceValidatorStorage from './validator/PerformanceValidatorStorage';
import Utils from '../../utils/Utils';

export default class PerformanceStorage {
  public static async savePerformanceRecord(performanceRecord: PerformanceRecord): Promise<string> {
    // Remove default Tenant
    if (!performanceRecord.tenantSubdomain || performanceRecord.tenantSubdomain === Constants.DEFAULT_TENANT) {
      delete performanceRecord.tenantSubdomain;
    }
    // Validate
    performanceRecord = PerformanceValidatorStorage.getInstance().validatePerformance(
      performanceRecord as unknown as Record<string, unknown>);
    // Insert
    const result = await global.database.getCollection(Constants.DEFAULT_TENANT, 'performances')
      .insertOne(performanceRecord);
    // Set
    performanceRecord.id = result.insertedId.toString();
    return performanceRecord.id;
  }

  public static async updatePerformanceRecord(performanceRecord: PerformanceRecord): Promise<void> {
    // Validate
    performanceRecord = PerformanceValidatorStorage.getInstance().validatePerformance(
      performanceRecord as unknown as Record<string, unknown>);
    // Convert to ObjectID
    performanceRecord['_id'] = DatabaseUtils.convertToObjectID(performanceRecord.id);
    delete performanceRecord.id;
    // Update
    await global.database.getCollection(Constants.DEFAULT_TENANT, 'performances').findOneAndUpdate(
      { _id: performanceRecord['_id'] },
      { $set: performanceRecord },
      { upsert: true, returnDocument: 'after' }
    );
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
