const CrudApi = require('./utils/CrudApi');
const Constants = require('./utils/Constants')

class SiteApi extends CrudApi {
  constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  readById(id) {
    return super.readById('/client/api/Site', id);
  }

  readAll(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll('/client/api/Sites', params, paging, ordering);
  }

  create(data) {
    return super.create('/client/api/SiteCreate', data);
  }

  update(data) {
    return super.update('/client/api/SiteUpdate', data);
  }

  delete(id) {
    return super.delete('/client/api/SiteDelete', id);
  }
}

module.exports = SiteApi;