import AuthenticatedBaseApi from "./utils/AuthenticatedBaseApi";

export default class AuthenticationApi {
  private _baseApi: any;
  public constructor(baseApi) {
    this._baseApi = baseApi;
  }

  public async login(email, password, acceptEula = true, tenant = '') {
    let data: any = {};
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
    const response = await this._baseApi.send({
      method: 'POST',
      url: '/client/auth/Login',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data
    });
    return response;
  }

<<<<<<< HEAD:test/api/client/AuthenticationApi.ts
  public async registerUser(user, tenant = '') {
    if (tenant != null) {
=======
  async registerUser(user, tenant = '') {
    if (tenant) {
>>>>>>> 345832f7ba56675c59b05cc0388f17cc4bdd119e:test/api/client/AuthenticationApi.js
      user.tenant = tenant;
    }
    // Send
    const response = await this._baseApi.send({
      method: 'POST',
      url: '/client/auth/RegisterUser',
      headers: {
        'Content-Type': 'application/json'
      },
      data: user
    });
    return response;
  }

  public async resetUserPassword(email, tenant = '') {
    const data = {
      email: email,
      tenant: tenant,
      captcha: '03AMGVjXiyflPJpUOJF-AW2YP9-uQZvbVKsnx2CaESTX7mr59laYB0KKn7QERpWk-cadi1e2D0oYyjClv6UcYJ3IrYI951f2uopiLQv8ykAKEz3TQ3ZWgYJQSvItSZ7cd8wSFl7EF9aVEIHJobWg4OljtmSf2YUyXFnma76ih089LfUe0uSQC8piAT6DJ5WVcNaR827jbJrzCtYSPFX8u_GSFM6jCQU0RdnFgTuFIst2hyZ_FfiKJSpG9pSF2avSie1R-y6PVJktxNHdDaTuN4PK-AucjKrHSO9A'
    };
    // Send
    const response = await this._baseApi.send({
      method: 'POST',
      url: '/client/auth/Reset',
      headers: {
        'Content-Type': 'application/json'
      },
      data: data
    });
    return response;
  }
}

<<<<<<< HEAD:test/api/client/AuthenticationApi.ts
// module.exports = AuthenticationApi;
=======
module.exports = AuthenticationApi;
>>>>>>> 345832f7ba56675c59b05cc0388f17cc4bdd119e:test/api/client/AuthenticationApi.js
