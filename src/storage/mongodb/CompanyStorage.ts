import { ObjectID } from 'mongodb';
import BackendError from '../../exception/BackendError';
import Company from '../../types/Company';
import Constants from '../../utils/Constants';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import global from '../../types/GlobalType';
import Logging from '../../utils/Logging';
import SiteStorage from './SiteStorage';
import Utils from '../../utils/Utils';

export default class CompanyStorage {

  public static async getCompany(tenantID: string, id: string): Promise<Company> {
    // Debug
    const uniqueTimerID = Logging.traceStart('CompanyStorage', 'getCompany');
    // Reuse
    const companiesMDB = await CompanyStorage.getCompanies(tenantID, { search: id }, Constants.DB_PARAMS_SINGLE_RECORD);
    let company: Company = null;
    // Check
    if (companiesMDB && companiesMDB.count > 0) {
      company = companiesMDB.result[0];
    }
    // Debug
    Logging.traceEnd('CompanyStorage', 'getCompany', uniqueTimerID, { id });
    return company;
  }

  public static async getCompanyLogo(tenantID: string, id: string): Promise<{id: string; logo: string}> {
    // Debug
    const uniqueTimerID = Logging.traceStart('CompanyStorage', 'getCompanyLogo');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const companyLogosMDB = await global.database.getCollection<{_id: string; logo: string}>(tenantID, 'companylogos')
      .find({ _id: Utils.convertToObjectID(id) })
      .limit(1)
      .toArray();
    let companyLogo: {id: string; logo: string} = null;
    // Set
    if (companyLogosMDB && companyLogosMDB.length > 0) {
      companyLogo = {
        id: companyLogosMDB[0]._id,
        logo: companyLogosMDB[0].logo
      };
    }
    // Debug
    Logging.traceEnd('CompanyStorage', 'getCompanyLogo', uniqueTimerID, { id });
    return companyLogo;
  }

  public static async saveCompany(tenantID: string, companyToSave: Company, saveLogo = true): Promise<string> {
    // Debug
    const uniqueTimerID = Logging.traceStart('CompanyStorage', 'saveCompany');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Set
    let companyMDB: any = {
      _id: !companyToSave.id ? new ObjectID() : Utils.convertToObjectID(companyToSave.id),
      name: companyToSave.name
    };
    if (companyToSave.address) {
      companyMDB.address = companyToSave.address;
    }
    // Add Last Changed/Created props
    DatabaseUtils.addLastChangedCreatedProps(companyMDB, companyToSave);
    // Modify
    const result = await global.database.getCollection<Company>(tenantID, 'companies').findOneAndUpdate(
      { _id: companyMDB._id },
      { $set: companyMDB },
      { upsert: true }
    );
    if (!result.ok) {
      throw new BackendError(
        Constants.CENTRAL_SERVER,
        'Couldn\'t update company',
        'CompanyStorage', 'saveCompany');
    }
    // Save Logo
    if (saveLogo) {
      await CompanyStorage._saveCompanyLogo(tenantID, companyMDB._id.toHexString(), companyToSave.logo);
    }
    // Debug
    Logging.traceEnd('CompanyStorage', 'saveCompany', uniqueTimerID, { companyToSave });
    return companyMDB._id.toHexString();
  }

  public static async getCompanies(tenantID: string,
    params: {search?: string; companyIDs?: string[]; withSites?: boolean; withLogo?: boolean} = {},
    dbParams?: DbParams, projectFields?: string[]): Promise<{count: number; result: Company[]}> {
    // Debug
    const uniqueTimerID = Logging.traceStart('CompanyStorage', 'getCompanies');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check Limit
    const limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    const skip = Utils.checkRecordSkip(dbParams.skip);
    // Set the filters
    let filters: ({_id?: ObjectID; $or?: any[]}|undefined);
    // Build filter
    if (params.search) {
      filters = {};
      // Valid ID?
      if (ObjectID.isValid(params.search)) {
        filters._id = Utils.convertToObjectID(params.search);
      } else {
        filters.$or = [
          { 'name': { $regex: params.search, $options: 'i' } },
          { 'address.city': { $regex: params.search, $options: 'i' } },
          { 'address.country': { $regex: params.search, $options: 'i' } }
        ];
      }
    }
    // Create Aggregation
    const aggregation = [];
    // Limit on Company for Basic Users
    if (params.companyIDs && params.companyIDs.length > 0) {
      // Build filter
      aggregation.push({
        $match: {
          _id: { $in: params.companyIDs.map((companyID) => {
            return Utils.convertToObjectID(companyID);
          }) }
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
    const companiesCountMDB = await global.database.getCollection<{count: number}>(tenantID, 'companies')
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      // Return only the count
      return {
        count: (companiesCountMDB.length > 0 ? companiesCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Site
    if (params.withSites) {
      DatabaseUtils.pushSiteLookupInAggregation(
        { tenantID, aggregation, localField: '_id', foreignField: 'companyID', asField: 'sites' });
    }
    // Company Logo
    if (params.withLogo) {
      DatabaseUtils.pushCollectionLookupInAggregation('companylogos',
        { tenantID, aggregation, localField: '_id', foreignField: '_id',
          asField: 'companylogos', oneToOneCardinality: true }
      );
      // Rename
      DatabaseUtils.renameField(aggregation, 'companylogos.logo', 'logo');
    }
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);
    // Handle the ID
    DatabaseUtils.renameDatabaseID(aggregation);
    // Sort
    if (dbParams.sort) {
      aggregation.push({
        $sort: dbParams.sort
      });
    } else {
      aggregation.push({
        $sort: { name: 1 }
      });
    }
    // Skip
    if (skip > 0) {
      aggregation.push({ $skip: skip });
    }
    // Limit
    aggregation.push({
      $limit: (limit > 0 && limit < Constants.DB_RECORD_COUNT_CEIL) ? limit : Constants.DB_RECORD_COUNT_CEIL
    });
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const companies = await global.database.getCollection<any>(tenantID, 'companies')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 }, allowDiskUse: true })
      .toArray();
    // Debug
    Logging.traceEnd('CompanyStorage', 'getCompanies', uniqueTimerID,
      { params, limit: dbParams.limit, skip: dbParams.skip, sort: dbParams.sort });
    // Ok
    return {
      count: (companiesCountMDB.length > 0 ?
        (companiesCountMDB[0].count === Constants.DB_RECORD_COUNT_CEIL ? -1 : companiesCountMDB[0].count) : 0),
      result: companies
    };
  }

  public static async deleteCompany(tenantID: string, id: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('CompanyStorage', 'deleteCompany');
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
    Logging.traceEnd('CompanyStorage', 'deleteCompany', uniqueTimerID, { id });
  }

  private static async _saveCompanyLogo(tenantID: string, companyID: string, companyLogoToSave: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('CompanyStorage', 'saveCompanyLogo');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Modify
    await global.database.getCollection<any>(tenantID, 'companylogos').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(companyID) },
      { $set: { logo: companyLogoToSave } },
      { upsert: true });
    // Debug
    Logging.traceEnd('CompanyStorage', 'saveCompanyLogo', uniqueTimerID, {});
  }
}
