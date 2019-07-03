import ConnectionStorage from '../storage/mongodb/ConnectionStorage';
import SettingStorage from '../storage/mongodb/SettingStorage';
import TenantHolder from '../entity/TenantHolder';
import User from '../types/User';
export default class AbstractConnector extends TenantHolder {
  public getID: any;
  public getTenantID: any;
  private setting: any;
  private connectorId: any;

  constructor(tenantID, connectorId, setting) {
    super(tenantID);
    this.setting = setting;
    this.connectorId = connectorId;
  }

  static getConnectorSetting(tenantId, settingId) {
    return SettingStorage.getSetting(tenantId, settingId);
  }

  static getConnectionsByUserId(tenantId, userId) {
    return ConnectionStorage.getConnectionsByUserId(tenantId, userId);
  }

  static getConnectionByUserIdAndConnectorId(tenantId, connectorId, userId) {
    return ConnectionStorage.getConnectionByUserId(tenantId, connectorId, userId);
  }

  static getConnection(tenantId, id) {
    return ConnectionStorage.getConnection(tenantId, id); // TODO: Changed from getConnectionById cuz non existent. Check if correct
  }

  static deleteConnectionById(tenantId, id) {
    return ConnectionStorage.deleteConnectionById(tenantId, id);
  }

  getSetting() {
    return this.setting;
  }

  getCreatedBy() {
    if (this.setting.createdBy) {
      return this.setting.createdBy;
    }
    return null;
  }

  setCreatedBy(user: User) {
    this.setting.createdBy = user;
  }

  getCreatedOn() {
    return this.setting.createdOn;
  }

  setCreatedOn(createdOn) {
    this.setting.createdOn = createdOn;
  }

  getLastChangedBy() {
    if (this.setting.lastChangedBy) {
      return this.setting.lastChangedBy;
    }
    return null;
  }

  setLastChangedBy(user: User) {
    this.setting.lastChangedBy = user;
  }

  getLastChangedOn() {
    return this.setting.lastChangedOn;
  }

  setLastChangedOn(lastChangedOn) {
    this.setting.lastChangedOn = lastChangedOn;
  }

  getConnectionByUserId(userId) {
    return ConnectionStorage.getConnectionByUserId(this.getTenantID(), this.connectorId, userId);
  }

  //
  // getConnections() {
  //   return ConnectorStorage.getConnections(this.getConnectorId());
  // }
  //
  // saveConnection(connection) {
  //   return ConnectorStorage.saveConnection(this.getTenant(), connection);
  // }

  createConnection(userId, data) {
    throw new Error('not implemented');
  }
}

