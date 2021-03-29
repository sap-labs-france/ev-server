import { HttpUserAssignSitesRequest, HttpUserMobileTokenRequest, HttpUserRequest, HttpUserSitesRequest, HttpUsersRequest } from '../../../../../types/requests/HttpUserRequest';
import User, { UserRole } from '../../../../../types/User';

import Authorizations from '../../../../../authorization/Authorizations';
import UserNotifications from '../../../../../types/UserNotifications';
import UserToken from '../../../../../types/UserToken';
import Utils from '../../../../../utils/Utils';
import UtilsSecurity from './UtilsSecurity';
import sanitize from 'mongo-sanitize';

export default class UserSecurity {

  public static filterAssignSitesToUserRequest(request: any): HttpUserAssignSitesRequest {
    return {
      userID: sanitize(request.userID),
      siteIDs: request.siteIDs ? request.siteIDs.map(sanitize) : []
    };
  }

  public static filterDefaultTagCarRequestByUserID(request: any): string {
    return sanitize(request.UserID);
  }

  public static filterUserRequest(request: any): HttpUserRequest {
    const filteredRequest: HttpUserRequest = {
      ID: sanitize(request.ID)
    };
    UtilsSecurity.filterProject(request, filteredRequest);
    return filteredRequest;
  }

  public static filterUserByIDRequest(request: any): string {
    return sanitize(request.ID);
  }

  public static filterUserByIDsRequest(request: any): string[] {
    return request.usersIDs.map(sanitize);
  }

  public static filterUsersRequest(request: any): HttpUsersRequest {
    const filteredRequest = {} as HttpUsersRequest;
    if (Utils.objectHasProperty(request, 'Issuer')) {
      filteredRequest.Issuer = UtilsSecurity.filterBoolean(request.Issuer);
    }
    if (Utils.objectHasProperty(request, 'WithTag')) {
      filteredRequest.WithTag = UtilsSecurity.filterBoolean(request.WithTag);
    }
    if (Utils.objectHasProperty(request, 'Search')) {
      filteredRequest.Search = sanitize(request.Search);
    }
    if (Utils.objectHasProperty(request, 'SiteID')) {
      filteredRequest.SiteID = sanitize(request.SiteID);
    }
    if (Utils.objectHasProperty(request, 'UserID')) {
      filteredRequest.UserID = sanitize(request.UserID);
    }
    if (Utils.objectHasProperty(request, 'Role')) {
      filteredRequest.Role = sanitize(request.Role);
    }
    if (Utils.objectHasProperty(request, 'Status')) {
      filteredRequest.Status = sanitize(request.Status);
    }
    if (Utils.objectHasProperty(request, 'ErrorType')) {
      filteredRequest.ErrorType = sanitize(request.ErrorType);
    }
    if (Utils.objectHasProperty(request, 'ExcludeSiteID')) {
      filteredRequest.ExcludeSiteID = sanitize(request.ExcludeSiteID);
    }
    if (Utils.objectHasProperty(request, 'TagID')) {
      filteredRequest.TagID = sanitize(request.TagID);
    }
    if (Utils.objectHasProperty(request, 'ExcludeUserIDs')) {
      filteredRequest.ExcludeUserIDs = sanitize(request.ExcludeUserIDs);
    }
    if (Utils.objectHasProperty(request, 'IncludeCarUserIDs')) {
      filteredRequest.IncludeCarUserIDs = sanitize(request.IncludeCarUserIDs);
    }
    if (Utils.objectHasProperty(request, 'NotAssignedToCarID')) {
      filteredRequest.NotAssignedToCarID = sanitize(request.NotAssignedToCarID);
    }
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    UtilsSecurity.filterProject(request, filteredRequest);
    return filteredRequest;
  }

  public static filterUserSitesRequest(request: any): HttpUserSitesRequest {
    const filteredRequest = {} as HttpUserSitesRequest;
    filteredRequest.UserID = sanitize(request.UserID);
    filteredRequest.Search = sanitize(request.Search);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    UtilsSecurity.filterProject(request, filteredRequest);
    return filteredRequest;
  }

