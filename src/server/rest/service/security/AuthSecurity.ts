import sanitize from 'mongo-sanitize';
import Constants from '../../../../utils/Constants';
import UtilsSecurity from './UtilsSecurity';

export default class AuthSecurity {
  // eslint-disable-next-line no-unused-vars
  static filterIsAuthorizedRequest(request, loggedUser?) {
    const filteredRequest: any = {};
    // Set
    filteredRequest.Action = sanitize(request.Action);
    // TODO: To Remove
    // Hack for mobile app not sending the RemoteStopTransaction yet
    if (filteredRequest.Action === 'StopTransaction') {
      filteredRequest.Action = 'RemoteStopTransaction';
    }
    filteredRequest.Arg1 = sanitize(request.Arg1);
    filteredRequest.Arg2 = sanitize(request.Arg2);
    filteredRequest.Arg3 = sanitize(request.Arg3);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterResetPasswordRequest(request, loggedUser?) {
    const filteredRequest: any = {};
    // Set
    filteredRequest.email = sanitize(request.email);
    filteredRequest.tenant = sanitize(request.tenant);
    filteredRequest.captcha = sanitize(request.captcha);
    filteredRequest.hash = sanitize(request.hash);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterRegisterUserRequest(request, loggedUser?) {
    const filteredRequest: any = {};
    // Set
    filteredRequest.name = sanitize(request.name);
    filteredRequest.tenant = sanitize(request.tenant);
    filteredRequest.firstName = sanitize(request.firstName);
    filteredRequest.email = sanitize(request.email);
    filteredRequest.password = sanitize(request.passwords.password);
    filteredRequest.captcha = sanitize(request.captcha);
    filteredRequest.acceptEula = UtilsSecurity.filterBoolean(request.acceptEula);
    filteredRequest.status = Constants.USER_STATUS_PENDING;
    return filteredRequest;
  }

  static filterLoginRequest(request) {
    const filteredRequest: any = {};
    // Set
    filteredRequest.email = sanitize(request.email);
    filteredRequest.password = sanitize(request.password);
    filteredRequest.tenant = sanitize(request.tenant);
    filteredRequest.acceptEula = UtilsSecurity.filterBoolean(request.acceptEula);
    return filteredRequest;
  }

  static filterVerifyEmailRequest(request) {
    const filteredRequest: any = {};
    // Set
    filteredRequest.Email = sanitize(request.Email);
    filteredRequest.tenant = sanitize(request.tenant);
    filteredRequest.VerificationToken = sanitize(request.VerificationToken);
    return filteredRequest;
  }

  static filterResendVerificationEmail(request) {
    const filteredRequest: any = {};
    // Set
    filteredRequest.email = sanitize(request.email);
    filteredRequest.tenant = sanitize(request.tenant);
    filteredRequest.captcha = sanitize(request.captcha);
    return filteredRequest;
  }

  static filterEndUserLicenseAgreementRequest(request) {
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

