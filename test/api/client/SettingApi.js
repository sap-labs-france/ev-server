const CrudApi = require('./utils/CrudApi');
const Constants = require('./utils/Constants');

class SettingApi extends CrudApi {
  constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  readById(id) {
    return super.readById('/client/api/Setting', id);
  }

  readAll(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll('/client/api/Settings', params, paging, ordering);
  }

  create(data) {
    return super.create('/client/api/SettingCreate', data);
  }

  update(data) {
    return super.update('/client/api/SettingUpdate', data);
  }

  delete(id) {
    return super.delete('/client/api/SettingDelete', id);
  }
}

module.exports = SettingApi;