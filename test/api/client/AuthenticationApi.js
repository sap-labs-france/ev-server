
class AuthenticationApi {

  constructor(baseApi) {
    this.baseApi = baseApi;
  }

  async login(email, password, acceptEula = true, tenant = '') {
    let data = {};
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
    if (tenant) {
      data.tenant = tenant;
    }
    // Send
    let response = await this.baseApi.send({
      method: 'POST',
      url: '/client/auth/Login',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data
    });
    return response;
  }
}

module.exports = AuthenticationApi;