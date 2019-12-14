import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import { HttpSitesAssignUserRequest, HttpUserMobileTokenRequest, HttpUserRequest, HttpUserSitesRequest, HttpUsersRequest } from '../../../../types/requests/HttpUserRequest';
import User from '../../../../types/User';
import UserToken from '../../../../types/UserToken';
import UtilsSecurity from './UtilsSecurity';
import { DataResult } from '../../../../types/DataResult';
import UserNotifications from '../../../../types/UserNotifications';
import Tag from '../../../../types/Tag';

export default class UserSecurity {

  public static filterAssignSitesToUserRequest(request: any): HttpSitesAssignUserRequest {
    return {
      userID: sanitize(request.userID),
      siteIDs: request.siteIDs ? request.siteIDs.map(sanitize) : []
    };
  }

  public static filterUserByIDRequest(request: any): string {
    return sanitize(request.ID);
  }

  public static filterUsersRequest(request: any): HttpUsersRequest {
    if (request.Search) {
      request.Search = sanitize(request.Search);
    }
    if (request.SiteID) {
      request.SiteID = sanitize(request.SiteID);
    }
    if (request.Role) {
      request.Role = sanitize(request.Role);
    }
    if (request.Status) {
      request.Status = sanitize(request.Status);
    }
    if (request.ErrorType) {
      request.ErrorType = sanitize(request.ErrorType);
    }
    if (request.ExcludeSiteID) {
      request.ExcludeSiteID = sanitize(request.ExcludeSiteID);
    }
    UtilsSecurity.filterSkipAndLimit(request, request);
    UtilsSecurity.filterSort(request, request);
    return request as HttpUsersRequest;
  }

  public static filterUserSitesRequest(request: any): HttpUserSitesRequest {
    const filteredRequest: HttpUserSitesRequest = {} as HttpUserSitesRequest;
    filteredRequest.UserID = sanitize(request.UserID);
    filteredRequest.Search = sanitize(request.Search);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterUserUpdateRequest(request: any, loggedUser: UserToken): Partial<HttpUserRequest> {
    const filteredRequest = UserSecurity._filterUserRequest(request, loggedUser);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  public static filterUserUpdateMobileTokenRequest(request: any): Partial<HttpUserMobileTokenRequest> {
    return {
      id: sanitize(request.id),
      mobileToken: sanitize(request.mobileToken),
      mobileOS: sanitize(request.mobileOS)
    };
  }

  public static filterUserCreateRequest(request: any, loggedUser: UserToken): Partial<HttpUserRequest> {
    return UserSecurity._filterUserRequest(request, loggedUser);
  }

  public static _filterUserRequest(request: any, loggedUser: UserToken): Partial<HttpUserRequest> {
    const filteredRequest: Partial<HttpUserRequest> = {};
    if (request.costCenter) {
      filteredRequest.costCenter = sanitize(request.costCenter);
    }
    if (request.firstName) {
      filteredRequest.firstName = sanitize(request.firstName);
    }
    if (request.iNumber) {
      filteredRequest.iNumber = sanitize(request.iNumber);
    }
    if (request.image) {
      filteredRequest.image = sanitize(request.image);
    }
    if (request.mobile) {
      filteredRequest.mobile = sanitize(request.mobile);
    }
    if (request.name) {
      filteredRequest.name = sanitize(request.name);
    }
    if (request.locale) {
      filteredRequest.locale = sanitize(request.locale);
    }
    if (request.address) {
      filteredRequest.address = UtilsSecurity.filterAddressRequest(request.address);
    }
    if (request.passwords && request.passwords.password && request.passwords.password.length > 0) {
      filteredRequest.password = sanitize(request.passwords.password);
    }
    if (request.phone) {
      filteredRequest.phone = sanitize(request.phone);
    }
    if (request.email) {
      filteredRequest.email = sanitize(request.email);
    }
    if (request.hasOwnProperty('notificationsActive')) {
      filteredRequest.notificationsActive = sanitize(request.notificationsActive);
    }
    if (request.notifications) {
      filteredRequest.notifications = UserSecurity.filterNotificationsRequest(request.notifications);
    }
    // Admin?
    if (Authorizations.isAdmin(loggedUser) || Authorizations.isSuperAdmin(loggedUser)) {
      // Ok to set the sensitive data
      if (request.status) {
        filteredRequest.status = sanitize(request.status);
      }
      if (request.tags) {
        filteredRequest.tags = [];
        for (const tag of request.tags) {
          // Filter
          const filteredTag = UserSecurity.filterTagRequest(tag);
          if (filteredTag) {
            filteredRequest.tags.push(filteredTag);
          }
        }
      }
      if (request.plateID) {
        filteredRequest.plateID = sanitize(request.plateID);
      }
      if (request.role) {
        filteredRequest.role = sanitize(request.role);
      }
    }
    return filteredRequest;
  }

  // User
  static filterUserResponse(user: User, loggedUser: UserToken): User {
    const filteredUser: User = {} as User;
    if (!user) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadUser(loggedUser, user.id)) {
      // Admin?
      if (Authorizations.canUpdateUser(loggedUser, user.id)) {
        filteredUser.id = user.id;
        filteredUser.name = user.name;
        filteredUser.firstName = user.firstName;
        filteredUser.email = user.email;
        filteredUser.locale = user.locale;
        filteredUser.phone = user.phone;
        filteredUser.mobile = user.mobile;
        filteredUser.notificationsActive = user.notificationsActive;
        if (user.notifications) {
          filteredUser.notifications = UserSecurity.filterNotificationsRequest(user.notifications);
        }
        filteredUser.iNumber = user.iNumber;
        filteredUser.costCenter = user.costCenter;
        filteredUser.status = user.status;
        filteredUser.eulaAcceptedOn = user.eulaAcceptedOn;
        filteredUser.eulaAcceptedVersion = user.eulaAcceptedVersion;
        filteredUser.tags = user.tags;
        filteredUser.plateID = user.plateID;
        filteredUser.role = user.role;
        filteredUser.errorCode = user.errorCode;
        if (user.address) {
          filteredUser.address = UtilsSecurity.filterAddressRequest(user.address);
        }
      } else {
        // Set only necessary info
        filteredUser.id = user.id;
        filteredUser.name = user.name;
        filteredUser.firstName = user.firstName;
        filteredUser.email = user.email;
        filteredUser.locale = user.locale;
        filteredUser.phone = user.phone;
        filteredUser.mobile = user.mobile;
        filteredUser.notificationsActive = user.notificationsActive;
        if (user.notifications) {
          filteredUser.notifications = UserSecurity.filterNotificationsRequest(user.notifications);
        }
        filteredUser.iNumber = user.iNumber;
        filteredUser.costCenter = user.costCenter;
        filteredUser.tags = user.tags;
        filteredUser.plateID = user.plateID;
        filteredUser.role = user.role;
        filteredUser.errorCode = user.errorCode;
        if (user.address) {
          filteredUser.address = UtilsSecurity.filterAddressRequest(user.address);
        }
      }
      // Created By / Last Changed By
      UtilsSecurity.filterCreatedAndLastChanged(
        filteredUser, user, loggedUser);
    }
    return filteredUser;
  }

  // User
  static filterMinimalUserResponse(user: User, loggedUser: UserToken): void {
    const filteredUser: any = {};
    if (!user) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadUser(loggedUser, user.id)) {
      filteredUser.id = user.id;
      filteredUser.name = user.name;
      filteredUser.firstName = user.firstName;
    }
    return filteredUser;
  }

