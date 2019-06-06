import TenantHolder from './TenantHolder';
import Database from '../utils/Database';
import Constants from '../utils/Constants';
import AppError from '../exception/AppError';
import SiteStorage from '../storage/mongodb/SiteStorage';
import SiteAreaStorage from '../storage/mongodb/SiteAreaStorage';
import ChargingStationStorage from '../storage/mongodb/ChargingStationStorage';
import User from './User';

export default class SiteArea extends TenantHolder {

	public getTenantID: any;
	public getModel: any;
  private model: any;


  constructor(tenantID, siteArea) {
    super(tenantID);

    // Set it
    Database.updateSiteArea(siteArea, this.model);
  }

  static checkIfSiteAreaValid(filteredRequest, req) {
    // Update model?
    if (req.method !== 'POST' && !filteredRequest.id) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Site Area ID is mandatory`, 500,
        'SiteArea', 'checkIfSiteAreaValid',
        req.user.id, filteredRequest.id);
    }
    if (!filteredRequest.name) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Site Area Name is mandatory`, 500,
        'SiteArea', 'checkIfSiteAreaValid',
        req.user.id, filteredRequest.id);
    }
    if (!filteredRequest.siteID) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Site ID is mandatory`, 500,
        'SiteArea', 'checkIfSiteAreaValid',
        req.user.id, filteredRequest.id);
    }
    if (!filteredRequest.chargeBoxIDs) {
      filteredRequest.chargeBoxIDs = [];
    }
  }

  static getSiteArea(tenantID, id, withChargeBoxes?, withSite?) {
    return SiteAreaStorage.getSiteArea(tenantID, id, withChargeBoxes, withSite);
  }

  static getSiteAreas(tenantID, params?, limit?, skip?, sort?) {
    return SiteAreaStorage.getSiteAreas(tenantID, params, limit, skip, sort);
  }

  static getSiteAreaImage(tenantID, id) {
    return SiteAreaStorage.getSiteAreaImage(tenantID, id);
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

  setMaximumPower(maximumPower) {
    this.model.maximumPower = maximumPower;
  }

  getMaximumPower() {
    return this.model.maximumPower;
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

  setLatitude(latitude) {
    this.model.latitude = latitude;
  }

  getLatitude() {
    return this.model.latitude;
  }

  setAccessControlEnabled(accessControl) {
    this.model.accessControl = accessControl;
  }

  isAccessControlEnabled() {
    return this.model.accessControl;
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

  setImage(image) {
    this.model.image = image;
  }

  getImage() {
    return this.model.image;
  }

  /**
   *
   * @param withCompany
   * @param withUser
   * @returns {Promise<Site>}
   */
  async getSite() {
    // Get from DB
    const site = await SiteStorage.getSite(this.getTenantID(), this.model.siteID);
    // Keep it
    this.setSite(site);
    return site;
  }

  getSiteID() {
    return this.model.siteID;
  }

  setSite(site) {
    if (site) {
      this.model.site = site.getModel();
      this.model.siteID = site.getID();
    } else {
      this.model.site = null;
    }
  }

  save() {
    return SiteAreaStorage.saveSiteArea(this.getTenantID(), this.getModel());
  }

  saveImage() {
    return SiteAreaStorage.saveSiteAreaImage(this.getTenantID(), this.getModel());
  }

  delete() {
    return SiteAreaStorage.deleteSiteArea(this.getTenantID(), this.getID());
  }

  async getChargingStations() {
    // Get from DB
    const chargingStations = await ChargingStationStorage.getChargingStations(this.getTenantID(),
      { siteAreaID: this.getID() }, Constants.NO_LIMIT);
    // Keep it
    this.setChargingStations(chargingStations.result);
    return chargingStations.result;
  }

  setChargingStations(chargeBoxes) {
    this.model.chargeBoxes = chargeBoxes.map((chargeBox) => chargeBox.getModel());
  }
}
