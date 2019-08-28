import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import { HttpRegistrationTokenRequest, HttpRegistrationTokensRequest, HttpRegistrationTokensResponse } from '../../../../types/requests/HttpRegistrationToken';
import RegistrationToken from '../../../../types/RegistrationToken';
import UserToken from '../../../../types/UserToken';
import UtilsSecurity from './UtilsSecurity';

export default class RegistrationTokenSecurity {
  static filterRegistrationTokenCreateRequest(request: any): HttpRegistrationTokenRequest {
    return {
      description: sanitize(request.description),
      siteAreaID: sanitize(request.siteAreaID),
      expirationDate: sanitize(request.expirationDate)
    };
  }

  public static filterRegistrationTokenByIDRequest(request: any): string {
    return sanitize(request.ID);
  }

  static filterRegistrationTokensRequest(request: any): HttpRegistrationTokensRequest {
    const filteredRequest = {
      siteAreaID: sanitize(request.siteAreaID)
    };

    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest as HttpRegistrationTokensRequest;
  }

  static filterRegistrationTokensResponse(registrationTokens: any, loggedUser: UserToken): any {
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
