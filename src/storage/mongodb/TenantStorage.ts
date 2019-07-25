import { ObjectID } from 'mongodb';
import BackendError from '../../exception/BackendError';
import Constants from '../../utils/Constants';
import Database from '../../utils/Database';
import DatabaseUtils from './DatabaseUtils';
import global from '../../types/GlobalType';
import Logging from '../../utils/Logging';
import Tenant from '../../entity/Tenant';
import Utils from '../../utils/Utils';
import DbParams from '../../types/database/DbParams';

export default class TenantStorage {
  public static async getTenant(id: string): Promise<Tenant> {
    // Debug
    const uniqueTimerID = Logging.traceStart('TenantStorage', 'getTenant');
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: {
        _id: Utils.convertToObjectID(id)
      }
    });
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation('', aggregation);
    // Read DB
    const tenantsMDB = await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'tenants')
      .aggregate(aggregation)
      .limit(1)
      .toArray();

    let tenant = null;
    // Found?
    if (tenantsMDB && tenantsMDB.length > 0) {
      // Create
      tenant = new Tenant(tenantsMDB[0]);
    }
    // Debug
    Logging.traceEnd('TenantStorage', 'getTenant', uniqueTimerID, { id });

    return tenant;
  }

  static async getTenantByName(name) {
    // Get
    return await TenantStorage.getTenantByFilter({ 'name': name });
  }

  static async getTenantBySubdomain(subdomain) {
    // Get
    return await TenantStorage.getTenantByFilter({ 'subdomain': subdomain });
  }

  static async getTenantByFilter(filter) {
    // Debug
    const uniqueTimerID = Logging.traceStart('TenantStorage', 'getTenantByFilter');
    // Read DB
    const tenantsMDB = await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'tenants')
      .find(filter)
      .limit(1)
      .toArray();
    let tenant = null;
    // Found?
    if (tenantsMDB && tenantsMDB.length > 0) {
      // Create
      tenant = new Tenant(tenantsMDB[0]);
    }
    // Debug
    Logging.traceEnd('TenantStorage', 'getTenantByFilter', uniqueTimerID, { filter });
    return tenant;
  }

  static async saveTenant(tenantToSave) {
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
    // Check Created By/On
    tenantToSave.createdBy = Utils.convertUserToObjectID(tenantToSave.createdBy);
    tenantToSave.lastChangedBy = Utils.convertUserToObjectID(tenantToSave.lastChangedBy);
    // Transfer
    const tenant: any = {};
    Database.updateTenant(tenantToSave, tenant, false);
    // Modify
    const result = await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'tenants').findOneAndUpdate(
      tenantFilter, {
        $set: tenant
      }, {
        upsert: true,
        returnOriginal: false
      });
    // Debug
    Logging.traceEnd('TenantStorage', 'saveTenant', uniqueTimerID, { tenantToSave });
    // Create
    return new Tenant(result.value);
  }

  static async createTenantDB(tenantID) {
    // Debug
    const uniqueTimerID = Logging.traceStart('TenantStorage', 'createTenantDB');
    // Create DB
    await global.database.checkAndCreateTenantDatabase(tenantID);
    // Debug
    Logging.traceEnd('TenantStorage', 'createTenantDB', uniqueTimerID, { tenantID });
  }

  // Delegate
  public static async getTenants(params: {search?: string}, {limit, skip, sort}: DbParams, projectFields?: string[]) {
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
        filters.$or = [
          { 'name': { $regex: params.search, $options: 'i' } }
        ];
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
    const tenantsMDB = await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'tenants')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 }, allowDiskUse: true })
      .toArray();

    const tenants = [];
    // Create
    for (const tenantMDB of tenantsMDB) {
      // Add
      tenants.push(new Tenant(tenantMDB));
    }
    // Debug
    Logging.traceEnd('TenantStorage', 'getTenants', uniqueTimerID, { params, limit, skip, sort });
    // Ok
    return {
      count: (tenantsCountMDB.length > 0 ? tenantsCountMDB[0].count : 0),
      result: tenants
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
