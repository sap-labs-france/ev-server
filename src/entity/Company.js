const AbstractTenantEntity = require('./AbstractTenantEntity');
const Database = require('../utils/Database');
const AppError = require('../exception/AppError');
const Constants = require('../utils/Constants');
const CompanyStorage = require('../storage/mongodb/CompanyStorage');
const SiteStorage = require('../storage/mongodb/SiteStorage');
const User = require('./User');

class Company extends AbstractTenantEntity {
  constructor(tenantID, company) {
    super(tenantID);

    // Set it
    Database.updateCompany(company, this._model);
  }

  getID() {
    return this._model.id;
  }

  setName(name) {
    this._model.name = name;
  }

  getName() {
    return this._model.name;
  }

  setAddress(address) {
    this._model.address = address;
  }

  getAddress() {
    return this._model.address;
  }

  getLogo() {
    return this._model.logo;
  }

  setLogo(logo) {
    this._model.logo = logo;
  }

  getCreatedBy() {
    if (this._model.createdBy) {
      return new User(this.getTenantID(), this._model.createdBy);
    }
    return null;
  }

  setCreatedBy(user) {
    this._model.createdBy = user.getModel();
  }

  getCreatedOn() {
    return this._model.createdOn;
  }

  setCreatedOn(createdOn) {
    this._model.createdOn = createdOn;
  }

  getLastChangedBy() {
    if (this._model.lastChangedBy) {
      return new User(this.getTenantID(), this._model.lastChangedBy);
    }
    return null;
  }

  setLastChangedBy(user) {
    this._model.lastChangedBy = user.getModel();
  }

  getLastChangedOn() {
    return this._model.lastChangedOn;
  }

  setLastChangedOn(lastChangedOn) {
    this._model.lastChangedOn = lastChangedOn;
  }

  async getSites() {
    // Get from DB
    const sites = await SiteStorage.getSites(this.getTenantID(), {'companyID': this.getID()});
    // Keep it
    this.setSites(sites.result);
    // Return
    return sites.result;
  }

  setSites(sites) {
    this._model.sites = sites.map((site) => site.getModel());
  }

  save() {
    return CompanyStorage.saveCompany(this.getTenantID(), this.getModel());
  }

  saveLogo() {
    return CompanyStorage.saveCompanyLogo(this.getTenantID(), this.getModel());
  }

  delete() {
    return CompanyStorage.deleteCompany(this.getTenantID(), this.getID());
  }

  static checkIfCompanyValid(filteredRequest, req) {
    // Update model?
    if(req.method !== 'POST' && !filteredRequest.id) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The Company ID is mandatory`, 500,
        'Company', 'checkIfCompanyValid');
    }
    if(!filteredRequest.name) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The Company Name is mandatory`, 500,
        'Company', 'checkIfCompanyValid');
    }
  }

  static getCompany(tenantID, id) {
    return CompanyStorage.getCompany(tenantID, id);
  }

  static getCompanies(tenantID, params, limit, skip, sort) {
    return CompanyStorage.getCompanies(tenantID, params, limit, skip, sort);
  }

  static getCompanyLogo(tenantID, id) {
    return CompanyStorage.getCompanyLogo(tenantID, id);
  }

  static getCompanyLogos(tenantID) {
    return CompanyStorage.getCompanyLogos(tenantID);
  }
}

module.exports = Company;
