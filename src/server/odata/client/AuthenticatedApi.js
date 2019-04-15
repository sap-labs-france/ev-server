const BaseApi = require('./BaseApi');
const jwt = require('jsonwebtoken');

class AuthenticatedApi extends BaseApi {
  constructor(baseURL, user, password, tenant) {
    super(baseURL);
    this.user = user;
    this.password = password;
    this.tenant = tenant;
    this.token = null;
    this.tenantID = null;
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
      const response = await this.login(this.user, this.password, true, this.tenant);
      // Keep the token
      this.token = response.data.token;
      this.tenantID = jwt.decode(this.token).tenantID;
    }
  }

  async login(email, password, acceptEula = true, tenant = '') {
    const data = {};
    // Allow caller to not pass param for the tests
    if (email) {
      data.email = email;
    }
    if (password) {
      data.password = password;
    }
    if (acceptEula) {
      data.acceptEula = acceptEula;
    }
    if (tenant != null) {
      data.tenant = tenant;
    }
    // Send
    const response = await super.send({
      method: 'POST',
      url: '/client/auth/Login',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data
    });
    return response;
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

module.exports = AuthenticatedApi;