import TenantHolder from './TenantHolder';
import Database from '../utils/Database';
import AppError from '../exception/AppError';
import Constants from '../utils/Constants';
import CompanyStorage from '../storage/mongodb/CompanyStorage';
import SiteStorage from '../storage/mongodb/SiteStorage';
import SiteAreaStorage from '../storage/mongodb/SiteAreaStorage';
import UserStorage from '../storage/mongodb/UserStorage';
import User from './User';

export default class Site extends TenantHolder {

  private model: any = {};

  constructor(tenantID, site) {
    super(tenantID);

    // Set it
    Database.updateSite(site, this.model);
  }

  public getModel(): any {
    return this.model;
  }

  getID() {
    return this.model.id;
  }

  setName(name) {
    this.model.name = name;
  }

  getName() {
    return this.model.name;
  }

  setAvailableChargers(availableChargers) {
    this.model.availableChargers = availableChargers;
  }

  getAvailableChargers() {
    return this.model.availableChargers;
  }

  setTotalChargers(totalChargers) {
    this.model.totalChargers = totalChargers;
  }

  getTotalChargers() {
    return this.model.totalChargers;
  }

  setAvailableConnectors(availableConnectors) {
    this.model.availableConnectors = availableConnectors;
  }

  getAvailableConnectors() {
    return this.model.availableConnectors;
  }

  setTotalConnectors(totalConnectors) {
    this.model.totalConnectors = totalConnectors;
  }

  getTotalConnectors() {
    return this.model.totalConnectors;
  }

  setAddress(address) {
    this.model.address = address;
  }

  getAddress() {
    return this.model.address;
  }

  setAllowAllUsersToStopTransactionsEnabled(allowAllUsersToStopTransactions) {
    this.model.allowAllUsersToStopTransactions = allowAllUsersToStopTransactions;
  }

  isAllowAllUsersToStopTransactionsEnabled() {
    return this.model.allowAllUsersToStopTransactions;
  }

  setAutoUserSiteAssignment(active) {
    this.model.autoUserSiteAssignment = active;
  }

  isAutoUserSiteAssignmentEnabled() {
    return this.model.autoUserSiteAssignment;
  }

  setImage(image) {
    this.model.image = image;
  }

  getImage() {
    return this.model.image;
  }

  getCreatedBy() {
    if (this.model.createdBy) {
      return new User(this.getTenantID(), this.model.createdBy);
    }
    return null;
  }

  setCreatedBy(user) {
    this.model.createdBy = user.getModel();
  }

  getCreatedOn() {
    return this.model.createdOn;
  }

  setCreatedOn(createdOn) {
    this.model.createdOn = createdOn;
  }

  getLastChangedBy() {
    if (this.model.lastChangedBy) {
      return new User(this.getTenantID(), this.model.lastChangedBy);
    }
    return null;
  }

  setLastChangedBy(user) {
    this.model.lastChangedBy = user.getModel();
  }

  getLastChangedOn() {
    return this.model.lastChangedOn;
  }

  setLastChangedOn(lastChangedOn) {
    this.model.lastChangedOn = lastChangedOn;
  }

  async getCompany() {
    // Get from DB
    const company = await CompanyStorage.getCompany(this.getTenantID(), this.model.companyID);
    // Keep it
    this.setCompany(company);
    return company;
  }

  getCompanyID() {
    return this.model.companyID;
  }

  setCompany(company) {
    if (company) {
      this.model.company = company.getModel();
      this.model.companyID = company.getID();
    } else {
      this.model.company = null;
    }
  }

  async getSiteAreas() {
    // Get from DB
    const siteAreas = await SiteAreaStorage.getSiteAreas(this.getTenantID(), { 'siteID': this.getID() });
    // Keep it
    this.setSiteAreas(siteAreas.result);
    return siteAreas.result;
  }

  setSiteAreas(siteAreas) {
    this.model.siteAreas = siteAreas.map((siteArea) => siteArea.getModel());
  }

  async getUsers() {
    if (this.model.users) {
      return this.model.users.map((user) => new User(this.getTenantID(), user));
    } else {
      // Get from DB
      const users = await UserStorage.getUsers(this.getTenantID(), { 'siteID': this.getID() });
      // Keep it
      this.setUsers(users.result);
      return users.result;
    }
  }

  async getUser(userID) {
    // Get from DB
    const users = await UserStorage.getUsers(this.getTenantID(), { 'siteID': this.getID(), 'userID': userID });
    // Check
    if (users.count > 0) {
      return users.result[0];
    }
    // None
    return null;
  }

  removeUser(user) {
    if (this.model.users) {
      // Search
      for (let i = 0; i < this.model.users.length; i++) {
        if (this.model.users[i].id === user.getID()) {
          // Remove
          this.model.users.splice(i, 1);
          break;
        }
      }
    }
  }

  setUsers(users) {
    this.model.users = users.map((user) => user.getModel());
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
        `Site ID is mandatory`, 500,
        'Site', 'checkIfSiteValid',
        req.user.id);
    }
    if (!filteredRequest.name) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Site Name is mandatory`, 500,
        'Site', 'checkIfSiteValid',
        req.user.id, filteredRequest.id);
    }
    if (!filteredRequest.companyID) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Company ID is mandatory for the Site`, 500,
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

  static removeUsersFromSite(tenantID, id, userIDs) {
    return SiteStorage.removeUsersFromSite(tenantID, id, userIDs);
  }
}