  static filterUsersResponse(users: DataResult<User>, loggedUser: UserToken): void {
    const filteredUsers = [];
    if (!users.result) {
      return null;
    }
    for (const user of users.result) {
      // Filter
      const filteredUser = UserSecurity.filterUserResponse(user, loggedUser);
      if (filteredUser) {
        filteredUsers.push(filteredUser);
      }
    }
    users.result = filteredUsers;
  }

  static filterTagRequest(tag: Tag): Tag {
    let filteredTag: Tag;
    if (tag) {
      filteredTag = {
        id: sanitize(tag.id),
        issuer: UtilsSecurity.filterBoolean(tag.issuer),
        description: sanitize(tag.description),
        deleted: false
      };
    }
    return filteredTag;
  }

  static filterNotificationsRequest(notifications): UserNotifications {
    const filtered: any = {};
    if (notifications) {
      filtered.sendSessionStarted = UtilsSecurity.filterBoolean(notifications.sendSessionStarted);
      filtered.sendOptimalChargeReached = UtilsSecurity.filterBoolean(notifications.sendOptimalChargeReached);
      filtered.sendEndOfCharge = UtilsSecurity.filterBoolean(notifications.sendEndOfCharge);
      filtered.sendEndOfSession = UtilsSecurity.filterBoolean(notifications.sendEndOfSession);
      filtered.sendUserAccountStatusChanged = UtilsSecurity.filterBoolean(notifications.sendUserAccountStatusChanged);
      filtered.sendNewRegisteredUser = UtilsSecurity.filterBoolean(notifications.sendNewRegisteredUser);
      filtered.sendUnknownUserBadged = UtilsSecurity.filterBoolean(notifications.sendUnknownUserBadged);
      filtered.sendChargingStationStatusError = UtilsSecurity.filterBoolean(notifications.sendChargingStationStatusError);
      filtered.sendChargingStationRegistered = UtilsSecurity.filterBoolean(notifications.sendChargingStationRegistered);
      filtered.sendOcpiPatchStatusError = UtilsSecurity.filterBoolean(notifications.sendOcpiPatchStatusError);
      filtered.sendSmtpAuthError = UtilsSecurity.filterBoolean(notifications.sendSmtpAuthError);
      filtered.sendOfflineChargingStations = UtilsSecurity.filterBoolean(notifications.sendOfflineChargingStations);
      filtered.sendPreparingSessionNotStarted = UtilsSecurity.filterBoolean(notifications.sendPreparingSessionNotStarted);
    }
    return filtered;
  }
}
