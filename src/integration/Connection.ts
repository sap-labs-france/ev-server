import Database from '../utils/Database';
import TenantHolder from '../entity/TenantHolder';
export default class Connection extends TenantHolder {
	private model: any;

  constructor(tenantID, connection) {
    super(tenantID);
    this.model = {};

    Database.updateConnection(connection, this.model);
  }
  getModel() {
    return this.model;
  }

  getId() {
    return this.model.id;
  }

  getUserId() {
    return this.model.userId;
  }

  getConnectorId() {
    return this.model.connectorId;
  }

  getData() {
    return this.model.data;
  }

  getCreatedAt() {
    return this.model.createdAt;
  }
  getUpdatedAt() {
    return this.model.updatedAt;
  }

  updateData(data, updateDate, validUntil) {
    this.model.data = data;
    this.model.updatedAt = updateDate;
    this.model.validUntil = validUntil;
  }
}


