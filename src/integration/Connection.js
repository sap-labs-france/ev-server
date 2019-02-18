const Database = require('../utils/Database');
const AbstractTenantEntity = require('../entity/AbstractTenantEntity');

class Connection extends AbstractTenantEntity {
  constructor(tenantID, connection) {
    super(tenantID);
    this._model = {};

    Database.updateConnection(connection, this._model);
  }
  getModel() {
    return this._model;
  }

  getId() {
    return this._model.id;
  }

  getUserId() {
    return this._model.userId;
  }

  getConnectorId() {
    return this._model.connectorId;
  }

  getData() {
    return this._model.data;
  }

  getCreatedAt() {
    return this._model.createdAt;
  }
  getUpdatedAt() {
    return this._model.updatedAt;
  }

  updateData(data, updateDate, validUntil) {
    this._model.data = data;
    this._model.updatedAt = updateDate;
    this._model.validUntil = validUntil;
  }
}

module.exports = Connection;
