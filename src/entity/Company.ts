import TenantHolder from './TenantHolder';
import Database from '../utils/Database';
import AppError from '../exception/AppError';
import Constants from '../utils/Constants';
import CompanyStorage from '../storage/mongodb/CompanyStorage';
import SiteStorage from '../storage/mongodb/SiteStorage';
import User from './User';

export default class Company extends TenantHolder {

	public getTenantID: any;
  public getModel: any;
  private model: any;

  constructor(tenantID: any, company: any) {
    super(tenantID);

    // Set it
    Database.updateCompany(company, this.model);
  }

  getID() {
    return this.model.id;
  }

  setName(name: any) {
    this.model.name = name;
  }

  getName() {
    return this.model.name;
  }

  setAddress(address: any) {
    this.model.address = address;
  }

  getAddress() {
    return this.model.address;
  }

  getLogo() {
    return this.model.logo;
  }

  setLogo(logo: any) {
    this.model.logo = logo;
  }

  getCreatedBy() {
    if (this.model.createdBy) {
      return new User(this.getTenantID(), this.model.createdBy);
    }
    return null;
  }

  setCreatedBy(user: any) {
    this.model.createdBy = user.getModel();
  }

  getCreatedOn() {
    return this.model.createdOn;
  }

  setCreatedOn(createdOn: any) {
    this.model.createdOn = createdOn;
  }

  getLastChangedBy() {
    if (this.model.lastChangedBy) {
      return new User(this.getTenantID(), this.model.lastChangedBy);
    }
    return null;
  }

  setLastChangedBy(user: any) {
    this.model.lastChangedBy = user.getModel();
  }

  getLastChangedOn() {
    return this.model.lastChangedOn;
  }

  setLastChangedOn(lastChangedOn: any) {
    this.model.lastChangedOn = lastChangedOn;
  }

  async getSites() {
    // Get from DB
    const sites = await SiteStorage.getSites(this.getTenantID(), {'companyID': this.getID()});
    // Keep it
    this.setSites(sites.result);
    // Return
    return sites.result;
  }

  setSites(sites: any) {
    this.model.sites = sites.map((site) => site.getModel());
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

  static checkIfCompanyValid(filteredRequest: any, req: any) {
    // Update model?
    if(req.method !== 'POST' && !filteredRequest.id) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Company ID is mandatory`, 500,
        'Company', 'checkIfCompanyValid',
        req.user.id);
    }
    if(!filteredRequest.name) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Company Name is mandatory`, 500,
        'Company', 'checkIfCompanyValid',
        req.user.id, filteredRequest.id);
    }
  }

  static getCompany(tenantID: any, id: any) {
    return CompanyStorage.getCompany(tenantID, id);
  }

  static getCompanies(tenantID: any, params?: any, limit?: any, skip?: any, sort?: any) {
    return CompanyStorage.getCompanies(tenantID, params, limit, skip, sort);
  }

  static getCompanyLogo(tenantID: any, id: any) {
    return CompanyStorage.getCompanyLogo(tenantID, id);
  }

  static getCompanyLogos(tenantID: any) {
    return CompanyStorage.getCompanyLogos(tenantID);
  }
}
