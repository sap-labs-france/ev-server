import global, { DatabaseCount, FilterParams } from '../../types/GlobalType';

import BackendError from '../../exception/BackendError';
import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import OCPIEndpoint from '../../types/ocpi/OCPIEndpoint';
import { OCPIRole } from '../../types/ocpi/OCPIRole';
import { ObjectId } from 'mongodb';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'OCPIEndpointStorage';

export default class OCPIEndpointStorage {
  public static async getOcpiEndpoint(tenant: Tenant, id: string, projectFields?: string[]): Promise<OCPIEndpoint> {
    const endpointsMDB = await OCPIEndpointStorage.getOcpiEndpoints(
      tenant, { ocpiEndpointIDs: [id] }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return endpointsMDB.count === 1 ? endpointsMDB.result[0] : null;
  }

  public static async getOcpiEndpointByLocalToken(tenant: Tenant, token: string, projectFields?: string[]): Promise<OCPIEndpoint> {
    const endpointsMDB = await OCPIEndpointStorage.getOcpiEndpoints(
      tenant, { localToken: token }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return endpointsMDB.count === 1 ? endpointsMDB.result[0] : null;
  }

  public static async saveOcpiEndpoint(tenant: Tenant, ocpiEndpointToSave: OCPIEndpoint): Promise<string> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Check if name is provided
    if (!ocpiEndpointToSave.name) {
      // Name must be provided!
      throw new BackendError({
        module: MODULE_NAME,
        method: 'saveOcpiEndpoint',
        message: 'OCPIEndpoint has no Name'
      });
    }
    const ocpiEndpointFilter: any = {};
    // Build Request
    if (ocpiEndpointToSave.id) {
      ocpiEndpointFilter._id = DatabaseUtils.convertToObjectID(ocpiEndpointToSave.id);
    } else {
      ocpiEndpointFilter._id = new ObjectId();
    }
    const ocpiEndpointMDB: any = {
      _id: ocpiEndpointFilter._id,
      name: ocpiEndpointToSave.name,
      role: ocpiEndpointToSave.role,
      baseUrl: ocpiEndpointToSave.baseUrl,
      localToken: ocpiEndpointToSave.localToken,
      token: ocpiEndpointToSave.token,
      countryCode: ocpiEndpointToSave.countryCode,
      partyId: ocpiEndpointToSave.partyId,
      backgroundPatchJob: Utils.convertToBoolean(ocpiEndpointToSave.backgroundPatchJob),
      status: ocpiEndpointToSave.status,
      version: ocpiEndpointToSave.version,
      businessDetails: ocpiEndpointToSave.businessDetails,
      availableEndpoints: ocpiEndpointToSave.availableEndpoints,
      versionUrl: ocpiEndpointToSave.versionUrl,
      lastPatchJobOn: Utils.convertToDate(ocpiEndpointToSave.lastPatchJobOn),
      lastPatchJobResult: ocpiEndpointToSave.lastPatchJobResult
    };
    // Add Last Changed/Created props
    DatabaseUtils.addLastChangedCreatedProps(ocpiEndpointMDB, ocpiEndpointToSave);
    // Modify
    await global.database.getCollection<any>(tenant.id, 'ocpiendpoints').findOneAndUpdate(
      ocpiEndpointFilter,
      { $set: ocpiEndpointMDB },
      { upsert: true, returnDocument: 'after' });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveOcpiEndpoint', startTime, ocpiEndpointMDB);
    // Create
    return ocpiEndpointFilter._id.toString();
  }

  // Delegate
  public static async getOcpiEndpoints(tenant: Tenant,
      params: { search?: string; role?: OCPIRole; ocpiEndpointIDs?: string[]; localToken?: string },
      dbParams: DbParams, projectFields?: string[]): Promise<DataResult<OCPIEndpoint>> {
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
    if (params.ocpiEndpointIDs) {
      filters._id = {
        $in: params.ocpiEndpointIDs.map((ocpiEndpointID) => DatabaseUtils.convertToObjectID(ocpiEndpointID))
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
    const ocpiEndpointsCountMDB = await global.database.getCollection<any>(tenant.id, 'ocpiendpoints')
      .aggregate([...aggregation, { $count: 'count' }])
      .toArray() as DatabaseCount[];
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getOcpiEndpoints', startTime, aggregation, ocpiEndpointsCountMDB);
      return {
        count: (ocpiEndpointsCountMDB.length > 0 ? ocpiEndpointsCountMDB[0].count : 0),
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
    const ocpiEndpointsMDB = await global.database.getCollection<any>(tenant.id, 'ocpiendpoints')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as OCPIEndpoint[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getOcpiEndpoints', startTime, aggregation, ocpiEndpointsMDB);
    return {
      count: (ocpiEndpointsCountMDB.length > 0 ? ocpiEndpointsCountMDB[0].count : 0),
      result: ocpiEndpointsMDB
    };
  }

  public static async deleteOcpiEndpoint(tenant: Tenant, id: string): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Delete OcpiEndpoint
    await global.database.getCollection<any>(tenant.id, 'ocpiendpoints')
      .findOneAndDelete({ '_id': DatabaseUtils.convertToObjectID(id) });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'deleteOcpiEndpoint', startTime, { id });
  }

  public static async deleteOcpiEndpoints(tenant: Tenant): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Delete OcpiEndpoint
    await global.database.getCollection<any>(tenant.id, 'ocpiendpoints').deleteMany({});
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'deleteOcpiEndpoints', startTime, {});
  }
}
