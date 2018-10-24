const CrudApi = require('./utils/CrudApi');
const Constants = require('./utils/Constants');

class UserApi extends CrudApi {
  constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  readById(id) {
    return super.readById('/client/api/User', id);
  }

  readAll(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll('/client/api/Users', params, paging, ordering);
  }

  create(data) {
    return super.create('/client/api/UserCreate', data);
  }

  update(data) {
    return super.update('/client/api/UserUpdate', data);
  }

  delete(id) {
    return super.delete('/client/api/UserDelete', id);
  }
}

module.exports = UserApi;