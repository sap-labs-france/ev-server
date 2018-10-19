class AbstractTenantEntity {

  constructor(tenant) {
    if (this.constructor === AbstractTenantEntity) {
      throw new TypeError('Abstract class cannot be instantiated directly');
    }
    this._tenant = tenant;
    this._model = {};
  }

  getTenant() {
    return this._tenant;
  }

  getModel() {
    return this._model;
  }
}

module.exports = AbstractTenantEntity;