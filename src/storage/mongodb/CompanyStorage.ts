import { ObjectID } from 'mongodb';
import BackendError from '../../exception/BackendError';
import Company from '../../types/Company';
import Constants from '../../utils/Constants';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import TSGlobal from '../../types/GlobalType';
import Logging from '../../utils/Logging';
import SiteStorage from './SiteStorage';
import User from '../../entity/User';
import Utils from '../../utils/Utils';

declare const global: TSGlobal;

export default class CompanyStorage {

  public static async getCompany(tenantID: string, id: string): Promise<Company> {
    // Debug
    const uniqueTimerID = Logging.traceStart('CompanyStorage', 'getCompany');

    // Reuse
    const companiesMDB = await CompanyStorage.getCompanies(tenantID, { search: id, withSites: false }, { limit: 1, skip: 0 });

    let company: Company = null;
    // Check
    if (companiesMDB && companiesMDB.count > 0) {
      company = companiesMDB.result[0];
    }
    // Debug
    Logging.traceEnd('CompanyStorage', 'getCompany', uniqueTimerID, { id });
    return company;
  }

  public static async saveCompany(tenantID: string, companyToSave: Company, saveLogo = true): Promise<string> {
    // Debug
    const uniqueTimerID = Logging.traceStart('CompanyStorage', 'saveCompany');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Set
    const companyMDB: any = {
      _id: !companyToSave.id ? new ObjectID() : Utils.convertToObjectID(companyToSave.id),
      name: companyToSave.name,
      address: companyToSave.address,
    };
    if (companyToSave.address) {
      companyMDB.address = companyToSave.address;
    }
    if (companyToSave.createdBy && companyToSave.createdOn) {
      companyMDB.createdBy = Utils.convertToObjectID(
        companyToSave.createdBy.id ? companyToSave.createdBy.id : companyToSave.createdBy.getID()),
      companyMDB.createdOn = companyToSave.createdOn;
    }
    if (companyToSave.lastChangedBy && companyToSave.lastChangedOn) {
      companyMDB.lastChangedBy = Utils.convertToObjectID(
        companyToSave.lastChangedBy.id ? companyToSave.lastChangedBy.id : companyToSave.lastChangedBy.getID());
      companyMDB.lastChangedOn = companyToSave.lastChangedOn;
    }

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
      CompanyStorage._saveCompanyLogo(tenantID, companyMDB._id.toHexString(), companyToSave.logo);
    }

    // Debug
    Logging.traceEnd('CompanyStorage', 'saveCompany', uniqueTimerID, { companyToSave });

    return companyMDB._id.toHexString();
  }

  // Delegate
  public static async getCompanies(tenantID: string,
    params: {search?: string; companyIDs?: string[]; onlyRecordCount?: boolean; withSites?: boolean} = {},
    dbParams?: DbParams): Promise<{count: number; result: Company[]}> {
    // Debug
    const uniqueTimerID = Logging.traceStart('CompanyStorage', 'getCompanies');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check Limit
    const limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    const skip = Utils.checkRecordSkip(dbParams.skip);
    // Set the filters
    let filters: ({_id?: string; $or?: any[]}|undefined);
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
    if (!params.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.MAX_DB_RECORD_COUNT });
    }

    // Count Records
    const companiesCountMDB = await global.database.getCollection<{count: number}>(tenantID, 'companies')
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
    // Check if only the total count is requested
    if (params.onlyRecordCount) {
      // Return only the count
      return {
        count: (companiesCountMDB.length > 0 ? companiesCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();

    // Site lookup
    if (params.withSites) {
      // Add Sites
      aggregation.push({
        $lookup: {
          from: DatabaseUtils.getCollectionName(tenantID, 'sites'),
          localField: '_id',
          foreignField: 'companyID',
          as: 'sites'
        }
      });
    }

    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);

    // Add company logo
    aggregation.push({ $lookup: {
      from: tenantID + '.companylogos',
      localField: '_id',
      foreignField: '_id',
      as: 'logo' }
    },
    { $unwind: {
      'path': '$logo',
      'preserveNullAndEmptyArrays': true }
    },
    { $project: {
      logo: '$logo.logo',
      id: { $toString: '$_id' },
      _id: 0,
      createdBy: 1,
      createdOn: 1,
      lastChangedBy: 1,
      lastChangedOn: 1,
      name: 1,
      address: 1 }
    }
    );

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
      $limit: (limit > 0 && limit < Constants.MAX_DB_RECORD_COUNT) ? limit : Constants.MAX_DB_RECORD_COUNT
    });

    // Read DB
    const companies = await global.database.getCollection<Company>(tenantID, 'companies')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 }, allowDiskUse: true })
      .toArray();

    // Debug
    Logging.traceEnd('CompanyStorage', 'getCompanies', uniqueTimerID,
      { params, limit: dbParams.limit, skip: dbParams.skip, sort: dbParams.sort });

    // Ok
    return {
      count: (companiesCountMDB.length > 0 ?
        (companiesCountMDB[0].count === Constants.MAX_DB_RECORD_COUNT ? -1 : companiesCountMDB[0].count) : 0),
      result: companies
    };
  }

  public static async deleteCompany(tenantID: string, id: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('CompanyStorage', 'deleteCompany');

    // Check Tenant
    await Utils.checkTenant(tenantID);

    // Delete sites associated with Company
    SiteStorage.deleteCompanySites(tenantID, id);

    // Delete the Company
    await global.database.getCollection<Company>(tenantID, 'companies')
      .findOneAndDelete({ '_id': Utils.convertToObjectID(id) });

    // Delete Logo
    await global.database.getCollection<any>(tenantID, 'companylogos')
      .findOneAndDelete({ '_id': Utils.convertToObjectID(id) });

    // Debug
    Logging.traceEnd('CompanyStorage', 'deleteCompany', uniqueTimerID, { id });
  }

  private static async _saveCompanyLogo(tenantID: string, companyId: string, companyLogoToSave: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('CompanyStorage', 'saveCompanyLogo');

    // Check Tenant
    await Utils.checkTenant(tenantID);

    // Modify
    await global.database.getCollection<any>(tenantID, 'companylogos').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(companyId) },
      { $set: { logo: companyLogoToSave } },
      { upsert: true });

    // Debug
    Logging.traceEnd('CompanyStorage', 'saveCompanyLogo', uniqueTimerID, {});
  }
}