  public static filterUserUpdateRequest(request: any, loggedUser: UserToken): Partial<User> {
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

  public static filterUserCreateRequest(request: any, loggedUser: UserToken): Partial<User> {
    return UserSecurity._filterUserRequest(request, loggedUser);
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
      sendOicpPatchStatusError: false,
      sendSmtpError: false,
      sendOfflineChargingStations: false,
      sendEndUserErrorNotification: false,
      sendComputeAndApplyChargingProfilesFailed: false,
      sendAccountVerificationNotification: notifications ? Utils.convertToBoolean(notifications.sendAccountVerificationNotification) : false,
      sendAdminAccountVerificationNotification: false,
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
        sendOicpPatchStatusError: notifications ? UtilsSecurity.filterBoolean(notifications.sendOicpPatchStatusError) : false,
        sendSmtpError: notifications ? UtilsSecurity.filterBoolean(notifications.sendSmtpError) : false,
        sendOfflineChargingStations: notifications ? UtilsSecurity.filterBoolean(notifications.sendOfflineChargingStations) : false,
        sendEndUserErrorNotification: notifications ? UtilsSecurity.filterBoolean(notifications.sendEndUserErrorNotification) : false,
        sendComputeAndApplyChargingProfilesFailed: notifications ? UtilsSecurity.filterBoolean(notifications.sendComputeAndApplyChargingProfilesFailed) : false,
        sendAdminAccountVerificationNotification: notifications ? Utils.convertToBoolean(notifications.sendAdminAccountVerificationNotification) : false,
      };
    }
    return filteredNotifications;
  }

  private static _filterUserRequest(request: any, loggedUser: UserToken): Partial<User> {
    const filteredRequest: Partial<User> = {};
    if (Utils.objectHasProperty(request, 'costCenter')) {
      filteredRequest.costCenter = sanitize(request.costCenter);
    }
    if (Utils.objectHasProperty(request, 'firstName')) {
      filteredRequest.firstName = sanitize(request.firstName);
    }
    if (Utils.objectHasProperty(request, 'iNumber')) {
      filteredRequest.iNumber = sanitize(request.iNumber);
    }
    if (Utils.objectHasProperty(request, 'image')) {
      filteredRequest.image = sanitize(request.image);
    }
    if (Utils.objectHasProperty(request, 'mobile')) {
      filteredRequest.mobile = sanitize(request.mobile);
    }
    if (Utils.objectHasProperty(request, 'name')) {
      filteredRequest.name = sanitize(request.name);
    }
    if (Utils.objectHasProperty(request, 'locale')) {
      filteredRequest.locale = sanitize(request.locale);
    }
    if (Utils.objectHasProperty(request, 'address')) {
      filteredRequest.address = UtilsSecurity.filterAddressRequest(request.address);
    }
    if (Utils.objectHasProperty(request, 'passwords') && request.passwords.password && request.passwords.password.length > 0) {
      filteredRequest.password = sanitize(request.passwords.password);
    }
    if (Utils.objectHasProperty(request, 'phone')) {
      filteredRequest.phone = sanitize(request.phone);
    }
    if (Utils.objectHasProperty(request, 'email')) {
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
      if (Utils.objectHasProperty(request, 'status')) {
        filteredRequest.status = sanitize(request.status);
      }
      if (Utils.objectHasProperty(request, 'plateID')) {
        filteredRequest.plateID = sanitize(request.plateID);
      }
      if (Utils.objectHasProperty(request, 'role')) {
        filteredRequest.role = sanitize(request.role);
      }
    }
    if (Utils.objectHasProperty(request, 'notifications')) {
      filteredRequest.notifications = UserSecurity.filterNotificationsRequest(request.role, request.notifications);
    }
    return filteredRequest;
  }
}
