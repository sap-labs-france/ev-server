import ChargingStationStorage from '../storage/mongodb/ChargingStationStorage';
import Database from '../utils/Database';
import NotificationStorage from '../storage/mongodb/NotificationStorage';
import TenantHolder from './TenantHolder';
import UserStorage from '../storage/mongodb/UserStorage';

export default class Notification extends TenantHolder {
  private _model: any = {};

  public constructor(tenantID: any, notification: any) {
    super(tenantID);
    Database.updateNotification(notification, this._model);
  }

  static getNotifications(tenantID, params, limit, skip, sort) {
    return NotificationStorage.getNotifications(tenantID, params, limit, skip, sort);
  }

  public getModel(): any {
    return this._model;
  }

  getID() {
    return this._model.id;
  }

  setSourceDescr(sourceDescr: string): void { // TODO: verify string type
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
      this._model.user = user;
      this._model.userID = user.id;
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
    this._model.chargingStation = chargingStation;
  }

  save() {
    return NotificationStorage.saveNotification(this.getTenantID(), this.getModel());
  }
}
