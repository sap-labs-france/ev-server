
const ObjectID = require('mongodb').ObjectID;
const Constants = require('../../utils/Constants');
const Database = require('../../utils/Database');
const Utils = require('../../utils/Utils');
const SiteStorage = require('./SiteStorage');
const BackendError = require('../../exception/BackendError');
const DatabaseUtils = require('./DatabaseUtils');
const Logging = require('../../utils/Logging');

class CompanyStorage {
  static async getCompany(tenantID, id) {
    // Debug
    const uniqueTimerID = Logging.traceStart('CompanyStorage', 'getCompany');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const Company = require('../../entity/Company'); // Avoid fucking circular deps!!!
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: { _id: Utils.convertToObjectID(id) }
    });
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);
    // Read DB
    const companiesMDB = await global.database.getCollection(tenantID, 'companies')
      .aggregate(aggregation)
      .limit(1)
      .toArray();
    let company = null;
    // Check
    if (companiesMDB && companiesMDB.length > 0) {
      // Create
      company = new Company(tenantID, companiesMDB[0]);
    }
    // Debug
    Logging.traceEnd('CompanyStorage', 'getCompany', uniqueTimerID, { id });
    return company;
  }

  static async getCompanyLogo(tenantID, id) {
    // Debug
    const uniqueTimerID = Logging.traceStart('CompanyStorage', 'getCompanyLogo');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const companyLogosMDB = await global.database.getCollection(tenantID, 'companylogos')
      .find({ _id: Utils.convertToObjectID(id) })
      .limit(1)
      .toArray();
    let companyLogo = null;
    // Set
    if (companyLogosMDB && companyLogosMDB.length > 0) {
      companyLogo = {
        id: companyLogosMDB[0]._id,
        logo: companyLogosMDB[0].logo
      };
    }
    // Debug
    Logging.traceEnd('CompanyStorage', 'getCompanyLogo', uniqueTimerID);
    return companyLogo;
  }

  static async getCompanyLogos(tenantID) {
    // Debug
    const uniqueTimerID = Logging.traceStart('CompanyStorage', 'getCompanyLogos');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const companyLogosMDB = await global.database.getCollection(tenantID, 'companylogos', {})
      .find({})
      .toArray();
    // Set
    const companyLogos = [];
    if (companyLogosMDB && companyLogosMDB.length > 0) {
      // Add
      for (const companyLogoMDB of companyLogosMDB) {
        companyLogos.push({
          id: companyLogoMDB._id,
          logo: companyLogoMDB.logo
        });
      }
    }
    // Debug
    Logging.traceEnd('CompanyStorage', 'getCompanyLogos', uniqueTimerID, {});
    return companyLogos;
  }

  static async saveCompany(tenantID, companyToSave) {
    // Debug
    const uniqueTimerID = Logging.traceStart('CompanyStorage', 'saveCompany');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const Company = require('../../entity/Company'); // Avoid fucking circular deps!!!
    // Check if ID/Name is provided
    if (!companyToSave.id && !companyToSave.name) {
      // ID must be provided!
      throw new BackendError(
        Constants.CENTRAL_SERVER,
        `Company has no ID and no Name`,
        "CompanyStorage", "saveCompany");
    }
    const companyFilter = {};
    // Build Request
    if (companyToSave.id) {
      companyFilter._id = Utils.convertToObjectID(companyToSave.id);
    } else {
      companyFilter._id = new ObjectID();
    }
    // Check Created By/On
    companyToSave.createdBy = Utils.convertUserToObjectID(companyToSave.createdBy);
    companyToSave.lastChangedBy = Utils.convertUserToObjectID(companyToSave.lastChangedBy);
    // Transfer
    const company = {};
    Database.updateCompany(companyToSave, company, false);
    // Modify
    const result = await global.database.getCollection(tenantID, 'companies').findOneAndUpdate(
      companyFilter,
      { $set: company },
      { upsert: true, new: true, returnOriginal: false });
    // Debug
    Logging.traceEnd('CompanyStorage', 'saveCompany', uniqueTimerID, { companyToSave });
    return new Company(tenantID, result.value);
  }

  static async saveCompanyLogo(tenantID, companyLogoToSave) {
    // Debug
    const uniqueTimerID = Logging.traceStart('CompanyStorage', 'saveCompanyLogo');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check if ID is provided
    if (!companyLogoToSave.id) {
      // ID must be provided!
      throw new BackendError(
        Constants.CENTRAL_SERVER,
        `Company Logo has no ID`,
        "CompanyStorage", "saveCompanyLogo");
    }
    // Modify
    await global.database.getCollection(tenantID, 'companylogos').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(companyLogoToSave.id) },
      { $set: { logo: companyLogoToSave.logo } },
      { upsert: true, new: true, returnOriginal: false });
    // Debug
    Logging.traceEnd('CompanyStorage', 'saveCompanyLogo', uniqueTimerID, {});
  }

  // Delegate
  static async getCompanies(tenantID, params = {}, limit, skip, sort) {
    // Debug
    const uniqueTimerID = Logging.traceStart('CompanyStorage', 'getCompanies');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const Company = require('../../entity/Company'); // Avoid fucking circular deps!!!
    const Site = require('../../entity/Site');  // Avoid fucking circular deps!!!
    // Check Limit
    limit = Utils.checkRecordLimit(limit);
    // Check Skip
    skip = Utils.checkRecordSkip(skip);
    // Set the filters
    const filters = {};
    // Source?
    if (params.search) {
      // Build filter
      filters.$or = [
        { "name": { $regex: params.search, $options: 'i' } },
        { "address.city": { $regex: params.search, $options: 'i' } },
        { "address.country": { $regex: params.search, $options: 'i' } }
      ];
    }
    // Create Aggregation
    const aggregation = [];
    // Filters
    if (filters) {
      aggregation.push({
        $match: filters
      });
    }
    if (params.withSites) {
      // Add Sites
      aggregation.push({
        $lookup: {
          from: DatabaseUtils.getCollectionName(tenantID, "sites"),
          localField: "_id",
          foreignField: "companyID",
          as: "sites"
        }
      });
    }
    if (params.withLogo) {
      // Add Logo
      aggregation.push({
        $lookup: {
          from: DatabaseUtils.getCollectionName(tenantID, "companylogos"),
          localField: "_id",
          foreignField: "_id",
          as: "companylogos"
        }
      });
    }
    // Limit records?
    if (!params.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.MAX_DB_RECORD_COUNT });
    }
    // Count Records
    const companiesCountMDB = await global.database.getCollection(tenantID, 'companies')
      .aggregate([...aggregation, { $count: "count" }])
      .toArray();
    // Check if only the total count is requested
    if (params.onlyRecordCount) {
      // Return only the count
      return {
        count: (companiesCountMDB.length > 0 ? companiesCountMDB[0].count : 0),
        result: []
      };
    }
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);
    // Sort
    if (sort) {
      // Sort
      aggregation.push({
        $sort: sort
      });
    } else {
      // Default
      aggregation.push({
        $sort: { name: 1 }
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
    const companiesMDB = await global.database.getCollection(tenantID, 'companies')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 } })
      .toArray();
    const companies = [];
    // Check
    if (companiesMDB && companiesMDB.length > 0) {
      for (const companyMDB of companiesMDB) {
        // Create
        const company = new Company(tenantID, companyMDB);
        // Set site
        if (params.withSites && companyMDB.sites) {
          company.setSites(companyMDB.sites.map((site) => {
            return new Site(tenantID, site);
          }));
        }
        // Set logo
        if (true && companyMDB.companylogos && companyMDB.companylogos[0]) {
          company.setLogo(companyMDB.companylogos[0].logo);
        }
        // Add
        companies.push(company);
      }
    }
    // Debug
    Logging.traceEnd('CompanyStorage', 'getCompanies', uniqueTimerID, { params, limit, skip, sort });
    // Ok
    return {
      count: (companiesCountMDB.length > 0 ? companiesCountMDB[0].count : 0),
      result: companies
    };
  }

  static async deleteCompany(tenantID, id) {
    // Debug
    const uniqueTimerID = Logging.traceStart('CompanyStorage', 'deleteCompany');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Delete Sites
    const sites = await SiteStorage.getSites(tenantID, { 'companyID': id });
    // Delete
    for (const site of sites.result) {
      //	Delete Site
      await site.delete();
    }
    // Delete the Company
    await global.database.getCollection(tenantID, 'companies')
      .findOneAndDelete({ '_id': Utils.convertToObjectID(id) });
    // Delete Logo
    await global.database.getCollection(tenantID, 'companylogos')
      .findOneAndDelete({ '_id': Utils.convertToObjectID(id) });
    // Debug
    Logging.traceEnd('CompanyStorage', 'deleteCompany', uniqueTimerID, { id });
  }
}

module.exports = CompanyStorage;
