import AppError from '../exception/AppError';
import Company from '../types/Company';
import Constants from '../utils/Constants';
import Database from '../utils/Database';
import CompanyStorage from '../storage/mongodb/CompanyStorage';
import SiteStorage from '../storage/mongodb/SiteStorage';
import SiteAreaStorage from '../storage/mongodb/SiteAreaStorage';
import TenantHolder from './TenantHolder';
import UserStorage from '../storage/mongodb/UserStorage';
import User from './User';
export default class Site extends TenantHolder {
  private _model: any = {};

  constructor(tenantID, site) {
    super(tenantID);
    Database.updateSite(site, this._model);
  }

  public getModel(): any {
    return this._model;
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

  setAvailableChargers(availableChargers) {
    this._model.availableChargers = availableChargers;
  }

  getAvailableChargers() {
    return this._model.availableChargers;
  }

  setTotalChargers(totalChargers) {
    this._model.totalChargers = totalChargers;
  }

  getTotalChargers() {
    return this._model.totalChargers;
  }

  setAvailableConnectors(availableConnectors) {
    this._model.availableConnectors = availableConnectors;
  }

  getAvailableConnectors() {
    return this._model.availableConnectors;
  }

  setTotalConnectors(totalConnectors) {
    this._model.totalConnectors = totalConnectors;
  }

  getTotalConnectors() {
    return this._model.totalConnectors;
  }

  setAddress(address) {
    this._model.address = address;
  }

  getAddress() {
    return this._model.address;
  }

  setAllowAllUsersToStopTransactionsEnabled(allowAllUsersToStopTransactions) {
    this._model.allowAllUsersToStopTransactions = allowAllUsersToStopTransactions;
  }

  isAllowAllUsersToStopTransactionsEnabled() {
    return this._model.allowAllUsersToStopTransactions;
  }

  setAutoUserSiteAssignment(active) {
    this._model.autoUserSiteAssignment = active;
  }

  isAutoUserSiteAssignmentEnabled() {
    return this._model.autoUserSiteAssignment;
  }

  setImage(image) {
    this._model.image = image;
  }

  getImage() {
    return this._model.image;
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

  async getCompany(): Promise<Company> {
    const company = await CompanyStorage.getCompany(this.getTenantID(), this._model.companyID);
    this.setCompany(company);
    return company;
  }

  getCompanyID() {
    return this._model.companyID;
  }

  setCompany(company: Company) {
    if (company) {
      this._model.company = company;
      this._model.companyID = company.id;
    } else {
      this._model.company = null;
    }
  }

  async getSiteAreas() {
    const siteAreas = await SiteAreaStorage.getSiteAreas(this.getTenantID(),
      { siteID: this.getID(), onlyRecordCount: false, withChargeBoxes: true, withAvailableChargers: true, withSite: false, withImage: false},
      { limit: Constants.MAX_DB_RECORD_COUNT, skip: 0 });
    this.setSiteAreas(siteAreas.result);
    return siteAreas.result;
  }

  setSiteAreas(siteAreas) {
    this._model.siteAreas = siteAreas;
  }

  async getUsers() {
    if (this._model.users) {
      return this._model.users.map((user) => { return new User(this.getTenantID(), user); });
    }
    const users = await UserStorage.getUsers(this.getTenantID(), { 'siteID': this.getID() });
    this.setUsers(users.result);
    return users.result;

  }

  async getUser(userID) {
    const users = await UserStorage.getUsers(this.getTenantID(), { 'siteID': this.getID(), 'userID': userID });
    if (users.count > 0) {
      return users.result[0];
    }
    return null;
  }

  removeUser(user) {
    if (this._model.users) {
      for (let i = 0; i < this._model.users.length; i++) {
        if (this._model.users[i].id === user.getID()) {
          this._model.users.splice(i, 1);
          break;
        }
      }
    }
  }

  setUsers(users) {
    this._model.users = users.map((user) => { return user.getModel(); });
  }

  save() {
    return SiteStorage.saveSite(this.getTenantID(), this.getModel());
  }

  saveImage() {
    return SiteStorage.saveSiteImage(this.getTenantID(), this.getModel());
  }

  delete() {
    return SiteStorage.deleteSite(this.getTenantID(), this.getID());
  }

  static checkIfSiteValid(filteredRequest, req) {
    // Update model?
    if (req.method !== 'POST' && !filteredRequest.id) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Site ID is mandatory`, Constants.HTTP_GENERAL_ERROR,
        'Site', 'checkIfSiteValid',
        req.user.id);
    }
    if (!filteredRequest.name) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Site Name is mandatory`, Constants.HTTP_GENERAL_ERROR,
        'Site', 'checkIfSiteValid',
        req.user.id, filteredRequest.id);
    }
    if (!filteredRequest.companyID) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Company ID is mandatory for the Site`, Constants.HTTP_GENERAL_ERROR,
        'Sites', 'checkIfSiteValid',
        req.user.id, filteredRequest.id);
    }
  }

  static getSite(tenantID, id) {
    return SiteStorage.getSite(tenantID, id);
  }

  static getSites(tenantID, params, limit?, skip?, sort?) {
    return SiteStorage.getSites(tenantID, params, limit, skip, sort);
  }

  static getSiteImage(tenantID, id) {
    return SiteStorage.getSiteImage(tenantID, id);
  }

  static addUsersToSite(tenantID, id, userIDs) {
    return SiteStorage.addUsersToSite(tenantID, id, userIDs);
  }

  static getUsersFromSite(tenantID, id, limit?, skip?, sort?) {
    return SiteStorage.getUsersBySite(tenantID, id, limit, skip, sort);
  }

  static updateSiteUserRole(tenantID, id, userID, role: string) {
    return SiteStorage.updateSiteUserRole(tenantID, id, userID, role);
  }

  static removeUsersFromSite(tenantID, id, userIDs) {
    return SiteStorage.removeUsersFromSite(tenantID, id, userIDs);
  }
}
