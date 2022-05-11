import global, { DatabaseCount, FilterParams } from '../../types/GlobalType';

import { ChargingStationTemplate } from '../../types/ChargingStation';
import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import { ObjectId } from 'mongodb';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'ChargingStationTemplateStorage';

export default class ChargingStationTemplateStorage {


  public static async getChargingStationTemplates(tenant: Tenant,
      params: { search?: string; IDs?: string[];} = {},
      dbParams: DbParams, projectFields?: string[]): Promise<DataResult<ChargingStationTemplate>> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Create Aggregation
    const aggregation = [];
    // Add Site Area
    DatabaseUtils.pushSiteAreaLookupInAggregation({
      tenantID: tenant.id, aggregation, localField: 'siteAreaID', foreignField: '_id',
      asField: 'siteArea', oneToOneCardinality: true
    });
    // Set the filters
    const filters: FilterParams = {};
    // Search
    if (params.search) {
      filters.$or = [
        { 'description': { $regex: params.search, $options: 'i' } },
      ];
      if (DatabaseUtils.isObjectID(params.search)) {
        filters.$or.push(
          { '_id': DatabaseUtils.convertToObjectID(params.search) },
        );
      }
    }
    // Build filter
    if (!Utils.isEmptyArray(params.IDs)) {
      filters._id = {
        $in: params.IDs.map((ID) => ID)
      };
    }
    // Filters
    if (filters) {
      aggregation.push({
        $match: filters
      });
    }
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const chargingStationTemplatesCountMDB = await global.database.getCollection<any>(Constants.DEFAULT_TENANT_ID, 'chargingstationtemplates')
      .aggregate([...aggregation, { $count: 'count' }], DatabaseUtils.buildAggregateOptions())
      .toArray() as DatabaseCount[];
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      // Return only the count
      await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getChargingStationTemplates', startTime, aggregation, chargingStationTemplatesCountMDB);
      return {
        count: (chargingStationTemplatesCountMDB.length > 0 ? chargingStationTemplatesCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Sort
    if (!dbParams.sort) {
      dbParams.sort = { expirationDate: -1 };
    }
    aggregation.push({
      $sort: dbParams.sort
    });
    // Skip
    if (dbParams.skip > 0) {
      aggregation.push({ $skip: dbParams.skip });
    }
    // Limit
    aggregation.push({
      $limit: dbParams.limit
    });
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenant.id, aggregation);
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const ChargingStationTemplates = await global.database.getCollection<any>(Constants.DEFAULT_TENANT_ID, 'chargingstationtemplates')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as ChargingStationTemplate[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getChargingStationTemplates', startTime, aggregation, ChargingStationTemplates);
    return {
      count: DatabaseUtils.getCountFromDatabaseCount(chargingStationTemplatesCountMDB[0]),
      result: ChargingStationTemplates
    };
  }

  public static async getChargingStationTemplate(tenant: Tenant, id: string = Constants.UNKNOWN_OBJECT_ID,
      params = {},
      projectFields?: string[]): Promise<ChargingStationTemplate> {
    const chargingstationtemplatessMDB = await ChargingStationTemplateStorage.getChargingStationTemplates(tenant, {
      IDs: [id],
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return chargingstationtemplatessMDB.count === 1 ? chargingstationtemplatessMDB.result[0] : null;
  }

  // public static async deleteRegistrationToken(tenant: Tenant, id: string): Promise<void> {
  //   const startTime = Logging.traceDatabaseRequestStart();
  //   await global.database.getCollection<any>(tenant.id, 'registrationtokens')
  //     .findOneAndDelete({ '_id': DatabaseUtils.convertToObjectID(id) });
  //   await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'deleteRegistrationToken', startTime, { id });
  // }
}
