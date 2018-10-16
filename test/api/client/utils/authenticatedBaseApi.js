const AuthenticationApi = require('../AuthenticationApi');

class AuthenticatedBaseApi {

  constructor(user, password, baseApi) {
    this.baseApi = baseApi;
    this.url = baseApi.url;
    this.authenticationApi = new AuthenticationApi(baseApi);
    this.user = user;
    this.password = password;
    this.token = null;
  }

  async authenticate() {
    if (!this.token) {
      const response = await this.authenticationApi.login(this.user, this.password);
      this.token = response.data.token;
    }
  }

  async send(data,expectations) {
    await this.authenticate();
    if (!data.headers) {
      data.headers = {};
    }
    data.headers['Authorization'] = `Bearer ${this.token}`;
    return await this.baseApi.send(data,expectations);
  }

}

module.exports = AuthenticatedBaseApi