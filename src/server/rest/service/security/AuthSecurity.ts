import { Request } from 'express';
import sanitize from 'mongo-sanitize';
import Constants from '../../../../utils/Constants';
import { HttpLoginRequest, HttpRegisterUserRequest, HttpResendVerificationMailRequest, HttpResetPasswordRequest, HttpVerifyEmailRequest, HttpCheckEulaRequest } from '../../../../types/requests/HttpUserRequest';
import UtilsSecurity from './UtilsSecurity';

export default class AuthSecurity {

  public static filterCheckEulaRequest(request: any): HttpCheckEulaRequest {
    return {
      Email: sanitize(request.Email),
      Tenant: sanitize(request.Tenant)
    };
  }

  public static filterResetPasswordRequest(request: any): Partial<HttpResetPasswordRequest> {
    const filteredRequest: any = {};
    // Set
    filteredRequest.email = sanitize(request.email);
    filteredRequest.tenant = sanitize(request.tenant);
    filteredRequest.captcha = sanitize(request.captcha);
    filteredRequest.hash = sanitize(request.hash);
    return filteredRequest;
  }

  public static filterRegisterUserRequest(request: any): Partial<HttpRegisterUserRequest> {
    return {
      name: sanitize(request.name),
      acceptEula: sanitize(request.acceptEula),
      captcha: sanitize(request.captcha),
      status: Constants.USER_STATUS_PENDING,
      password: sanitize(request.passwords.password),
      email: sanitize(request.email),
      firstName: sanitize(request.firstName),
      tenant: sanitize(request.tenant)
    };
  }

  public static filterLoginRequest(request: any): Partial<HttpLoginRequest> {
    return {
      email: sanitize(request.email),
      password: sanitize(request.password),
      tenant: sanitize(request.tenant),
      acceptEula: UtilsSecurity.filterBoolean(request.acceptEula)
    };
  }

  public static filterVerifyEmailRequest(request: any): Partial<HttpVerifyEmailRequest> {
    return {
      Email: sanitize(request.Email),
      tenant: sanitize(request.tenant),
      VerificationToken: sanitize(request.VerificationToken)
    };
  }

  public static filterResendVerificationEmail(request: any): Partial<HttpResendVerificationMailRequest> {
    return {
      email: sanitize(request.email),
      tenant: sanitize(request.tenant),
      captcha: sanitize(request.captcha)
    };
  }

  public static filterEndUserLicenseAgreementRequest(request: Request): {Language: string; tenant: string} {
    const filteredRequest: any = {};
    // Set
    if (request.query) {
      filteredRequest.Language = sanitize(request.query.Language);
    }
    if (request.headers) {
      filteredRequest.tenant = sanitize(request.headers.tenant);
    }
    return filteredRequest;
  }

  static filterEndUserLicenseAgreementResponse(endUserLicenseAgreement) {
    const filteredEndUserLicenseAgreement: any = {};

    if (!endUserLicenseAgreement) {
      return null;
    }
    // Set
    filteredEndUserLicenseAgreement.text = endUserLicenseAgreement.text;
    return filteredEndUserLicenseAgreement;
  }
}
