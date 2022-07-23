import Tenant, { TenantComponents } from '../../types/Tenant';
import global, { DatabaseCount, FilterParams, Logo } from '../../types/GlobalType';

import Company from '../../types/Company';
import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import { ObjectId } from 'mongodb';
import SiteStorage from './SiteStorage';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'CompanyStorage';

export default class CompanyStorage {

  public static async getCompany(tenant: Tenant, id: string = Constants.UNKNOWN_OBJECT_ID,
      params: { withLogo?: boolean; issuer?: boolean; } = {},
      projectFields?: string[]): Promise<Company> {
    const companiesMDB = await CompanyStorage.getCompanies(tenant, {
      companyIDs: [id],
      withLogo: params.withLogo,
      issuer: params.issuer,
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return companiesMDB.count === 1 ? companiesMDB.result[0] : null;
  }

  public static async getCompanyLogo(tenant: Tenant, id: string): Promise<Logo> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Read DB
    const companyLogoMDB = await global.database.getCollection<any>(tenant.id, 'companylogos')
      .findOne({ _id: DatabaseUtils.convertToObjectID(id) }) as Logo;
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getCompanyLogo', startTime, { id }, companyLogoMDB);
    return {
      id: id,
      logo: companyLogoMDB ? companyLogoMDB.logo : null
    };
  }

  public static async saveCompany(tenant: Tenant, companyToSave: Company, saveLogo = true): Promise<string> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Set
    const companyMDB: any = {
      _id: !companyToSave.id ? new ObjectId() : DatabaseUtils.convertToObjectID(companyToSave.id),
      name: companyToSave.name,
      issuer: Utils.convertToBoolean(companyToSave.issuer),
    };
    if (companyToSave.address) {
      companyMDB.address = {
        address1: companyToSave.address.address1,
        address2: companyToSave.address.address2,
        postalCode: companyToSave.address.postalCode,
        city: companyToSave.address.city,
        department: companyToSave.address.department,
        region: companyToSave.address.region,
        country: companyToSave.address.country,
        coordinates: Utils.hasValidGpsCoordinates(companyToSave.address.coordinates) ? companyToSave.address.coordinates.map(
          (coordinate) => Utils.convertToFloat(coordinate)) : [],
      };
    }
    if (Utils.isTenantComponentActive(tenant, TenantComponents.BILLING_PLATFORM)) {
      if (companyToSave.accountData?.accountID) {
        companyMDB.accountData = {
          accountID: DatabaseUtils.convertToObjectID(companyToSave.accountData.accountID),
          platformFeeStrategy: {
            flatFeePerSession: companyToSave.accountData.platformFeeStrategy?.flatFeePerSession || 0,
            percentage: companyToSave.accountData.platformFeeStrategy?.percentage || 0,
          }
        };
      } else {
        companyMDB.accountData = null;
      }
    }
    // Add Last Changed/Created props
    DatabaseUtils.addLastChangedCreatedProps(companyMDB, companyToSave);
    // Modify
    await global.database.getCollection<any>(tenant.id, 'companies').findOneAndUpdate(
      { _id: companyMDB._id },
      { $set: companyMDB },
      { upsert: true }
    );
    // Save Logo
    if (saveLogo) {
      await CompanyStorage.saveCompanyLogo(tenant, companyMDB._id.toString(), companyToSave.logo);
    }
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveCompany', startTime, companyMDB);
    return companyMDB._id.toString();
  }

