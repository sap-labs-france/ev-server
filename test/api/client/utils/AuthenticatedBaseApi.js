const AuthenticationApi = require('../AuthenticationApi');
const BaseApi = require('./BaseApi');

class AuthenticatedBaseApi extends BaseApi {
  constructor(baseURL, user, password) {
    super(baseURL);
    this.authenticationApi = new AuthenticationApi(new BaseApi(baseURL));
    this.user = user;
    this.password = password;
    this.token = null;
  }

  async authenticate() {
    // Already logged?
    if (!this.token) {
      // No, try to log in
      const response = await this.authenticationApi.login(this.user, this.password);
      // Keep the token
      this.token = response.data.token;
    }
  }

  async send(data) {
    // Authenticate first
    await this.authenticate();
    // Init Headers
    if (!data.headers) {
      data.headers = {};
    }
    // Set the Authorization Header with the token
    data.headers['Authorization'] = `Bearer ${this.token}`;
    // Exec the request
    return super.send(data);
  }

}

module.exports = AuthenticatedBaseApi