import sanitize from 'mongo-sanitize';
import Constants from '../../../../utils/Constants';
import UtilsSecurity from './UtilsSecurity';
import { HttpIsAuthorizedRequest, HttpLoginRequest, HttpResetPasswordRequest, HttpRegisterUserRequest, HttpVerifyEmailRequest, HttpResendVerificationMailRequest } from '../../../../types/requests/HttpUserRequest';
import { Request } from 'express';

export default class AuthSecurity {
  
  public static filterIsAuthorizedRequest(request: Partial<HttpIsAuthorizedRequest>): HttpIsAuthorizedRequest {
    let filteredRequest: HttpIsAuthorizedRequest = {
      Action: sanitize(request.Action),
      Arg1: sanitize(request.Arg1),
      Arg2: sanitize(request.Arg2),
      Arg3: sanitize(request.Arg3)
    };
    if (filteredRequest.Action === 'StopTransaction') {
      filteredRequest.Action = 'RemoteStopTransaction';
    }
    return filteredRequest;
  }

  public static filterResetPasswordRequest(request: Partial<HttpResetPasswordRequest>): Partial<HttpResetPasswordRequest> {
    const filteredRequest: any = {};
    // Set
    filteredRequest.email = sanitize(request.email);
    filteredRequest.tenant = sanitize(request.tenant);
    filteredRequest.captcha = sanitize(request.captcha);
    filteredRequest.hash = sanitize(request.hash);
    return filteredRequest;
  }

  public static filterRegisterUserRequest(request: Partial<HttpRegisterUserRequest>): Partial<HttpRegisterUserRequest> {
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

  public static filterLoginRequest(request: Partial<HttpLoginRequest>): Partial<HttpLoginRequest> {
    return {
      email: sanitize(request.email),
      password: sanitize(request.password),
      tenant: sanitize(request.tenant),
      acceptEula: UtilsSecurity.filterBoolean(request.acceptEula)
    };
  }

  public static filterVerifyEmailRequest(request: Partial<HttpVerifyEmailRequest>): Partial<HttpVerifyEmailRequest> {
    return {
      Email: sanitize(request.Email),
      tenant: sanitize(request.tenant),
      VerificationToken: sanitize(request.VerificationToken)
    };
  }

  public static filterResendVerificationEmail(request: Partial<HttpResendVerificationMailRequest>): Partial<HttpResendVerificationMailRequest> {
    return {
      email: sanitize(request.email),
      tenant: sanitize(request.tenant),
      captcha: sanitize(request.captcha)
    };
  }

  public static filterEndUserLicenseAgreementRequest(request: Request): {Language: string, tenant: string} {
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

