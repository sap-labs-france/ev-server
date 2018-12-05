const AbstractTenantEntity = require('./AbstractTenantEntity');
const Database = require('../utils/Database');
const Constants = require('../utils/Constants');
const AppError = require('../exception/AppError');
const ComponentStorage = require('../storage/mongodb/ComponentStorage');
const User = require('./User');

class Component extends AbstractTenantEntity {
  constructor(tenantID, component) {
    super(tenantID);
    // Set it
    Database.updateComponent(component, this._model);
  }

  getID() {
    return this._model.id;
  }

  /**
   * Identifier of the component
   */
  getIdentifier() {
    return this._model.identifier;
  }

  setIdentifier(identifier) {
    this._model.identifier = identifier;
  }

  /**
   * get Configuration
   */
  getConfiguration() {
    return this._model.configuration;
  }

  setConfiguration(configuration) {
    this._model.configuration = configuration;
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

  save() {
    return ComponentStorage.saveComponent(this.getTenantID(), this.getModel());
  }

  delete() {
    return ComponentStorage.deleteComponent(this.getTenantID(), this.getID());
  }

  static checkIfComponentValid(request, httpRequest) {
    // Update model?
    if (httpRequest.method !== 'POST' && !request.id) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The Component ID is mandatory`, 500,
        'Component', 'checkIfComponentValid');
    }
  }

  static getComponent(tenantID, id) {
    return ComponentStorage.getComponent(tenantID, id);
  }

  static async getComponentByIdentifier(tenantID, identifier) {
    return await ComponentStorage.getComponentByIdentifier(tenantID, identifier);
  }
}

module.exports = Component;
