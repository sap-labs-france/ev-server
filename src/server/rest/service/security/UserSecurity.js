const sanitize = require('mongo-sanitize');
const Authorizations = require('../../../../authorization/Authorizations');
const UtilsSecurity = require('./UtilsSecurity');

class UserSecurity {
  // eslint-disable-next-line no-unused-vars
  static filterAddSitesToUserRequest(request, loggedUser) {
    const filteredRequest = {};
    // Set
    filteredRequest.userID = sanitize(request.userID);
    if (request.siteIDs) {
      filteredRequest.siteIDs = request.siteIDs.map(siteID => sanitize(siteID));
    }
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterRemoveSitesFromUserRequest(request, loggedUser) {
    const filteredRequest = {};
    // Set
    filteredRequest.userID = sanitize(request.userID);
    if (request.siteIDs) {
      filteredRequest.siteIDs = request.siteIDs.map(siteID => sanitize(siteID));
    }
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterUserDeleteRequest(request, loggedUser) {
    const filteredRequest = {};
    // Set
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterUserRequest(request, loggedUser) {
    const filteredRequest = {};
    // Set
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterUsersRequest(request, loggedUser) {
    const filteredRequest = {};
    // Handle picture
    filteredRequest.Search = sanitize(request.Search);
    filteredRequest.SiteID = sanitize(request.SiteID);
    filteredRequest.Role = sanitize(request.Role);
    filteredRequest.Status = sanitize(request.Status);
    filteredRequest.ExcludeSiteID = sanitize(request.ExcludeSiteID);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  static filterUserUpdateRequest(request, loggedUser) {
    // Set
    const filteredRequest = UserSecurity._filterUserRequest(request, loggedUser);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  static filterUserCreateRequest(request, loggedUser) {
    return UserSecurity._filterUserRequest(request, loggedUser);
  }

  static _filterUserRequest(request, loggedUser) {
    const filteredRequest = {};
    if (request.hasOwnProperty("costCenter")) {
      filteredRequest.costCenter = sanitize(request.costCenter);
    }
    if (request.hasOwnProperty("firstName")) {
      filteredRequest.firstName = sanitize(request.firstName);
    }
    if (request.hasOwnProperty("iNumber")) {
      filteredRequest.iNumber = sanitize(request.iNumber);
    }
    if (request.hasOwnProperty("image")) {
      filteredRequest.image = sanitize(request.image);
    }
    if (request.hasOwnProperty("mobile")) {
      filteredRequest.mobile = sanitize(request.mobile);
    }
    if (request.hasOwnProperty("name")) {
      filteredRequest.name = sanitize(request.name);
    }
    if (request.hasOwnProperty("locale")) {
      filteredRequest.locale = sanitize(request.locale);
    }
    if (request.hasOwnProperty("address")) {
      filteredRequest.address = UtilsSecurity.filterAddressRequest(request.address, loggedUser);
    }
    if (request.hasOwnProperty("passwords") && request.passwords.hasOwnProperty("password") && request.passwords.password.length > 0) {
      filteredRequest.password = sanitize(request.passwords.password);
    }
    if (request.hasOwnProperty("phone")) {
      filteredRequest.phone = sanitize(request.phone);
    }
    // Admin?
    if (Authorizations.isAdmin(loggedUser)) {
      // Ok to set the sensitive data
      if (request.hasOwnProperty("notificationsActive")) {
        filteredRequest.notificationsActive = sanitize(request.notificationsActive);
      }
      if (request.hasOwnProperty("email")) {
        filteredRequest.email = sanitize(request.email);
      }
      if (request.hasOwnProperty("status")) {
        filteredRequest.status = sanitize(request.status);
      }
      if (request.hasOwnProperty("tagIDs")) {
        filteredRequest.tagIDs = sanitize(request.tagIDs);
      }
      if (request.hasOwnProperty("plateID")) {
        filteredRequest.plateID = sanitize(request.plateID);
      }
      if (request.hasOwnProperty("role")) {
        filteredRequest.role = sanitize(request.role);
      }
    }
    // Admin?
    if (Authorizations.isSuperAdmin(loggedUser)) {
      // Ok to set the sensitive data
      if (request.hasOwnProperty("email")) {
        filteredRequest.email = sanitize(request.email);
      }
      if (request.hasOwnProperty("role")) {
        filteredRequest.role = sanitize(request.role);
      }
      if (request.hasOwnProperty("status")) {
        filteredRequest.status = sanitize(request.status);
      }
    }
    return filteredRequest;
  }

  // User
  static filterUserResponse(user, loggedUser) {
    const filteredUser={};

    if (!user) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadUser(loggedUser, user)) {
      // Admin?
      if (Authorizations.isAdmin(loggedUser) || Authorizations.isSuperAdmin(loggedUser)) {
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
          filteredUser.address = UtilsSecurity.filterAddressRequest(user.address, loggedUser);
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
          filteredUser.address = UtilsSecurity.filterAddressRequest(user.address, loggedUser);
        }
      }
      // Created By / Last Changed By
      UtilsSecurity.filterCreatedAndLastChanged(
        filteredUser, user, loggedUser);
    }
    return filteredUser;
  }

  // User
  static filterMinimalUserResponse(user, loggedUser) {
    const filteredUser={};

    if (!user) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadUser(loggedUser, user)) {
      // Admin?
      if (Authorizations.isAdmin(loggedUser)) {
        filteredUser.id = user.id;
        filteredUser.name = user.name;
        filteredUser.firstName = user.firstName;
      } else {
        // Set only necessary info
        filteredUser.id = user.id;
        filteredUser.name = user.name;
        filteredUser.firstName = user.firstName;
      }
    }
    return filteredUser;
  }

  static filterUsersResponse(users, loggedUser) {
    const filteredUsers = [];

    if (!users.result) {
      return null;
    }
    for (const user of users.result) {
      // Filter
      const filteredUser = UserSecurity.filterUserResponse(user, loggedUser);
      // Ok?
      if (filteredUser) {
        // Add
        filteredUsers.push(filteredUser);
      }
    }
    users.result = filteredUsers;
  }
}

module.exports = UserSecurity;
