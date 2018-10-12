const CrudApi = require('./utils/crudApi');

class SiteAreaApi extends CrudApi {

  constructor(baseApi) {
    super({
      create: '/client/api/SiteAreaCreate',
      readById: '/client/api/SiteArea/',
      read: '/client/api/SiteAreas/',
      update: '/client/api/SiteAreaUpdate/',
      delete: '/client/api/SiteAreaDelete/',
    }, baseApi);
  }
}

module.exports = SiteAreaApi;