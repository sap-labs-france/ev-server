const CrudApi = require('./utils/CrudApi');
const Constants = require('./utils/Constants');
class SiteAreaApi extends CrudApi {
  constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  readById(id) {
    return super.readById('/client/api/SiteArea', id);
  }

  readAll(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll('/client/api/SiteAreas', params, paging, ordering);
  }

  create(data) {
    return super.create('/client/api/SiteAreaCreate', data);
  }

  update(data) {
    return super.update('/client/api/SiteAreaUpdate', data);
  }

  delete(id) {
    return super.delete('/client/api/SiteAreaDelete', id);
  }
}

module.exports = SiteAreaApi;