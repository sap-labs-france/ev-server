import TenantEntity = require('./AbstractTenantEntity');
import Database = require('../utils/Database');
import UserStorage = require('../storage/mongodb/UserStorage');
import ChargingStationStorage = require('../storage/mongodb/ChargingStationStorage');
import NotificationStorage = require('../storage/mongodb/NotificationStorage');

export class Notification extends TenantEntity {
  //TODO: maybe convert tenantID from string to ObjectId at the earliest possible point instead of doing it in TenantStorage
  public constructor(tenantID: string, notification: string) {
    super(tenantID);
    // Set it
    Database.updateNotification(notification, this._model);
  }

  getID() {
    return this._model.id;
  }

  setSourceDescr(sourceDescr: string): void { //TODO: verify string type
    this._model.sourceDescr = sourceDescr;
  }

  getSourceDescr(): string {
    return this._model.sourceDescr;
  }

  setSourceId(sourceId) {
    this._model.sourceId = sourceId;
  }

  getSourceID() {
    return this._model.sourceID;
  }

  setChannel(channel) {
    this._model.channel = channel;
  }

  getChannel() {
    return this._model.channel;
  }

  setTimestamp(timestamp) {
    this._model.timestamp = timestamp;
  }

  getTimestamp() {
    return this._model.timestamp;
  }

  async getUser() {
    // Get from DB
    const user = await UserStorage.getUser(this.getTenantID(), this._model.userID);
    // Keep it
    this.setUser(user);
    return user;
  }

  getUserID() {
    return this._model.userID;
  }

  setUser(user) {
    if (user) {
      this._model.user = user.getModel();
      this._model.userID = user.getID();
    } else {
      this._model.user = null;
    }
  }

  setChargeBoxID(chargeBoxID) {
    this._model.chargeBoxID = chargeBoxID;
  }

  getChargeBoxID() {
    return this._model.chargeBoxID;
  }

  async getChargingStation() {
    // Get from DB
    const chargingStation = await ChargingStationStorage.getChargingStation(this.getTenantID(), this.getChargeBoxID());
    // Keep it
    this.setChargingStation(chargingStation);
    return chargingStation;
  }

  setChargingStation(chargingStation) {
    this._model.chargingStation = chargingStation.getModel();
  }

  save() {
    return NotificationStorage.saveNotification(this.getTenantID(), this.getModel());
  }

  static getNotifications(tenantID, params, limit, skip, sort) {
    return NotificationStorage.getNotifications(tenantID, params, limit, skip, sort);
  }
}
