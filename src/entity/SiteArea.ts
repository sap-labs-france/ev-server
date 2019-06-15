import TenantHolder from './TenantHolder';
import Database from '../utils/Database';
import Constants from '../utils/Constants';
import AppError from '../exception/AppError';
import SiteStorage from '../storage/mongodb/SiteStorage';
import SiteAreaStorage from '../storage/mongodb/SiteAreaStorage';
import ChargingStationStorage from '../storage/mongodb/ChargingStationStorage';
import User from './User';

export default class SiteArea extends TenantHolder {
  private _model: any = {};

  constructor(tenantID: any, siteArea: any) {
    super(tenantID);
    Database.updateSiteArea(siteArea, this._model);
  }

  public getModel(): any {
    return this._model;
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

  setMaximumPower(maximumPower) {
    this._model.maximumPower = maximumPower;
  }

  getMaximumPower() {
    return this._model.maximumPower;
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

  setLatitude(latitude) {
    this._model.latitude = latitude;
  }

  getLatitude() {
    return this._model.latitude;
  }

  setAccessControlEnabled(accessControl) {
    this._model.accessControl = accessControl;
  }

  isAccessControlEnabled() {
    return this._model.accessControl;
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

  setImage(image) {
    this._model.image = image;
  }

  getImage() {
    return this._model.image;
  }

  async getSite() {
    const site = await SiteStorage.getSite(this.getTenantID(), this._model.siteID);
    this.setSite(site);
    return site;
  }

  getSiteID() {
    return this._model.siteID;
  }

  setSite(site) {
    if (site) {
      this._model.site = site.getModel();
      this._model.siteID = site.getID();
    } else {
      this._model.site = null;
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
    const chargingStations = await ChargingStationStorage.getChargingStations(this.getTenantID(),
      { siteAreaID: this.getID() }, Constants.NO_LIMIT);
    this.setChargingStations(chargingStations.result);
    return chargingStations.result;
  }

  setChargingStations(chargeBoxes) {
    this._model.chargeBoxes = chargeBoxes.map((chargeBox) => { return chargeBox.getModel(); });
  }
}
