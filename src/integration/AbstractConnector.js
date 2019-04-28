const ConnectionStorage = require('../storage/mongodb/ConnectionStorage');
const SettingStorage = require('../storage/mongodb/SettingStorage');
const AbstractTenantEntity = require('../entity/AbstractTenantEntity');
const User = require('../entity/User');

class AbstractConnector extends AbstractTenantEntity {
  constructor(tenantID, connectorId, setting) {
    super(tenantID);
    this._setting = setting;
    this._connectorId = connectorId;
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

  static getConnectionById(tenantId, id) {
    return ConnectionStorage.getConnectionById(tenantId, id);
  }

  static deleteConnectionById(tenantId, id) {
    return ConnectionStorage.deleteConnectionById(tenantId, id);
  }

  getSetting() {
    return this._setting;
  }

  getCreatedBy() {
    if (this._setting.createdBy) {
      return new User(this.getID(), this._setting.createdBy);
    }
    return null;
  }

  setCreatedBy(user) {
    this._setting.createdBy = user.getModel();
  }

  getCreatedOn() {
    return this._setting.createdOn;
  }

  setCreatedOn(createdOn) {
    this._setting.createdOn = createdOn;
  }

  getLastChangedBy() {
    if (this._setting.lastChangedBy) {
      return new User(this.getID(), this._setting.lastChangedBy);
    }
    return null;
  }

  setLastChangedBy(user) {
    this._setting.lastChangedBy = user.getModel();
  }

  getLastChangedOn() {
    return this._setting.lastChangedOn;
  }

  setLastChangedOn(lastChangedOn) {
    this._setting.lastChangedOn = lastChangedOn;
  }

  getConnectionByUserId(userId) {
    return ConnectionStorage.getConnectionByUserId(this.getTenantID(), this._connectorId, userId);
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

module.exports = AbstractConnector;
