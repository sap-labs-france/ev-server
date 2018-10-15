const CrudApi = require('./utils/CrudApi');

class CompanyApi extends CrudApi {

  constructor(baseApi) {
    super({
      create: '/client/api/CompanyCreate',
      readById: '/client/api/Company/',
      read: '/client/api/Companies/',
      update: '/client/api/CompanyUpdate/',
      delete: '/client/api/CompanyDelete/',
    }, baseApi);
  }
}

module.exports = CompanyApi;