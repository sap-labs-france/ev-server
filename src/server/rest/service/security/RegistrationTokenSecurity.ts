import {
  HttpRegistrationTokenRequest, HttpRegistrationTokensRequest,
  HttpRegistrationTokensResponse
} from '../../../../types/requests/HttpRegistrationToken';
import sanitize from 'mongo-sanitize';
import UserToken from '../../../../types/UserToken';
import RegistrationToken from '../../../../types/RegistrationToken';
import Authorizations from '../../../../authorization/Authorizations';
import UtilsSecurity from './UtilsSecurity';
import HttpByIDRequest from '../../../../types/requests/HttpByIDRequest';

export default class RegistrationTokenSecurity {
  static filterRegistrationTokenCreateRequest(request: HttpRegistrationTokenRequest): HttpRegistrationTokenRequest {
    return {
      siteAreaID: sanitize(request.siteAreaID),
      expirationDate: sanitize(request.expirationDate)
    };
  }

  public static filterRegistrationTokenByIDRequest(request: Partial<HttpByIDRequest>): string {
    return sanitize(request.ID);
  }

  static filterRegistrationTokensRequest(request: HttpRegistrationTokensRequest): HttpRegistrationTokensRequest {
    const filteredRequest = {
      siteAreaID: sanitize(request.siteAreaID)
    };

    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest as HttpRegistrationTokensRequest;
  }

  static filterRegistrationTokensResponse(registrationTokens: HttpRegistrationTokensResponse, loggedUser: UserToken): HttpRegistrationTokensResponse {
    const filteredTokens = [];
    if (!registrationTokens.result) {
      return null;
    }
    for (const registrationToken of registrationTokens.result) {
      // Filter
      const filteredToken = RegistrationTokenSecurity.filterRegistrationTokenResponse(registrationToken, loggedUser);
      if (filteredToken) {
        filteredTokens.push(filteredToken);
      }
    }
    registrationTokens.result = filteredTokens;
    return registrationTokens;
  }

  static filterRegistrationTokenResponse(registrationToken: RegistrationToken, loggedUser: UserToken): RegistrationToken {
    if (registrationToken || Authorizations.canReadRegistrationToken(loggedUser,
      registrationToken.siteArea ? registrationToken.siteArea.siteID : null)) {
      return registrationToken;
    }
    return null;
  }
}
