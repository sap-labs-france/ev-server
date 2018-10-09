const CrudApi = require('./utils/crudApi');

class UserApi extends CrudApi {

  constructor(baseApi) {
    super({
      create: '/client/api/UserCreate',
      readById: '/client/api/User/',
      read: '/client/api/Users/',
      update: '/client/api/UserUpdate/',
      delete: '/client/api/UserDelete/',
    }, baseApi);
  }
}

module.exports = UserApi;