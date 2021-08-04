import global, { FilterParams } from '../../types/GlobalType';

import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import Pricing from '../../types/Pricing';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'PricingStorage';

export default class PricingStorage {

  public static async savePricing(tenant: Tenant, pricing: Pricing): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenant.id, MODULE_NAME, 'savePricing');
    // Check Tenant
    DatabaseUtils.checkTenantObject(tenant);
    const pricingMDB = {
      _id: pricing.id,
      contextID: DatabaseUtils.convertToObjectID(pricing.contextID),
      pricingDefinitions: pricing.pricingDefinitions,
    };
    // Check Created/Last Changed By
    DatabaseUtils.addLastChangedCreatedProps(pricingMDB, pricing);
    // Save
    await global.database.getCollection<any>(tenant.id, 'pricings').findOneAndUpdate(
      { '_id': pricing.id },
      { $set: pricingMDB },
      { upsert: true, returnDocument: 'after' });
    // Debug
    await Logging.traceEnd(tenant.id, MODULE_NAME, 'savePricing', uniqueTimerID, pricingMDB);
  }

  public static async deletePricing(tenant: Tenant, pricingID: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenant.id, MODULE_NAME, 'deletePricing');
    // Check Tenant
    DatabaseUtils.checkTenantObject(tenant);
    // Delete
    await global.database.getCollection<any>(tenant.id, 'pricings').deleteOne(
      {
        '_id': pricingID,
      }
    );
    // Debug
    await Logging.traceEnd(tenant.id, MODULE_NAME, 'deletePricing', uniqueTimerID, { id: pricingID });
  }

  public static async getPricing(tenant: Tenant, id: string,
      params: { contextIDs?: string[]; } = {}, projectFields?: string[]): Promise<Pricing> {
    const pricingMDB = await PricingStorage.getPricings(tenant, {
      contextIDs: params.contextIDs,
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return pricingMDB.count === 1 ? pricingMDB.result[0] : null;
  }

  public static async getPricings(tenant: Tenant,
      params: {
        contextIDs?: string[];
      },
      dbParams: DbParams, projectFields?: string[]): Promise<DataResult<Pricing>> {
    const uniqueTimerID = Logging.traceStart(tenant.id, MODULE_NAME, 'getPricings');
    // Check Tenant
    DatabaseUtils.checkTenantObject(tenant);
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Create Aggregation
    const aggregation = [];
    const filters: FilterParams = {};
    // Remove deleted
    filters.deleted = { '$ne': true };
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const pricingsCountMDB = await global.database.getCollection<any>(tenant.id, 'pricings')
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      // Return only the count
      await Logging.traceEnd(tenant.id, MODULE_NAME, 'getPricings', uniqueTimerID, pricingsCountMDB);
      return {
        count: (pricingsCountMDB.length > 0 ? pricingsCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    if (!dbParams.sort) {
      dbParams.sort = { createdOn: -1 };
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
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'contextID');
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenant.id, aggregation);
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const pricingsMDB = await global.database.getCollection<Pricing>(tenant.id, 'pricings')
      .aggregate(aggregation, {
        allowDiskUse: true
      })
      .toArray();
    // Debug
    await Logging.traceEnd(tenant.id, MODULE_NAME, 'getPricings', uniqueTimerID, pricingsMDB);
    // Ok
    return {
      count: (pricingsCountMDB.length > 0 ?
        (pricingsCountMDB[0].count === Constants.DB_RECORD_COUNT_CEIL ? -1 : pricingsCountMDB[0].count) : 0),
      result: pricingsMDB,
      projectedFields: projectFields
    };
  }
}
