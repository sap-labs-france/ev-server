import TenantHolder from './TenantHolder';
import Database from '../utils/Database';
import UserStorage from '../storage/mongodb/UserStorage';
import ChargingStationStorage from '../storage/mongodb/ChargingStationStorage';
import NotificationStorage from '../storage/mongodb/NotificationStorage';

export default class Notification extends TenantHolder {

  private model: any = {};

  //TODO: maybe convert tenantID from string to ObjectId at the earliest possible point instead of doing it in TenantStorage
  public constructor(tenantID: string, notification: any) {
    super(tenantID);
    // Set it
    Database.updateNotification(notification, this.model);
  }

  public getModel(): any {
    return this.model;
  }
  
  getID() {
    return this.model.id;
  }

  setSourceDescr(sourceDescr: string): void { //TODO: verify string type
    this.model.sourceDescr = sourceDescr;
  }

  getSourceDescr(): string {
    return this.model.sourceDescr;
  }

  setSourceId(sourceId) {
    this.model.sourceId = sourceId;
  }

  getSourceID() {
    return this.model.sourceID;
  }

  setChannel(channel) {
    this.model.channel = channel;
  }

  getChannel() {
    return this.model.channel;
  }

  setTimestamp(timestamp) {
    this.model.timestamp = timestamp;
  }

  getTimestamp() {
    return this.model.timestamp;
  }

  async getUser() {
    // Get from DB
    const user = await UserStorage.getUser(this.getTenantID(), this.model.userID);
    // Keep it
    this.setUser(user);
    return user;
  }

  getUserID() {
    return this.model.userID;
  }

  setUser(user) {
    if (user) {
      this.model.user = user.getModel();
      this.model.userID = user.getID();
    } else {
      this.model.user = null;
    }
  }

  setChargeBoxID(chargeBoxID) {
    this.model.chargeBoxID = chargeBoxID;
  }

  getChargeBoxID() {
    return this.model.chargeBoxID;
  }

  async getChargingStation() {
    // Get from DB
    const chargingStation = await ChargingStationStorage.getChargingStation(this.getTenantID(), this.getChargeBoxID());
    // Keep it
    this.setChargingStation(chargingStation);
    return chargingStation;
  }

  setChargingStation(chargingStation) {
    this.model.chargingStation = chargingStation.getModel();
  }

  save() {
    return NotificationStorage.saveNotification(this.getTenantID(), this.getModel());
  }

  static getNotifications(tenantID, params, limit, skip, sort) {
    return NotificationStorage.getNotifications(tenantID, params, limit, skip, sort);
  }
}
