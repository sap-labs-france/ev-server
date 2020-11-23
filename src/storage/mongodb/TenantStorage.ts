import global, { FilterParams } from '../../types/GlobalType';

import BackendError from '../../exception/BackendError';
import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import { LockEntity } from '../../types/Locking';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import { ObjectID } from 'mongodb';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'TenantStorage';

export default class TenantStorage {
  private static tenants = new Map<string, Tenant>();

  public static clearCache(tenantID?: string): void {
    if (tenantID) {
      TenantStorage.tenants.delete(tenantID);
    } else {
      TenantStorage.tenants.clear();
    }
  }

  public static async getTenant(id: string = Constants.UNKNOWN_OBJECT_ID, projectFields?: string[]): Promise<Tenant> {
    // Check in cache
    const tenant = TenantStorage.tenants.get(id);
    if (!tenant) {
      // Call DB
      const tenantsMDB = await TenantStorage.getTenants({
        tenantIDs: [id],
        withLogo: true,
      }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
      // Add in cache
      if (tenantsMDB.count > 0) {
        TenantStorage.tenants.set(id, tenantsMDB.result[0]);
      }
      return tenantsMDB.count === 1 ? tenantsMDB.result[0] : null;
    }
    return tenant;
  }

  public static async getTenantByName(name: string): Promise<Tenant> {
    const tenantsMDB = await TenantStorage.getTenants({
      tenantName: name
    }, Constants.DB_PARAMS_SINGLE_RECORD);
    return tenantsMDB.count === 1 ? tenantsMDB.result[0] : null;
  }

  public static async getTenantBySubdomain(subdomain: string): Promise<Tenant> {
    const tenantsMDB = await TenantStorage.getTenants({
      tenantSubdomain: subdomain
    }, Constants.DB_PARAMS_SINGLE_RECORD);
    return tenantsMDB.count === 1 ? tenantsMDB.result[0] : null;
  }

  public static async saveTenant(tenantToSave: Partial<Tenant>, saveLogo = true): Promise<string> {
    // Debug
    const uniqueTimerID = Logging.traceStart(Constants.DEFAULT_TENANT, MODULE_NAME, 'saveTenant');
    // Check
    if (!tenantToSave.id && !tenantToSave.name) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'saveTenant',
        message: 'Tenant has no ID and no Name'
      });
    }
    const tenantFilter: any = {};
    // Build Request
    if (tenantToSave.id) {
      tenantFilter._id = Utils.convertToObjectID(tenantToSave.id);
    } else {
      tenantFilter._id = new ObjectID();
    }
    // Properties to save
    // eslint-disable-next-line prefer-const
    let tenantMDB = {
      _id: tenantFilter._id,
      name: tenantToSave.name,
      email: tenantToSave.email,
      subdomain: tenantToSave.subdomain,
      components: tenantToSave.components ? tenantToSave.components : {},
    };
    if (tenantToSave.address) {
      Object.assign(tenantMDB, {
        address: {
          address1: tenantToSave.address.address1,
          address2: tenantToSave.address.address2,
          postalCode: tenantToSave.address.postalCode,
          city: tenantToSave.address.city,
          department: tenantToSave.address.department,
          region: tenantToSave.address.region,
          country: tenantToSave.address.country,
          coordinates: Utils.containsGPSCoordinates(tenantToSave.address.coordinates) ? tenantToSave.address.coordinates.map(
            (coordinate) => Utils.convertToFloat(coordinate)) : [],
        }
      });
    }
    DatabaseUtils.addLastChangedCreatedProps(tenantMDB, tenantToSave);
    // Modify
    await global.database.getCollection<Tenant>(Constants.DEFAULT_TENANT, 'tenants').findOneAndUpdate(
      tenantFilter,
      { $set: tenantMDB },
      { upsert: true, returnOriginal: false });
    // Save Logo
    if (saveLogo) {
      await TenantStorage._saveTenantLogo(tenantMDB._id.toHexString(), tenantToSave.logo);
    }
    // Update cache
    TenantStorage.clearCache(tenantToSave.id);
    // Debug
    Logging.traceEnd(Constants.DEFAULT_TENANT, MODULE_NAME, 'saveTenant', uniqueTimerID, tenantMDB);
    return tenantFilter._id.toHexString();
  }

  public static async createTenantDB(tenantID: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'createTenantDB');
    // Database creation Lock
    const createDatabaseLock = LockingManager.createExclusiveLock(tenantID, LockEntity.DATABASE, 'create-database');
    if (await LockingManager.acquire(createDatabaseLock)) {
      try {
        // Create tenant collections
        await global.database.checkAndCreateTenantDatabase(tenantID);
      } finally {
        // Release the database creation Lock
        await LockingManager.release(createDatabaseLock);
      }
    }
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'createTenantDB', uniqueTimerID, { tenantID });
  }

  // Delegate
  public static async getTenants(
    params: { tenantIDs?: string[]; tenantName?: string; tenantSubdomain?: string; search?: string, withLogo?: boolean },
    dbParams: DbParams, projectFields?: string[]): Promise<DataResult<Tenant>> {
    // Debug
    const uniqueTimerID = Logging.traceStart(Constants.DEFAULT_TENANT, MODULE_NAME, 'getTenants');
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Set the filters
    const filters: FilterParams = {};
    if (params.search) {
      const searchRegex = Utils.escapeSpecialCharsInRegex(params.search);
      filters.$or = [
        { 'name': { $regex: searchRegex, $options: 'i' } },
        { 'subdomain': { $regex: searchRegex, $options: 'i' } }
      ];
    }
    // Tenant
    if (!Utils.isEmptyArray(params.tenantIDs)) {
      filters._id = {
        $in: params.tenantIDs.map((tenantID) => Utils.convertToObjectID(tenantID))
      };
    }
    // Name
    if (params.tenantName) {
      filters.name = params.tenantName;
    }
    // Subdomain
    if (params.tenantSubdomain) {
      filters.subdomain = params.tenantSubdomain;
    }
    // Create Aggregation
    const aggregation = [];
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
    const tenantsCountMDB = await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'tenants')
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      // Return only the count
      Logging.traceEnd(Constants.DEFAULT_TENANT, MODULE_NAME, 'getTenants', uniqueTimerID, tenantsCountMDB);
      return {
        count: (tenantsCountMDB.length > 0 ? tenantsCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
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
    // Company Logo
    if (params.withLogo) {
      aggregation.push({
        $addFields: {
          logo: {
            $concat: [
              `${Utils.buildRestServerURL()}/client/util/TenantLogo?ID=`,
              { $toString: '$_id' },
              '&LastChangedOn=',
              { $toString: '$lastChangedOn' }
            ]
          }
        }
      });
    }
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(Constants.DEFAULT_TENANT, aggregation);
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const tenantsMDB = await global.database.getCollection<Tenant>(Constants.DEFAULT_TENANT, 'tenants')
      .aggregate(aggregation, {
        collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 },
        allowDiskUse: true
      }).toArray();
    // Debug
    Logging.traceEnd(Constants.DEFAULT_TENANT, MODULE_NAME, 'getTenants', uniqueTimerID, tenantsMDB);
    // Ok
    return {
      count: (tenantsCountMDB.length > 0 ?
        (tenantsCountMDB[0].count === Constants.DB_RECORD_COUNT_CEIL ? -1 : tenantsCountMDB[0].count) : 0),
      result: tenantsMDB
    };
  }

  public static async deleteTenant(id: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(Constants.DEFAULT_TENANT, MODULE_NAME, 'deleteTenant');
    // Delete
    await global.database.getCollection<Tenant>(Constants.DEFAULT_TENANT, 'tenants')
      .findOneAndDelete({
        '_id': Utils.convertToObjectID(id)
      });
    // Update cache
    TenantStorage.clearCache(id);
    // Debug
    Logging.traceEnd(Constants.DEFAULT_TENANT, MODULE_NAME, 'deleteTenant', uniqueTimerID, { id });
  }

  public static async deleteTenantDB(id: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(Constants.DEFAULT_TENANT, MODULE_NAME, 'deleteTenantDB');
    // Delete
    await global.database.deleteTenantDatabase(id);
    // Update cache
    TenantStorage.clearCache(id);
    // Debug
    Logging.traceEnd(Constants.DEFAULT_TENANT, MODULE_NAME, 'deleteTenantDB', uniqueTimerID, { id });
  }

  public static async getTenantLogo(tenantID: string): Promise<{ id: string; logo: string }> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getTenantLogo');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const tenantLogoMDB = await global.database.getCollection<{ _id: ObjectID; logo: string }>(Constants.DEFAULT_TENANT, 'tenantlogos')
      .findOne({ _id: Utils.convertToObjectID(tenantID) });
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'getTenantLogo', uniqueTimerID, tenantLogoMDB);
    return {
      id: tenantID,
      logo: tenantLogoMDB ? tenantLogoMDB.logo : null
    };
  }

  private static async _saveTenantLogo(tenantID: string, tenantLogoToSave: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'saveTenantLogo');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Modify
    await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'tenantlogos').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(tenantID) },
      { $set: { logo: tenantLogoToSave } },
      { upsert: true });
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'saveTenantLogo', uniqueTimerID, tenantLogoToSave);
  }
}
