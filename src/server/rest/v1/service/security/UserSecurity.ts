import { HttpSitesAssignUserRequest, HttpTagsRequest, HttpUserMobileTokenRequest, HttpUserRequest, HttpUserSitesRequest, HttpUsersRequest } from '../../../../../types/requests/HttpUserRequest';

import Authorizations from '../../../../../authorization/Authorizations';
import Tag from '../../../../../types/Tag';
import UserNotifications from '../../../../../types/UserNotifications';
import { UserRole } from '../../../../../types/User';
import UserToken from '../../../../../types/UserToken';
import Utils from '../../../../../utils/Utils';
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
    const filteredRequest = {} as HttpUsersRequest;
    if (request.Issuer) {
      filteredRequest.Issuer = UtilsSecurity.filterBoolean(request.Issuer);
    }
    if (request.WithTag) {
      filteredRequest.WithTag = UtilsSecurity.filterBoolean(request.WithTag);
    }
    if (request.Search) {
      filteredRequest.Search = sanitize(request.Search);
    }
    if (request.SiteID) {
      filteredRequest.SiteID = sanitize(request.SiteID);
    }
    if (request.Role) {
      filteredRequest.Role = sanitize(request.Role);
    }
    if (request.Status) {
      filteredRequest.Status = sanitize(request.Status);
    }
    if (request.ErrorType) {
      filteredRequest.ErrorType = sanitize(request.ErrorType);
    }
    if (request.ExcludeSiteID) {
      filteredRequest.ExcludeSiteID = sanitize(request.ExcludeSiteID);
    }
    if (request.TagID) {
      filteredRequest.TagID = sanitize(request.TagID);
    }
    if (request.ExcludeUserIDs) {
      filteredRequest.ExcludeUserIDs = sanitize(request.ExcludeUserIDs);
    }
    if (request.IncludeCarUserIDs) {
      filteredRequest.IncludeCarUserIDs = sanitize(request.IncludeCarUserIDs);
    }
    if (request.NotAssignedToCarID) {
      filteredRequest.NotAssignedToCarID = sanitize(request.NotAssignedToCarID);
    }
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterUserSitesRequest(request: any): HttpUserSitesRequest {
    const filteredRequest = {} as HttpUserSitesRequest;
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
    const filteredRequest = {
      Search: sanitize(request.Search),
      UserID: sanitize(request.UserID),
      Issuer: Utils.objectHasProperty(request, 'Issuer') ? UtilsSecurity.filterBoolean(request.Issuer) : null
    } as HttpTagsRequest;
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
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
        default: UtilsSecurity.filterBoolean(tag.default),
        userID: sanitize(tag.userID)
      } as Tag;
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
      sendBillingNewInvoice: notifications ? UtilsSecurity.filterBoolean(notifications.sendBillingNewInvoice) : false,
      sendNewRegisteredUser: false,
      sendUnknownUserBadged: false,
      sendChargingStationStatusError: false,
      sendChargingStationRegistered: false,
      sendOcpiPatchStatusError: false,
      sendSmtpAuthError: false,
      sendOfflineChargingStations: false,
      sendEndUserErrorNotification: false,
      sendComputeAndApplyChargingProfilesFailed: false,
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
        sendComputeAndApplyChargingProfilesFailed: notifications ? UtilsSecurity.filterBoolean(notifications.sendComputeAndApplyChargingProfilesFailed) : false,
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
