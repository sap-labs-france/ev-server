import { ObjectID } from 'mongodb';
import BackendError from '../../exception/BackendError';
import Constants from '../../utils/Constants';
import Database from '../../utils/Database';
import DatabaseUtils from './DatabaseUtils';
import global from '../../types/GlobalType';
import Logging from '../../utils/Logging';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';
import DbParams from '../../types/database/DbParams';

export default class TenantStorage {
  public static async getTenant(id: string): Promise<Tenant> {
    // Debug
    const uniqueTimerID = Logging.traceStart('TenantStorage', 'getTenant');
    // Delegate querying
    const tenantsResult = await TenantStorage.getTenants({search: id}, {limit: 1, skip: 0});
    // Debug
    Logging.traceEnd('TenantStorage', 'getTenant', uniqueTimerID, { id });

    return tenantsResult.count>0 ? tenantsResult.result[0] : null;
  }

  public static async getTenantByName(name: string): Promise<Tenant> {
    const tenantsResult =  await TenantStorage.getTenants({ search: name, exact: true }, {limit: 1, skip: 0});
    return tenantsResult.count>0 ? tenantsResult.result[0] : null;
  }

  public static async getTenantBySubdomain(subdomain: string): Promise<Tenant> {
    const tenantsResult =  await TenantStorage.getTenants({ search: subdomain, exact: true }, {limit: 1, skip: 0});
    return tenantsResult.count>0 ? tenantsResult.result[0] : null;
  }

  public static async saveTenant(tenantToSave: Partial<Tenant>): Promise<string> {
    // Debug
    const uniqueTimerID = Logging.traceStart('TenantStorage', 'saveTenant');
    // Check
    if (!tenantToSave.id && !tenantToSave.name) {
      throw new BackendError(
        Constants.CENTRAL_SERVER,
        'Tenant has no ID and no Name',
        'TenantStorage', 'saveTenant');
    }
    const tenantFilter: any = {};
    // Build Request
    if (tenantToSave.id) {
      tenantFilter._id = Utils.convertToObjectID(tenantToSave.id);
    } else {
      tenantFilter._id = new ObjectID();
    }
    // Properties to save
    const tenantMDB = {
      ...tenantToSave,
      _id: tenantFilter._id,
      createdBy: tenantToSave.createdBy ? tenantToSave.createdBy.id : null,
      lastChangedBy: tenantToSave.lastChangedBy ? tenantToSave.lastChangedBy.id : null,
      components: tenantToSave.components ? tenantToSave.components : {}
    }
    // Clean up mongo request
    delete tenantMDB.id;
    delete tenantMDB._eMI3;
    DatabaseUtils.addLastChangedCreatedProps(tenantMDB, tenantMDB);
    // Modify
    const result = await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'tenants').findOneAndUpdate(
      tenantFilter,
      { $set: tenantMDB },
      { upsert: true, returnOriginal: false });
    // Debug
    Logging.traceEnd('TenantStorage', 'saveTenant', uniqueTimerID, { tenantToSave });
    // Create
    return tenantFilter._id.toHexString();
  }

  public static async createTenantDB(tenantID: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('TenantStorage', 'createTenantDB');
    // Create DB
    await global.database.checkAndCreateTenantDatabase(tenantID);
    // Debug
    Logging.traceEnd('TenantStorage', 'createTenantDB', uniqueTimerID, { tenantID });
  }

  // Delegate
  public static async getTenants(params: {search?: string, exact?: boolean}, {limit, skip, sort}: DbParams, projectFields?: string[]) {
    // Debug
    const uniqueTimerID = Logging.traceStart('TenantStorage', 'getTenants');
    // Check Limit
    limit = Utils.checkRecordLimit(limit);
    // Check Skip
    skip = Utils.checkRecordSkip(skip);
    // Set the filters
    const filters: any = {};
    if (params.search) {
      if (ObjectID.isValid(params.search)) {
        filters._id = Utils.convertToObjectID(params.search);
      } else {
        if(params.exact) {
          filters.$or = [
            { 'name': params.search },
            { 'subdomain': params.search }
          ]
        }else{
          filters.$or = [
            { 'name': { $regex: params.search, $options: 'i' } },
            { 'subdomain': { $regex: params.search, $options: 'i' } }
          ];
        }
      }
    }
    // Create Aggregation
    const aggregation = [];
    // Filters
    if (filters) {
      aggregation.push({
        $match: filters
      });
    }
    // Change ID
    DatabaseUtils.renameDatabaseID(aggregation);
    // Count Records
    const tenantsCountMDB = await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'tenants')
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation('', aggregation);
    // Sort
    if (sort) {
      // Sort
      aggregation.push({
        $sort: sort
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
    const tenantsMDB = await global.database.getCollection<Tenant>(Constants.DEFAULT_TENANT, 'tenants')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 }, allowDiskUse: true })
      .toArray();

    // Debug
    Logging.traceEnd('TenantStorage', 'getTenants', uniqueTimerID, { params, limit, skip, sort });
    // Ok
    return {
      count: (tenantsCountMDB.length > 0 ? tenantsCountMDB[0].count : 0),
      result: tenantsMDB
    };
  }

  public static async deleteTenant(id: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('TenantStorage', 'deleteTenant');
    // Delete
    await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'tenants')
      .findOneAndDelete({
        '_id': Utils.convertToObjectID(id)
      });
    // Debug
    Logging.traceEnd('TenantStorage', 'deleteTenant', uniqueTimerID, { id });
  }

  public static async deleteTenantDB(id: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('TenantStorage', 'deleteTenantDB');
    // Delete
    await global.database.deleteTenantDatabase(id);
    // Debug
    Logging.traceEnd('TenantStorage', 'deleteTenantDB', uniqueTimerID, { id });
  }
}
