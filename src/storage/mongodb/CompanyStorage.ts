import global, { FilterParams } from '../../types/GlobalType';

import Company from '../../types/Company';
import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import { ObjectID } from 'mongodb';
import SiteStorage from './SiteStorage';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'CompanyStorage';

export default class CompanyStorage {

  public static async getCompany(tenantID: string, id: string = Constants.UNKNOWN_OBJECT_ID, projectFields?: string[]): Promise<Company> {
    const companiesMDB = await CompanyStorage.getCompanies(tenantID, {
      companyIDs: [id],
      withLogo: true,
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return companiesMDB.count === 1 ? companiesMDB.result[0] : null;
  }

  public static async getCompanyLogo(tenantID: string, id: string): Promise<{ id: string; logo: string }> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getCompanyLogo');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const companyLogoMDB = await global.database.getCollection<{ _id: ObjectID; logo: string }>(tenantID, 'companylogos')
      .findOne({ _id: Utils.convertToObjectID(id) });
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'getCompanyLogo', uniqueTimerID, companyLogoMDB);
    return {
      id: id,
      logo: companyLogoMDB ? companyLogoMDB.logo : null
    };
  }

  public static async saveCompany(tenantID: string, companyToSave: Company, saveLogo = true): Promise<string> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'saveCompany');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Set
    const companyMDB: any = {
      _id: !companyToSave.id ? new ObjectID() : Utils.convertToObjectID(companyToSave.id),
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
        coordinates: Utils.containsGPSCoordinates(companyToSave.address.coordinates) ? companyToSave.address.coordinates.map(
          (coordinate) => Utils.convertToFloat(coordinate)) : [],
      };
    }
    // Add Last Changed/Created props
    DatabaseUtils.addLastChangedCreatedProps(companyMDB, companyToSave);
    // Modify
    await global.database.getCollection<Company>(tenantID, 'companies').findOneAndUpdate(
      { _id: companyMDB._id },
      { $set: companyMDB },
      { upsert: true }
    );
    // Save Logo
    if (saveLogo) {
      await CompanyStorage.saveCompanyLogo(tenantID, companyMDB._id.toHexString(), companyToSave.logo);
    }
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'saveCompany', uniqueTimerID, companyMDB);
    return companyMDB._id.toHexString();
  }

  public static async getCompanies(tenantID: string,
    params: { search?: string; issuer?: boolean; companyIDs?: string[]; withSites?: boolean; withLogo?: boolean;
      locCoordinates?: number[]; locMaxDistanceMeters?: number; } = {},
    dbParams?: DbParams, projectFields?: string[]): Promise<DataResult<Company>> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getCompanies');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Create Aggregation
    const aggregation = [];
    // Position coordinates
    if (Utils.containsGPSCoordinates(params.locCoordinates)) {
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
      const searchRegex = Utils.escapeSpecialCharsInRegex(params.search);
      filters.$or = [
        { 'name': { $regex: searchRegex, $options: 'i' } },
        { 'address.city': { $regex: searchRegex, $options: 'i' } },
        { 'address.country': { $regex: searchRegex, $options: 'i' } }
      ];
    }
    // Limit on Company for Basic Users
    if (!Utils.isEmptyArray(params.companyIDs)) {
      // Build filter
      filters._id = {
        $in: params.companyIDs.map((companyID) => Utils.convertToObjectID(companyID))
      };
    }
    if (Utils.objectHasProperty(params, 'issuer') && Utils.isBooleanValue(params.issuer)) {
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
    const companiesCountMDB = await global.database.getCollection<DataResult<Company>>(tenantID, 'companies')
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      // Return only the count
      Logging.traceEnd(tenantID, MODULE_NAME, 'getCompanies', uniqueTimerID, companiesCountMDB);
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
    if (Utils.containsGPSCoordinates(params.locCoordinates)) {
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
      $limit: (dbParams.limit > 0 && dbParams.limit < Constants.DB_RECORD_COUNT_CEIL) ? dbParams.limit : Constants.DB_RECORD_COUNT_CEIL
    });
    // Site
    if (params.withSites) {
      DatabaseUtils.pushSiteLookupInAggregation(
        { tenantID, aggregation, localField: '_id', foreignField: 'companyID', asField: 'sites' });
    }
    // Company Logo
    if (params.withLogo) {
      aggregation.push({
        $addFields: {
          logo: {
            $concat: [
              `${Utils.buildRestServerURL()}/client/util/CompanyLogo?ID=`,
              { $toString: '$_id' },
              `&TenantID=${tenantID}&LastChangedOn=`,
              { $toString: '$lastChangedOn' }
            ]
          }
        }
      });
    }
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const companiesMDB = await global.database.getCollection<any>(tenantID, 'companies')
      .aggregate(aggregation, {
        collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 },
        allowDiskUse: true
      })
      .toArray();
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'getCompanies', uniqueTimerID, companiesMDB);
    // Ok
    return {
      count: (companiesCountMDB.length > 0 ?
        (companiesCountMDB[0].count === Constants.DB_RECORD_COUNT_CEIL ? -1 : companiesCountMDB[0].count) : 0),
      result: companiesMDB
    };
  }

  public static async deleteCompany(tenantID: string, id: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'deleteCompany');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Delete sites associated with Company
    await SiteStorage.deleteCompanySites(tenantID, id);
    // Delete the Company
    await global.database.getCollection<Company>(tenantID, 'companies')
      .findOneAndDelete({ '_id': Utils.convertToObjectID(id) });
    // Delete Logo
    await global.database.getCollection<any>(tenantID, 'companylogos')
      .findOneAndDelete({ '_id': Utils.convertToObjectID(id) });
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'deleteCompany', uniqueTimerID, { id });
  }

  private static async saveCompanyLogo(tenantID: string, companyID: string, companyLogoToSave: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'saveCompanyLogo');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Modify
    await global.database.getCollection<any>(tenantID, 'companylogos').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(companyID) },
      { $set: { logo: companyLogoToSave } },
      { upsert: true });
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'saveCompanyLogo', uniqueTimerID, companyLogoToSave);
  }
}
