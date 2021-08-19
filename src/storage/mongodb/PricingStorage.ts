import global, { FilterParams } from '../../types/GlobalType';

import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import { ObjectId } from 'mongodb';
import PricingModel from '../../types/Pricing';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'PricingStorage';

export default class PricingStorage {

  public static async savePricingModel(tenant: Tenant, pricingModel: PricingModel): Promise<string> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenant.id, MODULE_NAME, 'savePricingModel');
    // Check Tenant
    DatabaseUtils.checkTenantObject(tenant);
    const pricingModelMDB = {
      _id: pricingModel.id ? DatabaseUtils.convertToObjectID(pricingModel.id) : new ObjectId(),
      contextID: DatabaseUtils.convertToObjectID(pricingModel.contextID),
      pricingDefinitions: pricingModel.pricingDefinitions, // TODO - check here some data consistency
    };
    // Check Created/Last Changed By
    DatabaseUtils.addLastChangedCreatedProps(pricingModelMDB, pricingModel);
    // Save
    await global.database.getCollection<any>(tenant.id, 'pricingmodels').findOneAndUpdate(
      { '_id': pricingModelMDB._id },
      { $set: pricingModelMDB },
      { upsert: true, returnDocument: 'after' });
    // Debug
    await Logging.traceEnd(tenant.id, MODULE_NAME, 'savePricingModel', uniqueTimerID, pricingModelMDB);
    return pricingModelMDB._id.toString();
  }

  public static async deletePricingModel(tenant: Tenant, pricingModelID: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenant.id, MODULE_NAME, 'deletePricing');
    // Check Tenant
    DatabaseUtils.checkTenantObject(tenant);
    // Delete
    await global.database.getCollection<any>(tenant.id, 'pricingmodels').deleteOne(
      {
        '_id': pricingModelID,
      }
    );
    // Debug
    await Logging.traceEnd(tenant.id, MODULE_NAME, 'deletePricingModel', uniqueTimerID, { id: pricingModelID });
  }

  public static async getPricingModel(tenant: Tenant, id: string,
      params: { contextIDs?: string[]; } = {}, projectFields?: string[]): Promise<PricingModel> {
    const pricingModelMDB = await PricingStorage.getPricingModels(tenant, {
      pricingModelIDs: [id],
      contextIDs: params.contextIDs,
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return pricingModelMDB.count === 1 ? pricingModelMDB.result[0] : null;
  }

  public static async getPricingModels(tenant: Tenant,
      params: {
        pricingModelIDs?: string[],
        contextIDs?: string[];
      },
      dbParams: DbParams, projectFields?: string[]): Promise<DataResult<PricingModel>> {
    const uniqueTimerID = Logging.traceStart(tenant.id, MODULE_NAME, 'getPricingModels');
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
    // Model IDs
    if (!Utils.isEmptyArray(params.pricingModelIDs)) {
      filters._id = {
        $in: params.pricingModelIDs.map((pricingModelID) => DatabaseUtils.convertToObjectID(pricingModelID))
      };
    }
    // Context IDs
    if (!Utils.isEmptyArray(params.contextIDs)) {
      filters.contextID = { $in: params.contextIDs.map((contextID) => DatabaseUtils.convertToObjectID(contextID)) };
    }
    // Remove deleted
    filters.deleted = { '$ne': true };
    // Filters
    if (!Utils.isEmptyJSon(filters)) {
      aggregation.push({
        $match: filters
      });
    }
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      // Always limit the nbr of record to avoid performances issues
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const pricingModelsCountMDB = await global.database.getCollection<any>(tenant.id, 'pricingmodels')
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      // Return only the count
      await Logging.traceEnd(tenant.id, MODULE_NAME, 'getPricingModels', uniqueTimerID, pricingModelsCountMDB);
      return {
        count: (pricingModelsCountMDB.length > 0 ? pricingModelsCountMDB[0].count : 0),
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
    const pricingModelsMDB = await global.database.getCollection<PricingModel>(tenant.id, 'pricingmodels')
      .aggregate(aggregation, {
        allowDiskUse: true
      })
      .toArray();
    // Debug
    await Logging.traceEnd(tenant.id, MODULE_NAME, 'getPricingModels', uniqueTimerID, pricingModelsMDB);
    // Ok
    return {
      count: (pricingModelsCountMDB.length > 0 ?
        (pricingModelsCountMDB[0].count === Constants.DB_RECORD_COUNT_CEIL ? -1 : pricingModelsCountMDB[0].count) : 0),
      result: pricingModelsMDB,
      projectedFields: projectFields
    };
  }
}
