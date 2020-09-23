import { HttpSitesAssignUserRequest, HttpTagsRequest, HttpUserMobileTokenRequest, HttpUserRequest, HttpUserSitesRequest, HttpUsersRequest } from '../../../../types/requests/HttpUserRequest';
import User, { UserRole } from '../../../../types/User';

import Authorizations from '../../../../authorization/Authorizations';
import Constants from '../../../../utils/Constants';
import { DataResult } from '../../../../types/DataResult';
import Tag from '../../../../types/Tag';
import { UserInError } from '../../../../types/InError';
import UserNotifications from '../../../../types/UserNotifications';
import UserToken from '../../../../types/UserToken';
import Utils from '../../../../utils/Utils';
import UtilsSecurity from './UtilsSecurity';
import sanitize from 'mongo-sanitize';

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
    if (request.Issuer) {
      request.Issuer = UtilsSecurity.filterBoolean(request.Issuer);
    }
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
    if (request.TagID) {
      request.TagID = sanitize(request.TagID);
    }
    if (request.ExcludeUserIDs) {
      request.ExcludeUserIDs = sanitize(request.ExcludeUserIDs);
    }
    if (request.IncludeUserIDs) {
      request.IncludeUserIDs = sanitize(request.IncludeUserIDs);
    }
    if (request.NotAssignedToCarID) {
      request.NotAssignedToCarID = sanitize(request.NotAssignedToCarID);
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
    const filteredRequest = UserSecurity.filterUserRequest(request, loggedUser);
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
    return UserSecurity.filterUserRequest(request, loggedUser);
  }

  public static filterTagsRequest(request: any): HttpTagsRequest {
    const filteredRequest: HttpTagsRequest = {
      Search: sanitize(request.Search),
      UserID: sanitize(request.UserID),
      Issuer: Utils.objectHasProperty(request, 'Issuer') ? UtilsSecurity.filterBoolean(request.Issuer) : null
    } as HttpTagsRequest;
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
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
        filteredUser.issuer = user.issuer;
        filteredUser.name = user.name;
        filteredUser.firstName = user.firstName;
        filteredUser.email = user.email;
        filteredUser.locale = user.locale;
        filteredUser.phone = user.phone;
        filteredUser.mobile = user.mobile;
        filteredUser.notificationsActive = user.notificationsActive;
        if (user.notifications) {
          filteredUser.notifications = UserSecurity.filterNotificationsRequest(user.role, user.notifications);
        }
        filteredUser.iNumber = user.iNumber;
        filteredUser.costCenter = user.costCenter;
        filteredUser.status = user.status;
        filteredUser.eulaAcceptedOn = user.eulaAcceptedOn;
        filteredUser.eulaAcceptedVersion = user.eulaAcceptedVersion;
        filteredUser.plateID = user.plateID;
        filteredUser.role = user.role;
        if (Utils.objectHasProperty(user, 'errorCode')) {
          (filteredUser as UserInError).errorCode = (user as UserInError).errorCode;
        }
        if (user.address) {
          filteredUser.address = UtilsSecurity.filterAddressRequest(user.address);
        }
        if (user.billingData) {
          filteredUser.billingData = user.billingData;
        }
      } else {
        // Set only necessary info
        // Demo user?
        if (Authorizations.isDemo(loggedUser)) {
          filteredUser.id = null;
          filteredUser.name = Constants.ANONYMIZED_VALUE;
          filteredUser.firstName = Constants.ANONYMIZED_VALUE;
        } else {
          filteredUser.id = user.id;
          filteredUser.name = user.name;
          filteredUser.firstName = user.firstName;
        }
        filteredUser.issuer = user.issuer;
        filteredUser.email = user.email;
        filteredUser.locale = user.locale;
        filteredUser.phone = user.phone;
        filteredUser.mobile = user.mobile;
        filteredUser.notificationsActive = user.notificationsActive;
        if (user.notifications) {
          filteredUser.notifications = UserSecurity.filterNotificationsRequest(user.role, user.notifications);
        }
        filteredUser.iNumber = user.iNumber;
        filteredUser.costCenter = user.costCenter;
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
      UtilsSecurity.filterCreatedAndLastChanged(filteredUser, user, loggedUser);
    }
    return filteredUser;
  }

  // User
  static filterMinimalUserResponse(user: User, loggedUser: UserToken): User {
    const filteredUser = {} as User;
    if (!user) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadUser(loggedUser, user.id)) {
      // Demo user?
      if (Authorizations.isDemo(loggedUser)) {
        filteredUser.id = null;
        filteredUser.name = Constants.ANONYMIZED_VALUE;
        filteredUser.firstName = Constants.ANONYMIZED_VALUE;
        filteredUser.email = Constants.ANONYMIZED_VALUE;
      } else {
        filteredUser.id = user.id;
        filteredUser.name = user.name;
        filteredUser.firstName = user.firstName;
        filteredUser.email = user.email;
      }
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

  static filterTagsResponse(tags: DataResult<Tag>, loggedUser: UserToken): void {
    const filteredTags = [];
    if (!tags.result) {
      return null;
    }
    if (!Authorizations.canListTags(loggedUser)) {
      return null;
    }
    for (const tag of tags.result) {
      // Filter
      const filteredTag = UserSecurity.filterTagResponse(tag, loggedUser);
      if (filteredTag) {
        filteredTags.push(filteredTag);
      }
    }
    tags.result = filteredTags;
  }

  public static filterTagUpdateRequest(request: any, loggedUser: UserToken): Partial<Tag> {
    return UserSecurity.filterTagRequest(request, loggedUser);
  }

  public static filterTagCreateRequest(request: any, loggedUser: UserToken): Partial<Tag> {
    return UserSecurity.filterTagRequest(request, loggedUser);
  }

  public static filterTagRequest(tag: Tag, loggedUser: UserToken): Tag {
    let filteredTag: Tag;
    if (tag) {
      filteredTag = {
        id: sanitize(tag.id),
        description: sanitize(tag.description),
        active: UtilsSecurity.filterBoolean(tag.active),
        issuer: UtilsSecurity.filterBoolean(tag.issuer),
        userID: sanitize(tag.userID)
      } as Tag;
    }
    return filteredTag;
  }

  static filterTagResponse(tag: Tag, loggedUser: UserToken): Tag {
    const filteredTag = {} as Tag;
    if (!tag) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadTag(loggedUser)) {
      filteredTag.id = tag.id;
      filteredTag.issuer = tag.issuer;
      filteredTag.description = tag.description;
      filteredTag.active = tag.active;
      filteredTag.transactionsCount = tag.transactionsCount;
      filteredTag.userID = tag.userID;
      if (tag.user) {
        filteredTag.user = UserSecurity.filterMinimalUserResponse(tag.user, loggedUser);
      }
      // Created By / Last Changed By
      if (Authorizations.canUpdateTag(loggedUser)) {
        UtilsSecurity.filterCreatedAndLastChanged(filteredTag, tag, loggedUser);
      }
    }
    return filteredTag;
  }

  static filterNotificationsRequest(role: UserRole, notifications: UserNotifications): UserNotifications {
    // All Users
    let filteredNotifications: UserNotifications = {
      sendSessionStarted: notifications ? UtilsSecurity.filterBoolean(notifications.sendSessionStarted) : false,
      sendOptimalChargeReached: notifications ? UtilsSecurity.filterBoolean(notifications.sendOptimalChargeReached) : false,
      sendEndOfCharge: notifications ? UtilsSecurity.filterBoolean(notifications.sendEndOfCharge) : false,
      sendEndOfSession: notifications ? UtilsSecurity.filterBoolean(notifications.sendEndOfSession) : false,
      sendUserAccountStatusChanged: notifications ? UtilsSecurity.filterBoolean(notifications.sendUserAccountStatusChanged) : false,
      sendSessionNotStarted: notifications ? UtilsSecurity.filterBoolean(notifications.sendSessionNotStarted) : false,
      sendCarCatalogSynchronizationFailed: notifications ? UtilsSecurity.filterBoolean(notifications.sendCarCatalogSynchronizationFailed) : false,
      sendUserAccountInactivity: notifications ? UtilsSecurity.filterBoolean(notifications.sendUserAccountInactivity) : false,
      sendPreparingSessionNotStarted: notifications ? UtilsSecurity.filterBoolean(notifications.sendPreparingSessionNotStarted) : false,
      sendBillingSynchronizationFailed: notifications ? UtilsSecurity.filterBoolean(notifications.sendBillingSynchronizationFailed) : false,
      sendNewRegisteredUser: false,
      sendUnknownUserBadged: false,
      sendChargingStationStatusError: false,
      sendChargingStationRegistered: false,
      sendOcpiPatchStatusError: false,
      sendSmtpAuthError: false,
      sendOfflineChargingStations: false,
      sendEndUserErrorNotification: false,
    };
    // Admin Notif only
    if (role === UserRole.ADMIN) {
      filteredNotifications = {
        ...filteredNotifications,
        sendBillingSynchronizationFailed: notifications ? UtilsSecurity.filterBoolean(notifications.sendBillingSynchronizationFailed) : false,
        sendNewRegisteredUser: notifications ? UtilsSecurity.filterBoolean(notifications.sendNewRegisteredUser) : false,
        sendUnknownUserBadged: notifications ? UtilsSecurity.filterBoolean(notifications.sendUnknownUserBadged) : false,
        sendChargingStationStatusError: notifications ? UtilsSecurity.filterBoolean(notifications.sendChargingStationStatusError) : false,
        sendChargingStationRegistered: notifications ? UtilsSecurity.filterBoolean(notifications.sendChargingStationRegistered) : false,
        sendOcpiPatchStatusError: notifications ? UtilsSecurity.filterBoolean(notifications.sendOcpiPatchStatusError) : false,
        sendSmtpAuthError: notifications ? UtilsSecurity.filterBoolean(notifications.sendSmtpAuthError) : false,
        sendOfflineChargingStations: notifications ? UtilsSecurity.filterBoolean(notifications.sendOfflineChargingStations) : false,
        sendEndUserErrorNotification: notifications ? UtilsSecurity.filterBoolean(notifications.sendEndUserErrorNotification) : false,
      };
    }
    return filteredNotifications;
  }

  public static filterTagRequestByID(request: any): string {
    return sanitize(request.ID);
  }

  private static filterUserRequest(request: any, loggedUser: UserToken): Partial<HttpUserRequest> {
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
    if (Utils.objectHasProperty(request, 'issuer')) {
      filteredRequest.issuer = UtilsSecurity.filterBoolean(request.issuer);
    }
    if (Utils.objectHasProperty(request, 'notificationsActive')) {
      filteredRequest.notificationsActive = sanitize(request.notificationsActive);
    }
    // Admin?
    if (Authorizations.isAdmin(loggedUser) || Authorizations.isSuperAdmin(loggedUser)) {
      // Ok to set the sensitive data
      if (request.status) {
        filteredRequest.status = sanitize(request.status);
      }
      if (request.plateID) {
        filteredRequest.plateID = sanitize(request.plateID);
      }
      if (request.role) {
        filteredRequest.role = sanitize(request.role);
      }
    }
    if (request.notifications) {
      filteredRequest.notifications = UserSecurity.filterNotificationsRequest(request.role, request.notifications);
    }
    return filteredRequest;
  }
}
