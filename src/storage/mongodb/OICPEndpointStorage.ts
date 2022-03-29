import global, { DatabaseCount, FilterParams } from '../../types/GlobalType';

import BackendError from '../../exception/BackendError';
import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import OICPEndpoint from '../../types/oicp/OICPEndpoint';
import { ObjectId } from 'mongodb';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'OICPEndpointStorage';

export default class OICPEndpointStorage {
  public static async getOicpEndpoint(tenant: Tenant, id: string, projectFields?: string[]): Promise<OICPEndpoint> {
    const endpointsMDB = await OICPEndpointStorage.getOicpEndpoints(
      tenant, { oicpEndpointIDs: [id] }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return endpointsMDB.count === 1 ? endpointsMDB.result[0] : null;
  }

  public static async saveOicpEndpoint(tenant: Tenant, oicpEndpointToSave: OICPEndpoint): Promise<string> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Check if name is provided
    if (!oicpEndpointToSave.name) {
      // Name must be provided!
      throw new BackendError({
        module: MODULE_NAME,
        method: 'saveOicpEndpoint',
        message: 'OICPEndpoint has no Name'
      });
    }
    const oicpEndpointFilter: any = {};
    // Build Request
    if (oicpEndpointToSave.id) {
      oicpEndpointFilter._id = DatabaseUtils.convertToObjectID(oicpEndpointToSave.id);
    } else {
      oicpEndpointFilter._id = new ObjectId();
    }
    const oicpEndpointMDB: any = {
      _id: oicpEndpointFilter._id,
      name: oicpEndpointToSave.name,
      role: oicpEndpointToSave.role,
      baseUrl: oicpEndpointToSave.baseUrl,
      countryCode: oicpEndpointToSave.countryCode,
      partyId: oicpEndpointToSave.partyId,
      backgroundPatchJob: oicpEndpointToSave.backgroundPatchJob,
      status: oicpEndpointToSave.status,
      businessDetails: oicpEndpointToSave.businessDetails,
      availableEndpoints: oicpEndpointToSave.availableEndpoints,
      lastPatchJobOn: Utils.convertToDate(oicpEndpointToSave.lastPatchJobOn),
      lastPatchJobResult: oicpEndpointToSave.lastPatchJobResult,
      version: oicpEndpointToSave.version
    };
    // Add Last Changed/Created props
    DatabaseUtils.addLastChangedCreatedProps(oicpEndpointMDB, oicpEndpointToSave);
    // Modify
    await global.database.getCollection<any>(tenant.id, 'oicpendpoints').findOneAndUpdate(
      oicpEndpointFilter,
      { $set: oicpEndpointMDB },
      { upsert: true, returnDocument: 'after' });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveOicpEndpoint', startTime, { oicpEndpointToSave });
    // Create
    return oicpEndpointFilter._id.toString();
  }

  // Delegate
  public static async getOicpEndpoints(tenant: Tenant,
      params: { search?: string; role?: string; oicpEndpointIDs?: string[]; localToken?: string },
      dbParams: DbParams, projectFields?: string[]): Promise<DataResult<OICPEndpoint>> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Create Aggregation
    const aggregation: any[] = [];
    // Set the filters
    const filters: FilterParams = {};
    // Search
    if (params.search) {
      filters.$or = [
        { 'name': { $regex: params.search, $options: 'i' } }
      ];
    }
    if (params.oicpEndpointIDs) {
      filters._id = {
        $in: params.oicpEndpointIDs.map((oicpEndpointID) => DatabaseUtils.convertToObjectID(oicpEndpointID))
      };
    }
    if (params.localToken) {
      filters.localToken = params.localToken;
    }
    if (params.role) {
      filters.role = params.role;
    }
    // Filters
    if (filters) {
      aggregation.push({
        $match: filters
      });
    }
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const oicpEndpointsCountMDB = await global.database.getCollection<any>(tenant.id, 'oicpendpoints')
      .aggregate([...aggregation, { $count: 'count' }])
      .toArray() as DatabaseCount[];
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getOicpEndpoints', startTime, aggregation, oicpEndpointsCountMDB);
      return {
        count: (oicpEndpointsCountMDB.length > 0 ? oicpEndpointsCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenant.id, aggregation);
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Sort
    if (!dbParams.sort) {
      dbParams.sort = { name: 1 };
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
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const oicpEndpointsMDB = await global.database.getCollection<any>(tenant.id, 'oicpendpoints')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as OICPEndpoint[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getOicpEndpoints', startTime, aggregation, oicpEndpointsMDB);
    return {
      count: (oicpEndpointsCountMDB.length > 0 ? oicpEndpointsCountMDB[0].count : 0),
      result: oicpEndpointsMDB
    };
  }

  public static async deleteOicpEndpoint(tenant: Tenant, id: string): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Delete OicpEndpoint
    await global.database.getCollection<any>(tenant.id, 'oicpendpoints')
      .findOneAndDelete({ '_id': DatabaseUtils.convertToObjectID(id) });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'deleteOicpEndpoint', startTime, { id });
  }

  public static async deleteOicpEndpoints(tenant: Tenant): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Delete OicpEndpoint
    await global.database.getCollection<any>(tenant.id, 'oicpendpoints').deleteMany({});
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'deleteOicpEndpoints', startTime, {});
  }
}
