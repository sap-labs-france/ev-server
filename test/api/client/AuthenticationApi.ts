import BaseApi from './utils/BaseApi';
import { ServerAction } from '../../../src/types/Server';
import { ServerRoute } from '../../../src/types/Server';
import User from '../../../src/types/User';

export default class AuthenticationApi {
  private _baseApi: BaseApi;
  public constructor(baseApi) {
    this._baseApi = baseApi;
  }

  public async login(email: string, password: string, acceptEula = true, tenant = '') {
    const data: any = {};
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
      url: '/v1/auth/' + ServerRoute.REST_SIGNIN,
      'axios-retry': {
        retries: 0
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data
    });
    return response;
  }

  async registerUser(user: User, tenant = null) {
    // Send
    const response = await this._baseApi.send({
      method: 'POST',
      url: '/v1/auth/' + ServerRoute.REST_SIGNON,
      headers: {
        'Content-Type': 'application/json'
      },
      data: {
        ...user,
        tenant
      }
    });
    return response;
  }

  public async resetUserPassword(email: string, tenant = '') {
    const data = {
      email: email,
      tenant: tenant,
      captcha: '03AMGVjXiyflPJpUOJF-AW2YP9-uQZvbVKsnx2CaESTX7mr59laYB0KKn7QERpWk-cadi1e2D0oYyjClv6UcYJ3IrYI951f2uopiLQv8ykAKEz3TQ3ZWgYJQSvItSZ7cd8wSFl7EF9aVEIHJobWg4OljtmSf2YUyXFnma76ih089LfUe0uSQC8piAT6DJ5WVcNaR827jbJrzCtYSPFX8u_GSFM6jCQU0RdnFgTuFIst2hyZ_FfiKJSpG9pSF2avSie1R-y6PVJktxNHdDaTuN4PK-AucjKrHSO9A'
    };
    // Send
    const response = await this._baseApi.send({
      method: 'POST',
      url: '/v1/auth/' + ServerRoute.REST_PASSWORD_RESET,
      headers: {
        'Content-Type': 'application/json'
      },
      data: data
    });
    return response;
  }

  public async resendVerificationEmail(email: string, tenant = '') {
    const data = {
      email: email,
      tenant: tenant,
      captcha: '03AMGVjXiyflPJpUOJF-AW2YP9-uQZvbVKsnx2CaESTX7mr59laYB0KKn7QERpWk-cadi1e2D0oYyjClv6UcYJ3IrYI951f2uopiLQv8ykAKEz3TQ3ZWgYJQSvItSZ7cd8wSFl7EF9aVEIHJobWg4OljtmSf2YUyXFnma76ih089LfUe0uSQC8piAT6DJ5WVcNaR827jbJrzCtYSPFX8u_GSFM6jCQU0RdnFgTuFIst2hyZ_FfiKJSpG9pSF2avSie1R-y6PVJktxNHdDaTuN4PK-AucjKrHSO9A'
    };
    // Send
    const response = await this._baseApi.send({
      method: 'POST',
      url: '/v1/auth/' + ServerRoute.REST_MAIL_RESEND,
      headers: {
        'Content-Type': 'application/json'
      },
      data: data
    });
    return response;
  }

  public async verifyEmail(email: string, verificationToken: string, tenant = '') {
    // Send
    const response = await this._baseApi.send({
      method: 'GET',
      url: `/v1/auth/${ServerRoute.REST_MAIL_CHECK}?Email=${email}&Tenant=${tenant}&VerificationToken=${verificationToken}`,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    return response;
  }

  public async getEula(language?: string) {
    // Send
    const response = await this._baseApi.send({
      method: 'GET',
      url: '/v1/auth/' + ServerRoute.REST_END_USER_LICENSE_AGREEMENT,
      headers: {
        'Content-Type': 'application/json'
      },
      data: { language }
    });
    return response;
  }
}

