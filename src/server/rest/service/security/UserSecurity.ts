import { HttpSitesAssignUserRequest, HttpUserMobileTokenRequest, HttpUserRequest, HttpUserSitesRequest, HttpUsersRequest } from '../../../../types/requests/HttpUserRequest';
import Authorizations from '../../../../authorization/Authorizations';
import { DataResult } from '../../../../types/DataResult';
import Tag from '../../../../types/Tag';
import User from '../../../../types/User';
import UserNotifications from '../../../../types/UserNotifications';
import UserToken from '../../../../types/UserToken';
import UtilsSecurity from './UtilsSecurity';
import sanitize from 'mongo-sanitize';
import { UserInError } from '../../../../types/InError';
import Utils from "../../../../utils/Utils";

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
    if (Utils.objectHasProperty(request, 'notificationsActive')) {
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
  static filterUserResponse(user: User | UserInError, loggedUser: UserToken): User {
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
        if (Utils.objectHasProperty(user, 'errorCode')) {
          (filteredUser as UserInError).errorCode = (user as UserInError).errorCode;
        }
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
        if (Utils.objectHasProperty(user, 'errorCode')) {
          (filteredUser as UserInError).errorCode = (user as UserInError).errorCode;
        }
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

  static filterUsersResponse(users: DataResult<User | UserInError>, loggedUser: UserToken): void {
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

  static filterNotificationsRequest(notifications: UserNotifications): UserNotifications {
    return {
      sendSessionStarted: notifications ? UtilsSecurity.filterBoolean(notifications.sendSessionStarted) : false,
      sendOptimalChargeReached: notifications ? UtilsSecurity.filterBoolean(notifications.sendOptimalChargeReached) : false,
      sendEndOfCharge: notifications ? UtilsSecurity.filterBoolean(notifications.sendEndOfCharge) : false,
      sendEndOfSession: notifications ? UtilsSecurity.filterBoolean(notifications.sendEndOfSession) : false,
      sendUserAccountStatusChanged: notifications ? UtilsSecurity.filterBoolean(notifications.sendUserAccountStatusChanged) : false,
      sendNewRegisteredUser: notifications ? UtilsSecurity.filterBoolean(notifications.sendNewRegisteredUser) : false,
      sendUnknownUserBadged: notifications ? UtilsSecurity.filterBoolean(notifications.sendUnknownUserBadged) : false,
      sendChargingStationStatusError: notifications ? UtilsSecurity.filterBoolean(notifications.sendChargingStationStatusError) : false,
      sendChargingStationRegistered: notifications ? UtilsSecurity.filterBoolean(notifications.sendChargingStationRegistered) : false,
      sendOcpiPatchStatusError: notifications ? UtilsSecurity.filterBoolean(notifications.sendOcpiPatchStatusError) : false,
      sendSmtpAuthError: notifications ? UtilsSecurity.filterBoolean(notifications.sendSmtpAuthError) : false,
      sendOfflineChargingStations: notifications ? UtilsSecurity.filterBoolean(notifications.sendOfflineChargingStations) : false,
      sendPreparingSessionNotStarted: notifications ? UtilsSecurity.filterBoolean(notifications.sendPreparingSessionNotStarted) : false,
      sendUserAccountInactivity: notifications ? UtilsSecurity.filterBoolean(notifications.sendUserAccountInactivity) : false,
      sendBillingUserSynchronizationFailed: notifications ? UtilsSecurity.filterBoolean(notifications.sendBillingUserSynchronizationFailed) : false,
      sendSessionNotStarted: notifications ? UtilsSecurity.filterBoolean(notifications.sendSessionNotStarted) : false,
    };
  }
}
