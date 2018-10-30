class AbstractTenantEntity {

  constructor(tenantID) {
    if (this.constructor === AbstractTenantEntity) {
      throw new TypeError('Abstract class cannot be instantiated directly');
    }
    this._tenantID = tenantID;
    this._model = {};
  }

  getTenantID() {
    return this._tenantID;
  }

  getModel() {
    return this._model;
  }
}

module.exports = AbstractTenantEntity;