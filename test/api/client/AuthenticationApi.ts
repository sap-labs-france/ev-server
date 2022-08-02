import BaseApi from './utils/BaseApi';
import { RESTServerRoute } from '../../../src/types/Server';
import User from '../../../src/types/User';

export default class AuthenticationApi {
  private baseApi: BaseApi;
  public constructor(baseApi: BaseApi) {
    this.baseApi = baseApi;
  }

  public async login(email: string, password: string, acceptEula = true, tenant = ''): Promise<any> {
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
    data.tenant = tenant ?? '';
    // Send
    const response = await this.baseApi.send({
      method: 'POST',
      url: '/v1/auth/' + RESTServerRoute.REST_SIGNIN,
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

  async registerUser(user: User, tenant = null): Promise<any> {
    // Send
    const response = await this.baseApi.send({
      method: 'POST',
      url: '/v1/auth/' + RESTServerRoute.REST_SIGNON,
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

  public async resetUserPassword(email: string, tenant = ''): Promise<any> {
    const data = {
      email: email,
      tenant: tenant,
      captcha: '03AMGVjXiyflPJpUOJF-AW2YP9-uQZvbVKsnx2CaESTX7mr59laYB0KKn7QERpWk-cadi1e2D0oYyjClv6UcYJ3IrYI951f2uopiLQv8ykAKEz3TQ3ZWgYJQSvItSZ7cd8wSFl7EF9aVEIHJobWg4OljtmSf2YUyXFnma76ih089LfUe0uSQC8piAT6DJ5WVcNaR827jbJrzCtYSPFX8u_GSFM6jCQU0RdnFgTuFIst2hyZ_FfiKJSpG9pSF2avSie1R-y6PVJktxNHdDaTuN4PK-AucjKrHSO9A'
    };
    // Send
    const response = await this.baseApi.send({
      method: 'POST',
      url: '/v1/auth/' + RESTServerRoute.REST_PASSWORD_RESET,
      headers: {
        'Content-Type': 'application/json'
      },
      data: data
    });
    return response;
  }

  public async resendVerificationEmail(email: string, tenant = ''): Promise<any> {
    const data = {
      email: email,
      tenant: tenant,
      captcha: '03AMGVjXiyflPJpUOJF-AW2YP9-uQZvbVKsnx2CaESTX7mr59laYB0KKn7QERpWk-cadi1e2D0oYyjClv6UcYJ3IrYI951f2uopiLQv8ykAKEz3TQ3ZWgYJQSvItSZ7cd8wSFl7EF9aVEIHJobWg4OljtmSf2YUyXFnma76ih089LfUe0uSQC8piAT6DJ5WVcNaR827jbJrzCtYSPFX8u_GSFM6jCQU0RdnFgTuFIst2hyZ_FfiKJSpG9pSF2avSie1R-y6PVJktxNHdDaTuN4PK-AucjKrHSO9A'
    };
    // Send
    const response = await this.baseApi.send({
      method: 'POST',
      url: '/v1/auth/' + RESTServerRoute.REST_MAIL_RESEND,
      headers: {
        'Content-Type': 'application/json'
      },
      data: data
    });
    return response;
  }

  public async verifyEmail(email: string, verificationToken: string, tenant = ''): Promise<any> {
    // Send
    const response = await this.baseApi.send({
      method: 'GET',
      url: `/v1/auth/${RESTServerRoute.REST_MAIL_CHECK}?Email=${email}&Tenant=${tenant}&VerificationToken=${verificationToken}`,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    return response;
  }

  public async getEula(language?: string): Promise<any> {
    // Send
    const response = await this.baseApi.send({
      method: 'GET',
      url: '/v1/auth/' + RESTServerRoute.REST_END_USER_LICENSE_AGREEMENT,
      headers: {
        'Content-Type': 'application/json'
      },
      data: { language }
    });
    return response;
  }
}

