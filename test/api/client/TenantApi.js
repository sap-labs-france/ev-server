const CrudApi = require('./utils/CrudApi');
const Constants = require('./utils/Constants');

class TenantApi extends CrudApi {
  constructor(authenticatedApi, baseApi) {
    super(authenticatedApi);
    // For call without auth
    this.baseApi = baseApi;
  }

  readById(id) {
    return super.readById('/client/api/Tenant', id);
  }

  readAll(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll('/client/api/Tenants', params, paging, ordering);
  }

  create(data) {
    return super.create('/client/api/TenantCreate', data);
  }

  update(data) {
    return super.update('/client/api/TenantUpdate', data);
  }

  delete(id) {
    return super.delete('/client/api/TenantDelete', id);
  }

  verify(tenant) {
    return this.baseApi.send({
      method: 'GET',
      url: '/client/auth/VerifyTenant',
      headers: {
        tenant
      }
    });
  }
}

module.exports = TenantApi;