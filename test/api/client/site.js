const CrudApi = require('./utils/crudApi');

class SiteApi extends CrudApi {

  constructor(baseApi) {
    super({
      create: '/client/api/SiteCreate',
      readById: '/client/api/Site/',
      read: '/client/api/Sites/',
      update: '/client/api/SiteUpdate/',
      delete: '/client/api/SiteDelete/',
    }, baseApi);
  }
}

module.exports = SiteApi;