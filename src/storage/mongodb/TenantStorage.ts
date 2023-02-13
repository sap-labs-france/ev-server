import Tenant, { TenantLogo } from '../../types/Tenant';
import global, { DatabaseCount, FilterParams } from '../../types/GlobalType';

import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import { ObjectId } from 'mongodb';
import TenantValidatorStorage from '../validator/TenantValidatorStorage';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'TenantStorage';

export default class TenantStorage {

  public static async getTenantFromCache(id: string = Constants.UNKNOWN_OBJECT_ID,
      params: { withLogo?: boolean; } = {}): Promise<Tenant> {
    // Cache enabled ?
    if (global?.cache) {
      return await global.cache.get(id, id, TenantStorage.getTenant.bind(this, id, params, []));
    }
    return await TenantStorage.getTenant(id, params, []);
  }

  public static async getTenant(id: string = Constants.UNKNOWN_OBJECT_ID,
      params: { withLogo?: boolean; } = {}, projectFields?: string[]): Promise<Tenant> {
    // Call DB
    const tenantsMDB = await TenantStorage.getTenants({
      tenantIDs: [id],
      withLogo: params.withLogo,
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return tenantsMDB.count === 1 ? tenantsMDB.result[0] : null;
  }

  public static async getTenantByName(name: string, projectFields?: string[]): Promise<Tenant> {
    const tenantsMDB = await TenantStorage.getTenants({
      tenantName: name
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return tenantsMDB.count === 1 ? tenantsMDB.result[0] : null;
  }

  public static async getTenantBySubdomain(subdomain: string, projectFields?: string[]): Promise<Tenant> {
    const tenantsMDB = await TenantStorage.getTenants({
      tenantSubdomain: subdomain
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return tenantsMDB.count === 1 ? tenantsMDB.result[0] : null;
  }

  public static async saveTenant(tenantToSave: Partial<Tenant>, saveLogo = true): Promise<string> {
    const startTime = Logging.traceDatabaseRequestStart();
    const tenantMDB = TenantValidatorStorage.getInstance().validateTenantSave(tenantToSave);
    // Build Request
    DatabaseUtils.switchIDToMongoDBID(tenantMDB);
    // Add Last Changed/Created props
    DatabaseUtils.addLastChangedCreatedProps(tenantMDB, tenantToSave);
    // Modify
    await global.database.getCollection<Tenant>(Constants.DEFAULT_TENANT_ID, 'tenants').findOneAndUpdate(
      { _id: tenantMDB['_id'] },
      { $set: tenantMDB as any },
      { upsert: true, returnDocument: 'after' });
    // Save Logo
    if (saveLogo) {
      // Modify
      await global.database.getCollection<any>(Constants.DEFAULT_TENANT_ID, 'tenantlogos').findOneAndUpdate(
        { '_id': tenantMDB['_id'] },
        { $set: { logo: tenantToSave.logo } },
        { upsert: true });
    }
    await Logging.traceDatabaseRequestEnd(Constants.DEFAULT_TENANT_OBJECT, MODULE_NAME, 'saveTenant', startTime, { tenant: tenantMDB, logo: tenantMDB.logo });
    return tenantMDB['_id'].toString();
  }

  public static async createTenantDB(tenantID: string): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    // Create tenant collections
    await global.database.checkAndCreateTenantDatabase(tenantID);
    await Logging.traceDatabaseRequestEnd(Constants.DEFAULT_TENANT_OBJECT, MODULE_NAME, 'createTenantDB', startTime, { tenantID });
  }

  // Delegate
  public static async getTenants(
      params: { tenantIDs?: string[]; tenantName?: string; tenantSubdomain?: string; search?: string, withLogo?: boolean },
      dbParams: DbParams, projectFields?: string[]): Promise<DataResult<Tenant>> {
    const startTime = Logging.traceDatabaseRequestStart();
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Set the filters
    const filters: FilterParams = {};
    if (params.search) {
      filters.$or = [
        { 'name': { $regex: params.search, $options: 'i' } },
        { 'subdomain': { $regex: params.search, $options: 'i' } }
      ];
    }
    // Tenant
    if (!Utils.isEmptyArray(params.tenantIDs)) {
      filters._id = {
        $in: params.tenantIDs.map((tenantID) => DatabaseUtils.convertToObjectID(tenantID))
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
    const tenantsCountMDB = await global.database.getCollection<any>(Constants.DEFAULT_TENANT_ID, 'tenants')
      .aggregate([...aggregation, { $count: 'count' }], DatabaseUtils.buildAggregateOptions())
      .toArray() as DatabaseCount[];
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      // Return only the count
      await Logging.traceDatabaseRequestEnd(Constants.DEFAULT_TENANT_OBJECT, MODULE_NAME, 'getTenants', startTime, aggregation, tenantsCountMDB);
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
      DatabaseUtils.pushTenantLogoLookupInAggregation({
        tenantID: Constants.DEFAULT_TENANT_ID, aggregation, localField: '_id', foreignField: '_id',
        asField: 'tenantLogo', oneToOneCardinality: true
      });
      aggregation.push({
        $addFields: {
          logo: {
            $cond: {
              if: { $and: [{ $gt: ['$tenantLogo.logo', null] }, { $ne: ['$tenantLogo.logo', ''] }] }, then: {
                $concat: [
                  `${Utils.buildRestServerURL()}/v1/util/tenants/logo?ID=`,
                  { $toString: '$_id' },
                  {
                    $ifNull: [{ $concat: ['&LastChangedOn=', { $toString: '$lastChangedOn' }] }, ''] // Only concat 'lastChangedOn' if not null
                  }
                ]
              }, else: null
            }
          }
        }
      });
    }
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(Constants.DEFAULT_TENANT_ID, aggregation);
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const tenantsMDB = await global.database.getCollection<any>(Constants.DEFAULT_TENANT_ID, 'tenants')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as Tenant[];
    await Logging.traceDatabaseRequestEnd(Constants.DEFAULT_TENANT_OBJECT, MODULE_NAME, 'getTenants', startTime, aggregation, tenantsMDB);
    return {
      count: DatabaseUtils.getCountFromDatabaseCount(tenantsCountMDB[0]),
      result: tenantsMDB
    };
  }

  public static async deleteTenant(id: string): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    // Delete
    await global.database.getCollection<any>(Constants.DEFAULT_TENANT_ID, 'tenants')
      .findOneAndDelete({
        '_id': DatabaseUtils.convertToObjectID(id)
      });
    // Delete logo
    await global.database.getCollection<any>(Constants.DEFAULT_TENANT_ID, 'tenantlogos')
      .findOneAndDelete({
        '_id': DatabaseUtils.convertToObjectID(id)
      });
    await Logging.traceDatabaseRequestEnd(Constants.DEFAULT_TENANT_OBJECT, MODULE_NAME, 'deleteTenant', startTime, { id });
  }

  public static async deleteTenantDB(id: string): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    // Delete
    await global.database.deleteTenantDatabase(id);
    await Logging.traceDatabaseRequestEnd(Constants.DEFAULT_TENANT_OBJECT, MODULE_NAME, 'deleteTenantDB', startTime, { id });
  }

  public static async getTenantLogo(tenant: Tenant): Promise<TenantLogo> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    let tenantLogoMDB: { _id: ObjectId; logo: string };
    // Read DB
    if (DatabaseUtils.isObjectID(tenant.id)) {
      tenantLogoMDB = await global.database.getCollection<any>(Constants.DEFAULT_TENANT_ID, 'tenantlogos')
        .findOne({ _id: DatabaseUtils.convertToObjectID(tenant.id) });
      await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getTenantLogo', startTime, { id: tenant.id }, tenantLogoMDB);
    }
    return {
      id: tenant.id,
      logo: tenantLogoMDB?.logo ?? null
    };
  }
}
