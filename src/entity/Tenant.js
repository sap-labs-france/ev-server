
const Database = require('../utils/Database');
const TenantStorage = require('../storage/mongodb/TenantStorage');
const User = require('./User');
const Constants = require('../utils/Constants');

class Tenant {
  constructor(tenant){
    // Init model
    this._model = {};

    // Set it
    Database.updateTenant(tenant, this._model);
  }

  getModel(){
    return this._model;
  }

  getID(){
    return this._model.id;
  }

  isMasterTenant() {
    return this._model.masterTenant;
  }

  setName(name){
    this._model.name = name;
  }

  getName(){
    return this._model.name;
  }

  setEmail(email){
    this._model.email = email;
  }

  getEmail(){
    return this._model.email;
  }

  setSubdomain(subdomain){
    this._model.subdomain = subdomain;
  }

  getSubdomain(){
    return this._model.subdomain;
  }

  getCreatedBy(){
    if (this._model.createdBy) {
      return new User(this.getID(), this._model.createdBy);
    }
    return null;
  }

  setCreatedBy(user){
    this._model.createdBy = user.getModel();
  }

  getCreatedOn(){
    return this._model.createdOn;
  }

  setCreatedOn(createdOn){
    this._model.createdOn = createdOn;
  }

  getLastChangedBy(){
    if (this._model.lastChangedBy) {
      return new User(this.getID(), this._model.lastChangedBy);
    }
    return null;
  }

  setLastChangedBy(user){
    this._model.lastChangedBy = user.getModel();
  }

  getLastChangedOn(){
    return this._model.lastChangedOn;
  }

  setLastChangedOn(lastChangedOn){
    this._model.lastChangedOn = lastChangedOn;
  }

  save(){
    return TenantStorage.saveTenant(this.getModel());
  }

  async createEnvironment(){
    await TenantStorage.createTenantDB(this.getID());

    const password = await User.hashPasswordBcrypt(User.generatePassword());
    const tenantUser = new User(this.getID(), {
      name: this.getName(),
      firstName: "Admin",
      password: password,
      status: Constants.USER_STATUS_PENDING,
      role: Constants.ROLE_ADMIN,
      email: this.getEmail(),
      createdOn: new Date().toISOString()
    });
    await tenantUser.save();
  }

  async deleteEnvironment(){
    await TenantStorage.deleteTenantDB(this.getID());
  }

  delete(){
    return TenantStorage.deleteTenant(this.getID());
  }

  static getTenant(id){
    // Get Tenant
    return TenantStorage.getTenant(id)
  }

  static getTenantByName(name){
    // Get Tenant
    return TenantStorage.getTenantByName(name);
  }

  static getTenantBySubdomain(subdomain){
    // Get Tenant
    return TenantStorage.getTenantBySubdomain(subdomain);
  }

  static getTenants(params = {}, limit, skip, sort){
    // Get Tenants
    return TenantStorage.getTenants(params, limit, skip, sort);
  }
}

module.exports = Tenant;