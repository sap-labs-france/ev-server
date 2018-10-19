const CrudApi = require('./utils/CrudApi');
const Constants = require('./utils/Constants')

class CompanyApi extends CrudApi {

  constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  readById(id) {
    return super.readById('/client/api/Company/', id);
  }

  readAll(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll('/client/api/Companies/', params, paging, ordering);
  }

  create(data) {
    return super.create('/client/api/CompanyCreate', data);
  }

  update(data) {
    return super.update('/client/api/CompanyUpdate/', data);
  }

  delete(id) {
    return super.delete('/client/api/CompanyDelete/', id);
  }
}

module.exports = CompanyApi;