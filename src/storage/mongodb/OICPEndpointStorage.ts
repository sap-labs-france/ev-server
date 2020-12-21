import global, { FilterParams } from '../../types/GlobalType';

import BackendError from '../../exception/BackendError';
import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import OICPEndpoint from '../../types/oicp/OICPEndpoint';
import { ObjectID } from 'mongodb';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'OICPEndpointStorage';

export default class OICPEndpointStorage {
  static async getOicpEndpoint(tenantID: string, id: string, projectFields?: string[]): Promise<OICPEndpoint> {
    const endpointsMDB = await OICPEndpointStorage.getOicpEndpoints(
      tenantID, { oicpEndpointIDs: [id] }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return endpointsMDB.count === 1 ? endpointsMDB.result[0] : null;
  }

  static async saveOicpEndpoint(tenantID: string, oicpEndpointToSave: OICPEndpoint): Promise<string> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'saveOicpEndpoint');
    // Check Tenant
    await DatabaseUtils.checkTenant(tenantID);
    // Check if name is provided
    if (!oicpEndpointToSave.name) {
      // Name must be provided!
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'saveOicpEndpoint',
        message: 'OICPEndpoint has no Name'
      });
    }
    const oicpEndpointFilter: any = {};
    // Build Request
    if (oicpEndpointToSave.id) {
      oicpEndpointFilter._id = Utils.convertToObjectID(oicpEndpointToSave.id);
    } else {
      oicpEndpointFilter._id = new ObjectID();
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
      lastPatchJobOn: oicpEndpointToSave.lastPatchJobOn,
      lastPatchJobResult: oicpEndpointToSave.lastPatchJobResult,
      version: oicpEndpointToSave.version
    };
    // Add Last Changed/Created props
    DatabaseUtils.addLastChangedCreatedProps(oicpEndpointMDB, oicpEndpointToSave);
    // Modify
    await global.database.getCollection<any>(tenantID, 'oicpendpoints').findOneAndUpdate(
      oicpEndpointFilter,
      { $set: oicpEndpointMDB },
      { upsert: true, returnOriginal: false });
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'saveOicpEndpoint', uniqueTimerID, { oicpEndpointToSave: oicpEndpointToSave });
    // Create
    return oicpEndpointFilter._id.toHexString();
  }

  // Delegate
  static async getOicpEndpoints(tenantID: string,
    params: { search?: string; role?: string; oicpEndpointIDs?: string[]; localToken?: string },
    dbParams: DbParams, projectFields?: string[]): Promise<DataResult<OICPEndpoint>> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getOicpEndpoints');
    // Check Tenant
    await DatabaseUtils.checkTenant(tenantID);
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
        $in: params.oicpEndpointIDs.map((oicpEndpointID) => Utils.convertToObjectID(oicpEndpointID))
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
    const oicpEndpointsCountMDB = await global.database.getCollection<any>(tenantID, 'oicpendpoints')
      .aggregate([...aggregation, { $count: 'count' }])
      .toArray();
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      Logging.traceEnd(tenantID, MODULE_NAME, 'getOicpEndpoints', uniqueTimerID, oicpEndpointsCountMDB);
      return {
        count: (oicpEndpointsCountMDB.length > 0 ? oicpEndpointsCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);
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
    const oicpEndpointsMDB = await global.database.getCollection<any>(tenantID, 'oicpendpoints')
      .aggregate(aggregation, {
        allowDiskUse: true
      })
      .toArray();
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'getOicpEndpoints', uniqueTimerID, oicpEndpointsMDB);
    // Ok
    return {
      count: (oicpEndpointsCountMDB.length > 0 ? oicpEndpointsCountMDB[0].count : 0),
      result: oicpEndpointsMDB
    };
  }

  static async deleteOicpEndpoint(tenantID: string, id: string) {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'deleteOicpEndpoint');
    // Check Tenant
    await DatabaseUtils.checkTenant(tenantID);
    // Delete OicpEndpoint
    await global.database.getCollection<any>(tenantID, 'oicpendpoints')
      .findOneAndDelete({ '_id': Utils.convertToObjectID(id) });
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'deleteOicpEndpoint', uniqueTimerID, { id });
  }

  static async deleteOicpEndpoints(tenantID: string) {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'deleteOicpEndpoints');
    // Check Tenant
    await DatabaseUtils.checkTenant(tenantID);
    // Delete OicpEndpoint
    await global.database.getCollection<any>(tenantID, 'oicpendpoints').deleteMany({});
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'deleteOicpEndpoints', uniqueTimerID);
  }
}
