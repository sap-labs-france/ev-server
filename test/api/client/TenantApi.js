const CrudApi = require('./utils/CrudApi');

class TenantApi extends CrudApi {

    constructor(baseApi) {
        super({
            create: '/client/api/TenantCreate',
            readById: '/client/api/Tenant/',
            read: '/client/api/Tenants/',
            update: '/client/api/TenantUpdate/',
            delete: '/client/api/TenantDelete/'
        }, baseApi);
    }

    verify(tenant) {
        return this.readApi.read('/client/auth/VerifyTenant/', undefined, {'tenant': tenant});
    }
}

module.exports = TenantApi;