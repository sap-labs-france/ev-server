import { ObjectID } from 'mongodb';
import BackendError from '../../exception/BackendError';
import Constants from '../../utils/Constants';
import DatabaseUtils from './DatabaseUtils';
import global from '../../types/GlobalType';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import OCPIEndpoint from '../../types/ocpi/OCPIEndpoint';
import { DataResult } from '../../types/DataResult';
import DbParams from '../../types/database/DbParams';

export default class OCPIEndpointStorage {

  static async getOcpiEndpoint(tenantID: string, id: string): Promise<OCPIEndpoint> {
    // Debug
    const uniqueTimerID = Logging.traceStart('OCPIEndpointStorage', 'getOcpiEndpoint');
    const endpointsMDB = await OCPIEndpointStorage.getOcpiEndpoints(tenantID, { id: id }, Constants.DB_PARAMS_SINGLE_RECORD);

    // Debug
    Logging.traceEnd('OCPIEndpointStorage', 'getOcpiEndpoint', uniqueTimerID, { id });
    return endpointsMDB.count > 0 ? endpointsMDB.result[0] : null;
  }

  static async getOcpiEndpointByLocalToken(tenantID: string, token: string): Promise<OCPIEndpoint> {
    // Debug
    const uniqueTimerID = Logging.traceStart('OCPIEndpointStorage', 'getOcpiEndpoinByLocalToken');
    const endpointsMDB = await OCPIEndpointStorage.getOcpiEndpoints(tenantID, { localToken: token }, Constants.DB_PARAMS_SINGLE_RECORD);

    // Debug
    Logging.traceEnd('OCPIEndpointStorage', 'getOcpiEndpoinByLocalToken', uniqueTimerID, { token });
    return endpointsMDB.count > 0 ? endpointsMDB.result[0] : null;
  }

  static async saveOcpiEndpoint(tenantID: string, ocpiEndpointToSave: OCPIEndpoint): Promise<string> {
    // Debug
    const uniqueTimerID = Logging.traceStart('OCPIEndpointStorage', 'saveOcpiEndpoint');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check if name is provided
    if (!ocpiEndpointToSave.name) {
      // Name must be provided!
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: 'OCPIEndpointStorage',
        method: 'saveOcpiEndpoint',
        message: 'OCPIEndpoint has no Name'
      });
    }
    const ocpiEndpointFilter: any = {};
    // Build Request
    if (ocpiEndpointToSave.id) {
      ocpiEndpointFilter._id = Utils.convertToObjectID(ocpiEndpointToSave.id);
    } else {
      ocpiEndpointFilter._id = new ObjectID();
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
      backgroundPatchJob: ocpiEndpointToSave.backgroundPatchJob,
      status: ocpiEndpointToSave.status,
      version: ocpiEndpointToSave.version,
      businessDetails: ocpiEndpointToSave.businessDetails,
      availableEndpoints: ocpiEndpointToSave.availableEndpoints,
      versionUrl: ocpiEndpointToSave.versionUrl,
      lastPatchJobOn: ocpiEndpointToSave.lastPatchJobOn,
      lastPatchJobResult: ocpiEndpointToSave.lastPatchJobResult
    };
    // Add Last Changed/Created props
    DatabaseUtils.addLastChangedCreatedProps(ocpiEndpointMDB, ocpiEndpointToSave);
    // Modify
    await global.database.getCollection<any>(tenantID, 'ocpiendpoints').findOneAndUpdate(
      ocpiEndpointFilter,
      { $set: ocpiEndpointMDB },
      { upsert: true, returnOriginal: false });
    // Debug
    Logging.traceEnd('OCPIEndpointStorage', 'saveOcpiEndpoint', uniqueTimerID, { ocpiEndpointToSave });
    // Create
    return ocpiEndpointFilter._id.toHexString();
  }

  // Delegate
  static async getOcpiEndpoints(tenantID: string, params: { search?: string; role?: string; id?: string; localToken?: string }, dbParams: DbParams): Promise<DataResult<OCPIEndpoint>> {
    // Debug
    const uniqueTimerID = Logging.traceStart('OCPIEndpointStorage', 'getOcpiEndpoints');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check Limit
    const limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    const skip = Utils.checkRecordSkip(dbParams.skip);
    // Create Aggregation
    const aggregation: any[] = [];
    // Set the filters
    const filters: any = {};
    // Source?
    if (params.id) {
      filters._id = Utils.convertToObjectID(params.id);
    } else if (params.localToken) {
      filters.localToken = params.localToken;
    } else if (params.search) {
      // Build filter
      filters.$or = [
        { 'name': { $regex: params.search, $options: 'i' } }
      ];
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
    const ocpiEndpointsCountMDB = await global.database.getCollection<any>(tenantID, 'ocpiendpoints')
      .aggregate([...aggregation, { $count: 'count' }])
      .toArray();
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      return {
        count: (ocpiEndpointsCountMDB.length > 0 ? ocpiEndpointsCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();

    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);
    // Handle the ID
    DatabaseUtils.renameDatabaseID(aggregation);
    // Sort
    if (dbParams.sort) {
      // Sort
      aggregation.push({
        $sort: dbParams.sort
      });
    } else {
      // Default
      aggregation.push({
        $sort: {
          name: 1
        }
      });
    }
    // Skip
    aggregation.push({
      $skip: skip
    });
    // Limit
    aggregation.push({
      $limit: limit
    });
    // Read DB
    const ocpiEndpointsMDB = await global.database.getCollection<any>(tenantID, 'ocpiendpoints')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 } })
      .toArray();

    // Debug
    Logging.traceEnd('OCPIEndpointStorage', 'getOcpiEndpoints', uniqueTimerID, {
      params,
      limit,
      skip,
      sort: dbParams.sort
    });
    // Ok
    return {
      count: (ocpiEndpointsCountMDB.length > 0 ? ocpiEndpointsCountMDB[0].count : 0),
      result: ocpiEndpointsMDB
    };
  }

  static async deleteOcpiEndpoint(tenantID: string, id: string) {
    // Debug
    const uniqueTimerID = Logging.traceStart('OCPIEndpointStorage', 'deleteOcpiEndpoint');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Delete OcpiEndpoint
    await global.database.getCollection<any>(tenantID, 'ocpiendpoints')
      .findOneAndDelete({ '_id': Utils.convertToObjectID(id) });
    // Debug
    Logging.traceEnd('OCPIEndpointStorage', 'deleteOcpiEndpoint', uniqueTimerID, { id });
  }

  static async deleteOcpiEndpoints(tenantID: string) {
    // Debug
    const uniqueTimerID = Logging.traceStart('OCPIEndpointStorage', 'deleteOcpiEndpoints');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Delete OcpiEndpoint
    await global.database.getCollection<any>(tenantID, 'ocpiendpoints').deleteMany({});
    // Debug
    Logging.traceEnd('OCPIEndpointStorage', 'deleteOcpiEndpoints', uniqueTimerID);
  }
}
