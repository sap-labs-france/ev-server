const TenantStorage = require('../storage/mongodb/TenantStorage');

class AbstractTenantEntity {

  constructor(tenantID) {
    if (this.constructor === AbstractTenantEntity) {
      throw new TypeError('Abstract class cannot be instantiated directly');
    }
    this._tenantID = tenantID;
    this._tenant = null;
    this._model = {};
  }

  getTenantID() {
    return this._tenantID;
  }

  /**
   *
   * @returns {Promise<Tenant>}
   */
  async getTenant() {
    if (!this._tenant) {
      this._tenant = await TenantStorage.getTenant(this._tenantID);
    }
    return this._tenant;
  }

  getModel() {
    return this._model;
  }
}

module.exports = AbstractTenantEntity;