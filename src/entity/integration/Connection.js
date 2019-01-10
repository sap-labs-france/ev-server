const Database = require('../../utils/Database');
const AbstractTenantEntity = require('../AbstractTenantEntity');

class Connection extends AbstractTenantEntity {
  constructor(tenantID, connection) {
    super(tenantID);
    this._model = {};

    Database.updateConnection(connection, this._model);
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
}

module.exports = Connection;
