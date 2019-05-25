const Database = require('../utils/Database');
const TenantStorage = require('../storage/mongodb/TenantStorage');
const User = require('./User');
const Setting = require('../entity/Setting');

class Tenant {
  constructor(tenant) {
    // Init model
    this._model = {};

    // Set it
    Database.updateTenant(tenant, this._model);
  }

  static getTenant(id) {
    // Get Tenant
    return TenantStorage.getTenant(id);
  }

  static getTenantByName(name) {
    // Get Tenant
    return TenantStorage.getTenantByName(name);
  }

  static getTenantBySubdomain(subdomain) {
    // Get Tenant
    return TenantStorage.getTenantBySubdomain(subdomain);
  }

  static getTenants(params = {}, limit, skip, sort) {
    // Get Tenants
    return TenantStorage.getTenants(params, limit, skip, sort);
  }

  getModel() {
    return this._model;
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

  setEmail(email) {
    this._model.email = email;
  }

  getEmail() {
    return this._model.email;
  }

  setSubdomain(subdomain) {
    this._model.subdomain = subdomain;
  }

  getSubdomain() {
    return this._model.subdomain;
  }

  isComponentActive(identifier) {
    return (this._model.components[identifier] && this._model.components[identifier].active ? true : false);
  }

  activateComponent(identifier) {
    if (!this._model.components[identifier]) {
      this._model.components[identifier] = {};
    }

    this._model.components[identifier].active = true;
  }

  deactivateComponent(identifier) {
    if (!this._model.components[identifier]) {
      this._model.components[identifier] = {};
    }

    this._model.components[identifier].active = false;
  }

  getActiveComponentNames() {
    const activeComponents = [];
    for (const componentName in this._model.components) {
      if (this._model.components.hasOwnProperty(componentName) && this._model.components[componentName].active) {
        activeComponents.push(componentName);
      }
    }
    return activeComponents;
  }

  getActiveComponents() {
    const activeComponents = [];
    for (const componentName in this._model.components) {
      if (this._model.components.hasOwnProperty(componentName) && this._model.components[componentName].active) {
        if (this._model.components[componentName].type) {
          activeComponents.push(`${componentName}_${this._model.components[componentName].type}`);
        }
        activeComponents.push(componentName);
      }
    }
    return activeComponents;
  }

  getComponents() {
    const components = [];
    for (const componentName in this._model.components) {
      components.push({name: componentName, ...this._model.components[componentName]});
    }
    return components;
  }

  setComponentConfigTenantLevel(identifier, configuration) {
    if (!this._model.components[identifier]) {
      this._model.components[identifier] = {};
    }

    if (configuration) {
      this._model.components[identifier].configuration = configuration;
    }
  }

  async getSetting(identifier) {
    return await Setting.getSettingByIdentifier(this.getID(), identifier);
  }

  getCreatedBy() {
    if (this._model.createdBy) {
      return new User(this.getID(), this._model.createdBy);
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
      return new User(this.getID(), this._model.lastChangedBy);
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
    // Init Services
    return TenantStorage.saveTenant(this.getModel());
  }

  async createEnvironment() {
    await TenantStorage.createTenantDB(this.getID());
  }

  async deleteEnvironment() {
    await TenantStorage.deleteTenantDB(this.getID());
  }

  delete() {
    return TenantStorage.deleteTenant(this.getID());
  }
}

module.exports = Tenant;