  public static async getCompanies(tenant: Tenant,
      params: { search?: string; issuer?: boolean; companyIDs?: string[]; withSite?: boolean; withLogo?: boolean;
        locCoordinates?: number[]; locMaxDistanceMeters?: number; } = {},
      dbParams?: DbParams, projectFields?: string[]): Promise<DataResult<Company>> {
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
    // Position coordinates
    if (Utils.hasValidGpsCoordinates(params.locCoordinates)) {
      aggregation.push({
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: params.locCoordinates
          },
          distanceField: 'distanceMeters',
          maxDistance: params.locMaxDistanceMeters > 0 ? params.locMaxDistanceMeters : Constants.MAX_GPS_DISTANCE_METERS,
          spherical: true
        }
      });
    }
    // Set the filters
    const filters: FilterParams = {};
    if (params.search) {
      filters.$or = [
        { 'name': { $regex: params.search, $options: 'i' } },
        { 'address.address1': { $regex: params.search, $options: 'i' } },
        { 'address.postalCode': { $regex: params.search, $options: 'i' } },
        { 'address.city': { $regex: params.search, $options: 'i' } },
        { 'address.region': { $regex: params.search, $options: 'i' } },
        { 'address.country': { $regex: params.search, $options: 'i' } },
      ];
      if (DatabaseUtils.isObjectID(params.search)) {
        filters.$or.push({ '_id': DatabaseUtils.convertToObjectID(params.search) });
      }
    }
    // Limit on Company for Basic Users
    if (!Utils.isEmptyArray(params.companyIDs)) {
      // Build filter
      filters._id = {
        $in: params.companyIDs.map((companyID) => DatabaseUtils.convertToObjectID(companyID))
      };
    }
    if (Utils.objectHasProperty(params, 'issuer') && Utils.isBoolean(params.issuer)) {
      aggregation.push({
        $match: {
          'issuer': params.issuer
        }
      });
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
    const companiesCountMDB = await global.database.getCollection<any>(tenant.id, 'companies')
      .aggregate([...aggregation, { $count: 'count' }], DatabaseUtils.buildAggregateOptions())
      .toArray() as DatabaseCount[];
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      // Return only the count
      await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getCompanies', startTime, aggregation, companiesCountMDB);
      return {
        count: (companiesCountMDB.length > 0 ? companiesCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Sort
    if (!dbParams.sort) {
      dbParams.sort = { name: 1 };
    }
    // Position coordinates
    if (Utils.hasValidGpsCoordinates(params.locCoordinates)) {
      dbParams.sort = { distanceMeters: 1 };
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
    // Site
    if (params.withSite) {
      DatabaseUtils.pushSiteLookupInAggregation(
        { tenantID: tenant.id, aggregation, localField: '_id', foreignField: 'companyID', asField: 'sites' });
    }
    // Connected account
    if (Utils.isTenantComponentActive(tenant, TenantComponents.BILLING_PLATFORM)) {
      // Account data
      DatabaseUtils.pushAccountLookupInAggregation({
        tenantID: tenant.id, aggregation,
        asField: 'accountData.account', localField: 'accountData.accountID',
        foreignField: '_id', oneToOneCardinality: true, oneToOneCardinalityNotNull: false
      });
      // Business Owner
      DatabaseUtils.pushUserLookupInAggregation({
        tenantID: tenant.id, aggregation: aggregation,
        asField: 'accountData.account.businessOwner',
        localField: 'accountData.account.businessOwnerID',
        foreignField: '_id', oneToOneCardinality: true, oneToOneCardinalityNotNull: false
      });
    }
    // Company Logo
    if (params.withLogo) {
      aggregation.push({
        $addFields: {
          logo: {
            $concat: [
              `${Utils.buildRestServerURL()}/v1/util/companies/`,
              { $toString: '$_id' },
              '/logo',
              `?TenantID=${tenant.id}`,
              {
                $ifNull: [{ $concat: ['&LastChangedOn=', { $toString: '$lastChangedOn' }] }, ''] // Only concat 'lastChangedOn' if not null
              }
            ]
          }
        }
      });
    }
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenant.id, aggregation);
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const companiesMDB = await global.database.getCollection<any>(tenant.id, 'companies')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as Company[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getCompanies', startTime, aggregation, companiesMDB);
    return {
      count: DatabaseUtils.getCountFromDatabaseCount(companiesCountMDB[0]),
      result: companiesMDB,
      projectFields: projectFields
    };
  }

  public static async deleteCompany(tenant: Tenant, id: string): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Delete sites associated with Company
    await SiteStorage.deleteCompanySites(tenant, id);
    // Delete the Company
    await global.database.getCollection<any>(tenant.id, 'companies')
      .findOneAndDelete({ '_id': DatabaseUtils.convertToObjectID(id) });
    // Delete Logo
    await global.database.getCollection<any>(tenant.id, 'companylogos')
      .findOneAndDelete({ '_id': DatabaseUtils.convertToObjectID(id) });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'deleteCompany', startTime, { id });
  }

  private static async saveCompanyLogo(tenant: Tenant, companyID: string, companyLogoToSave: string): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Modify
    await global.database.getCollection<any>(tenant.id, 'companylogos').findOneAndUpdate(
      { '_id': DatabaseUtils.convertToObjectID(companyID) },
      { $set: { logo: companyLogoToSave } },
      { upsert: true });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveCompanyLogo', startTime, companyLogoToSave);
  }
}
