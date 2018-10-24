const Constants = require('../../utils/Constants');
const Database = require('../../utils/Database');
const Utils = require('../../utils/Utils');
const SiteStorage = require('./SiteStorage');
const ObjectID = require('mongodb').ObjectID;
const AppError = require('../../exception/AppError');
const MongoDBStorage = require('./MongoDBStorage');

class CompanyStorage {
  static async getCompany(tenantID, id){
    const Company = require('../../entity/Company'); // Avoid fucking circular deps!!!
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: {_id: Utils.convertToObjectID(id)}
    });
    // Add Created By / Last Changed By
    Utils.pushCreatedLastChangedInAggregation(aggregation);
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
    return company;
  }

  static async getCompanyLogo(tenantID, id){
    // Read DB
    const companyLogosMDB = await global.database.getCollection(tenantID, 'companylogos')
      .find({_id: Utils.convertToObjectID(id)})
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
    return companyLogo;
  }

  static async getCompanyLogos(tenantID){
    // Read DB
    const companyLogosMDB = await global.database.getCollection(tenantID, 'companylogos')
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
    return companyLogos;
  }

  static async saveCompany(tenantID, companyToSave){
    const Company = require('../../entity/Company'); // Avoid fucking circular deps!!!
    // Check if ID/Name is provided
    if (!companyToSave.id && !companyToSave.name) {
      // ID must be provided!
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Company has no ID and no Name`,
        550, "CompanyStorage", "saveCompany");
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
      {$set: company},
      {upsert: true, new: true, returnOriginal: false});
    // Create
    return new Company(tenantID, result.value);
  }

  static async saveCompanyLogo(tenantID, companyLogoToSave){
    // Check if ID is provided
    if (!companyLogoToSave.id) {
      // ID must be provided!
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Company Logo has no ID`,
        550, "CompanyStorage", "saveCompanyLogo");
    }
    // Modify
    await global.database.getCollection(tenantID, 'companylogos').findOneAndUpdate(
      {'_id': Utils.convertToObjectID(companyLogoToSave.id)},
      {$set: {logo: companyLogoToSave.logo}},
      {upsert: true, new: true, returnOriginal: false});
  }

  // Delegate
  static async getCompanies(tenantID, params = {}, limit, skip, sort){
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
        {"name": {$regex: params.search, $options: 'i'}},
        {"address.city": {$regex: params.search, $options: 'i'}},
        {"address.country": {$regex: params.search, $options: 'i'}}
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
          from: MongoDBStorage.getCollectionName(tenantID, "sites"),
          localField: "_id",
          foreignField: "companyID",
          as: "sites"
        }
      });
    }
    // Count Records
    const companiesCountMDB = await global.database.getCollection(tenantID, 'companies')
      .aggregate([...aggregation, {$count: "count"}])
      .toArray();
    // Add Created By / Last Changed By
    Utils.pushCreatedLastChangedInAggregation(aggregation);
    // Sort
    if (sort) {
      // Sort
      aggregation.push({
        $sort: sort
      });
    } else {
      // Default
      aggregation.push({
        $sort: {name: 1}
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
      .aggregate(aggregation, {collation: {locale: Constants.DEFAULT_LOCALE, strength: 2}})
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
        // Add
        companies.push(company);
      }
    }
    // Ok
    return {
      count: (companiesCountMDB.length > 0 ? companiesCountMDB[0].count : 0),
      result: companies
    };
  }

  static async deleteCompany(tenantID, id){
    // Delete Sites
    const sites = await SiteStorage.getSites({'companyID': id});
    // Delete
    for (const site of sites.result) {
      //	Delete Site
      await site.delete();
    }
    // Delete the Company
    await global.database.getCollection(tenantID, 'companies')
      .findOneAndDelete({'_id': Utils.convertToObjectID(id)});
    // Delete Logo
    await global.database.getCollection(tenantID, 'companylogos')
      .findOneAndDelete({'_id': Utils.convertToObjectID(id)});
  }
}

module.exports = CompanyStorage;
