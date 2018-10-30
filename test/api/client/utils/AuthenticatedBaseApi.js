const {expect} = require('chai');
const BaseApi = require('./BaseApi');
const AuthenticationApi = require('../AuthenticationApi');
const jwt = require('jsonwebtoken');

class AuthenticatedBaseApi extends BaseApi {
  constructor(baseURL, user, password, tenant) {
    super(baseURL);
    this.authenticationApi = new AuthenticationApi(new BaseApi(baseURL));
    this.user = user;
    this.password = password;
    this.tenant = tenant;
    this.token = null;
    this.tenantID = null
  }

  async getTenantID() {
    if (!this.tenantID) {
      await this.authenticate();
    }
    return this.tenantID;
  }

  async authenticate() {
    // Already logged?
    if (!this.token) {
      // No, try to log in
      const response = await this.authenticationApi.login(this.user, this.password, true, this.tenant);
      // Keep the token
      expect(response.status).to.be.eql(200);
      expect(response.data).to.have.property('token');
      this.token = response.data.token;
      this.tenantID = jwt.decode(this.token).tenantID;
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