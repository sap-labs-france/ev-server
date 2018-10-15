class AuthenticationApi {

  constructor(baseApi) {
    this.baseApi = baseApi;
  }

  login(email, password, acceptEula = true) {
    return this.baseApi.send({
      method: 'POST',
      path: '/client/auth/Login',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      payload: {
        email: email,
        password: password,
        acceptEula: acceptEula
      }
    });
  }

}

module.exports = AuthenticationApi;