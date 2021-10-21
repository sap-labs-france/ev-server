import global, { FilterParams } from '../../types/GlobalType';

import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import { ObjectId } from 'mongodb';
import PricingDefinition from '../../types/Pricing';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'PricingStorage';

export default class PricingStorage {

  public static async savePricingDefinition(tenant: Tenant, pricingDefinition: PricingDefinition): Promise<string> {
    // Debug
    const uniqueTimerID = Logging.traceDatabaseRequestStart();
    // Check Tenant
    DatabaseUtils.checkTenantObject(tenant);
    const pricingDefinitionMDB = {
      _id: pricingDefinition.id ? DatabaseUtils.convertToObjectID(pricingDefinition.id) : new ObjectId(),
      entityID: pricingDefinition.entityID,
      entityType: pricingDefinition.entityType,
      name: pricingDefinition.name,
      description: pricingDefinition.description,
      staticRestrictions: pricingDefinition.staticRestrictions,
      restrictions: pricingDefinition.restrictions,
      dimensions: pricingDefinition.dimensions,
    };
    // Check Created/Last Changed By
    DatabaseUtils.addLastChangedCreatedProps(pricingDefinitionMDB, pricingDefinition);
    // Save
    await global.database.getCollection<any>(tenant.id, 'pricingdefinitions').findOneAndUpdate(
      { '_id': pricingDefinitionMDB._id },
      { $set: pricingDefinitionMDB },
      { upsert: true, returnDocument: 'after' });
    // Debug
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'savePricingDefinition', uniqueTimerID, pricingDefinitionMDB);
    return pricingDefinitionMDB._id.toString();
  }

  public static async deletePricingDefinition(tenant: Tenant, pricingDefinitionID: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceDatabaseRequestStart();
    // Check Tenant
    DatabaseUtils.checkTenantObject(tenant);
    // Delete
    await global.database.getCollection<any>(tenant.id, 'pricingdefinitions').deleteOne(
      {
        '_id': DatabaseUtils.convertToObjectID(pricingDefinitionID),
      }
    );
    // Debug
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'deletePricingDefinition', uniqueTimerID, { id: pricingDefinitionID });
  }

  public static async getPricingDefinition(tenant: Tenant, id: string,
      params: { entityIDs?: string[]; entityTypes?: string[]; } = {}, projectFields?: string[]): Promise<PricingDefinition> {
    const pricingDefinitionMDB = await PricingStorage.getPricingDefinitions(tenant, {
      pricingDefinitionIDs: [id],
      entityIDs: params.entityIDs,
      entityTypes: params.entityTypes
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return pricingDefinitionMDB.count === 1 ? pricingDefinitionMDB.result[0] : null;
  }

  public static async getPricingDefinitions(tenant: Tenant,
      params: {
        pricingDefinitionIDs?: string[],
        entityIDs?: string[];
        entityTypes?: string[];
      },
      dbParams: DbParams, projectFields?: string[]): Promise<DataResult<PricingDefinition>> {
    const uniqueTimerID = Logging.traceDatabaseRequestStart();
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
    if (!Utils.isEmptyArray(params.pricingDefinitionIDs)) {
      filters._id = {
        $in: params.pricingDefinitionIDs.map((pricingDefinitionID) => DatabaseUtils.convertToObjectID(pricingDefinitionID))
      };
    }
    // Context IDs
    if (!Utils.isEmptyArray(params.entityIDs)) {
      filters.entityID = { $in: params.entityIDs };
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
    const pricingDefinitionsCountMDB = await global.database.getCollection<any>(tenant.id, 'pricingdefinitions')
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      // Return only the count
      await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getPricingDefinitions', uniqueTimerID, pricingDefinitionsCountMDB);
      return {
        count: (pricingDefinitionsCountMDB.length > 0 ? pricingDefinitionsCountMDB[0].count : 0),
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
    // DatabaseUtils.pushConvertObjectIDToString(aggregation, 'entityID');
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenant.id, aggregation);
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const pricingDefinitions = await global.database.getCollection<PricingDefinition>(tenant.id, 'pricingdefinitions')
      .aggregate<PricingDefinition>(aggregation, {
      allowDiskUse: true
    })
      .toArray();
    // Debug
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getPricingDefinitions', uniqueTimerID, pricingDefinitions);
    // Ok
    return {
      count: (pricingDefinitionsCountMDB.length > 0 ?
        (pricingDefinitionsCountMDB[0].count === Constants.DB_RECORD_COUNT_CEIL ? -1 : pricingDefinitionsCountMDB[0].count) : 0),
      result: pricingDefinitions,
      projectFields
    };
  }
}
