import PricingDefinition, { PricingEntity } from '../../types/Pricing';
import global, { FilterParams } from '../../types/GlobalType';

import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import { ObjectId } from 'mongodb';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'PricingStorage';

export default class PricingStorage {

  public static async savePricingDefinition(tenant: Tenant, pricingDefinition: PricingDefinition): Promise<string> {
    const uniqueTimerID = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    let entityID;
    if (pricingDefinition.entityType === PricingEntity.CHARGING_STATION) {
      entityID = pricingDefinition.entityID;
    } else {
      entityID = DatabaseUtils.convertToObjectID(pricingDefinition.entityID);
    }
    const pricingDefinitionMDB = {
      _id: pricingDefinition.id ? DatabaseUtils.convertToObjectID(pricingDefinition.id) : new ObjectId(),
      entityID,
      entityType: pricingDefinition.entityType,
      name: pricingDefinition.name,
      description: pricingDefinition.description,
      staticRestrictions: pricingDefinition.staticRestrictions,
      restrictions: pricingDefinition.restrictions,
      dimensions: pricingDefinition.dimensions,
      siteID: DatabaseUtils.convertToObjectID(pricingDefinition.siteID)
    };
    // Check Created/Last Changed By
    DatabaseUtils.addLastChangedCreatedProps(pricingDefinitionMDB, pricingDefinition);
    // Save
    await global.database.getCollection<any>(tenant.id, 'pricingdefinitions').findOneAndUpdate(
      { '_id': pricingDefinitionMDB._id },
      { $set: pricingDefinitionMDB },
      { upsert: true, returnDocument: 'after' });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'savePricingDefinition', uniqueTimerID, pricingDefinitionMDB);
    return pricingDefinitionMDB._id.toString();
  }

  public static async deletePricingDefinition(tenant: Tenant, pricingDefinitionID: string): Promise<void> {
    const uniqueTimerID = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Delete
    await global.database.getCollection<any>(tenant.id, 'pricingdefinitions').deleteOne(
      {
        '_id': DatabaseUtils.convertToObjectID(pricingDefinitionID),
      }
    );
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'deletePricingDefinition', uniqueTimerID, { id: pricingDefinitionID });
  }

  public static async getPricingDefinition(tenant: Tenant, id: string,
      params: { entityID?: string; entityType?: PricingEntity; withEntityInformation?: boolean; siteIDs?: string[];} = {}, projectFields?: string[]): Promise<PricingDefinition> {
    const pricingDefinitionMDB = await PricingStorage.getPricingDefinitions(tenant, {
      siteIDs: params.siteIDs,
      pricingDefinitionIDs: [id],
      entityID: params.entityID,
      entityType: params.entityType,
      withEntityInformation: params.withEntityInformation
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return pricingDefinitionMDB.count === 1 ? pricingDefinitionMDB.result[0] : null;
  }

  public static async getPricingDefinitions(tenant: Tenant,
      params: { pricingDefinitionIDs?: string[], entityType?: PricingEntity; entityID?: string; siteIDs?: string[]; withEntityInformation?: boolean; },
      dbParams: DbParams, projectFields?: string[]): Promise<DataResult<PricingDefinition>> {
    const uniqueTimerID = Logging.traceDatabaseRequestStart();
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
    if (!Utils.isNullOrEmptyString(params.entityID)) {
      if (params.entityType === PricingEntity.CHARGING_STATION) {
        filters.entityID = { $in: [params.entityID] };
      } else {
        filters.entityID = { $in: [DatabaseUtils.convertToObjectID(params.entityID)] };
      }
    }
    // Site
    if (!Utils.isEmptyArray(params.siteIDs)) {
      filters.siteID = {
        $in: params.siteIDs.map((siteID) => DatabaseUtils.convertToObjectID(siteID))
      };
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
      .aggregate([...aggregation, { $count: 'count' }], DatabaseUtils.buildAggregateOptions())
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
    // Sites
    if (params.withEntityInformation) {
      const oneToOneCardinality = true;
      const oneToOneCardinalityNotNull = false;
      DatabaseUtils.pushCompanyLookupInAggregation({
        tenantID: tenant.id, aggregation, localField: 'entityID', foreignField: '_id',
        asField: 'company', oneToOneCardinality, oneToOneCardinalityNotNull
      });
      DatabaseUtils.pushSiteLookupInAggregation({
        tenantID: tenant.id, aggregation, localField: 'entityID', foreignField: '_id',
        asField: 'site', oneToOneCardinality, oneToOneCardinalityNotNull
      });
      DatabaseUtils.pushSiteAreaLookupInAggregation({
        tenantID: tenant.id, aggregation, localField: 'entityID', foreignField: '_id',
        asField: 'siteArea', oneToOneCardinality, oneToOneCardinalityNotNull
      });
      DatabaseUtils.pushChargingStationLookupInAggregation({
        tenantID: tenant.id, aggregation, localField: 'entityID', foreignField: '_id',
        asField: 'chargingStation', oneToOneCardinality, oneToOneCardinalityNotNull
      });
      // Check if it has detailed messages
      aggregation.push({
        $addFields: {
          entityName: {
            $switch: {
              branches: [
                { case: { $eq: [ 'Company', '$entityType' ] }, then: '$company.name' },
                { case: { $eq: [ 'Site', '$entityType' ] }, then: '$site.name' },
                { case: { $eq: [ 'SiteArea', '$entityType' ] }, then: '$siteArea.name' },
              ],
              default: '$entityID'
            }
          }
        }
      });
    }
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'entityID');
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenant.id, aggregation);
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const pricingDefinitions = await global.database.getCollection<any>(tenant.id, 'pricingdefinitions')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as PricingDefinition[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getPricingDefinitions', uniqueTimerID, pricingDefinitions);
    return {
      count: DatabaseUtils.getCountFromDatabaseCount(pricingDefinitionsCountMDB[0]),
      result: pricingDefinitions,
      projectFields
    };
  }
}
