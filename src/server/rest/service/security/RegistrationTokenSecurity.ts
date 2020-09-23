import Authorizations from '../../../../authorization/Authorizations';
import { DataResult } from '../../../../types/DataResult';
import { HttpRegistrationTokensRequest } from '../../../../types/requests/HttpRegistrationToken';
import RegistrationToken from '../../../../types/RegistrationToken';
import UserToken from '../../../../types/UserToken';
import UtilsSecurity from './UtilsSecurity';
import sanitize from 'mongo-sanitize';

export default class RegistrationTokenSecurity {
  public static filterRegistrationTokenCreateRequest(request: any): Partial<RegistrationToken> {
    return {
      description: sanitize(request.description),
      siteAreaID: sanitize(request.siteAreaID),
      expirationDate: sanitize(request.expirationDate)
    };
  }

  public static filterRegistrationTokenUpdateRequest(request: any): Partial<RegistrationToken> {
    return {
      id: sanitize(request.id),
      description: sanitize(request.description),
      siteAreaID: sanitize(request.siteAreaID),
      expirationDate: sanitize(request.expirationDate)
    };
  }

  public static filterRegistrationTokenRequest(request: any): Partial<RegistrationToken> {
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

  static filterRegistrationTokensResponse(registrationTokens: DataResult<RegistrationToken>, loggedUser: UserToken): void {
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
  }

  static filterRegistrationTokenResponse(registrationToken: RegistrationToken, loggedUser: UserToken): RegistrationToken {
    if (registrationToken || Authorizations.canReadRegistrationToken(loggedUser,
      registrationToken.siteArea ? registrationToken.siteArea.siteID : null)) {
      return registrationToken;
    }
    return null;
  }
}
