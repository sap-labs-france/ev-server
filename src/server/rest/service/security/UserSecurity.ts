import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import UtilsSecurity from './UtilsSecurity';
import { HttpSitesAssignUserRequest, HttpUsersRequest, HttpUserRequest } from '../../../../types/requests/HttpUserRequest';
import HttpByIDRequest from '../../../../types/requests/HttpByIDRequest';
import User from '../../../../types/User';
import UserToken from '../../../../types/UserToken';

export default class UserSecurity {

  public static filterAssignSitesToUserRequest(request: Partial<HttpSitesAssignUserRequest>, loggedUser): HttpSitesAssignUserRequest {
    return {
      userID: sanitize(request.userID),
      siteIDs: request.siteIDs ? request.siteIDs.map(sid => sanitize(sid)) : []
    };
  }

  public static filterUserByIDRequest(request: Partial<HttpByIDRequest>): string {
    return sanitize(request.ID);
  }

  public static filterUsersRequest(request: Partial<HttpUsersRequest>, loggedUser): HttpUsersRequest {
    if(request.Search) {
      request.Search = sanitize(request.Search);
    }
    if(request.SiteID) {
      request.SiteID = sanitize(request.SiteID);
    }
    if(request.Role) {
      request.Role = sanitize(request.Role);
    }
    if(request.Status) {
      request.Status = sanitize(request.Status);
    }
    if(request.ExcludeSiteID) {
      request.ExcludeSiteID = sanitize(request.ExcludeSiteID);
    }
    UtilsSecurity.filterSkipAndLimit(request, request);
    UtilsSecurity.filterSort(request, request);
    return request as HttpUsersRequest;
  }

  public static filterUserUpdateRequest(request: Partial<HttpUserRequest>, loggedUser): Partial<HttpUserRequest> {
    const filteredRequest = UserSecurity._filterUserRequest(request, loggedUser);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  public static filterUserCreateRequest(request: Partial<HttpUserRequest>, loggedUser): Partial<HttpUserRequest> {
    return UserSecurity._filterUserRequest(request, loggedUser);
  }

  public static _filterUserRequest(request: Partial<HttpUserRequest>, loggedUser): Partial<HttpUserRequest> {
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
    // Admin?
    if (Authorizations.isAdmin(loggedUser.role) || Authorizations.isSuperAdmin(loggedUser.role)) {
      // Ok to set the sensitive data
      if (request.notificationsActive) {
        filteredRequest.notificationsActive = sanitize(request.notificationsActive);
      }
      if (request.email) {
        filteredRequest.email = sanitize(request.email);
      }
      if (request.status) {
        filteredRequest.status = sanitize(request.status);
      }
      if (request.tagIDs) {
        filteredRequest.tagIDs = sanitize(request.tagIDs);
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
  static filterUserResponse(user: User, loggedUser: UserToken) {
    const filteredUser: any = {};
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
        filteredUser.iNumber = user.iNumber;
        filteredUser.costCenter = user.costCenter;
        filteredUser.status = user.status;
        filteredUser.eulaAcceptedOn = user.eulaAcceptedOn;
        filteredUser.eulaAcceptedVersion = user.eulaAcceptedVersion;
        filteredUser.tagIDs = user.tagIDs;
        filteredUser.plateID = user.plateID;
        filteredUser.role = user.role;
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
        filteredUser.iNumber = user.iNumber;
        filteredUser.costCenter = user.costCenter;
        filteredUser.tagIDs = user.tagIDs;
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
  static filterMinimalUserResponse(user: User, loggedUser: UserToken) {
    let filteredUser: any = {};
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

  static filterUsersResponse(users, loggedUser: UserToken) {
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
}

