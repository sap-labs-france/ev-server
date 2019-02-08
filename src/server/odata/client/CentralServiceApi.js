const AuthenticatedApi = require('./AuthenticatedApi');

class CentralServiceApi extends AuthenticatedApi {
  constructor(baseURL, user, password, tenant) {
    super(baseURL,user,password,tenant);
  }

  async getCompanies(params) {
    return await this.send({
      method: 'GET',
      url: '/client/api/Companies',
      params: params
    });
  }

  async getSites(params) {
    return await this.send({
      method: 'GET',
      url: '/client/api/Sites',
      params: params
    });
  }

}

module.exports = CentralServiceApi