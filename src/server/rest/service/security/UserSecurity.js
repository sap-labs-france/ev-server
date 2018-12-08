const sanitize = require('mongo-sanitize');
const Authorizations = require('../../../../authorization/Authorizations');
const UtilsSecurity = require('./UtilsSecurity');

class UserSecurity {
  static filterAddSitesToUserRequest(request, loggedUser) {
    const filteredRequest = {};
    // Set
    filteredRequest.userID = sanitize(request.userID);
    if (request.siteIDs) {
      filteredRequest.siteIDs = request.siteIDs.map(siteID => sanitize(siteID));
    }
    return filteredRequest;
  }

  static filterRemoveSitesFromUserRequest(request, loggedUser) {
    const filteredRequest = {};
    // Set
    filteredRequest.userID = sanitize(request.userID);
    if (request.siteIDs) {
      filteredRequest.siteIDs = request.siteIDs.map(siteID => sanitize(siteID));
    }
    return filteredRequest;
  }

  static filterUserDeleteRequest(request, loggedUser) {
    const filteredRequest = {};
    // Set
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  static filterUserRequest(request, loggedUser) {
    const filteredRequest = {};
    // Set
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  static filterUsersRequest(request, loggedUser) {
    const filteredRequest = {};
    // Handle picture
    filteredRequest.Search = sanitize(request.Search);
    filteredRequest.SiteID = sanitize(request.SiteID);
    filteredRequest.Role = sanitize(request.Role);
    filteredRequest.Status = sanitize(request.Status);
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
      filteredRequest.address = UtilsSecurity.filterAddressRequest(request.address, loggedUser);
    }
    if (request.passwords && request.passwords.password && request.passwords.password.length > 0) {
      filteredRequest.password = sanitize(request.passwords.password);
    }
    if (request.phone) {
      filteredRequest.phone = sanitize(request.phone);
    }
    // Admin?
    if (Authorizations.isAdmin(loggedUser)) {
      // Ok to set the sensitive data
      if (request.email) {
        filteredRequest.email = sanitize(request.email);
      }
      if (request.role) {
        filteredRequest.role = sanitize(request.role);
      }
      if (request.status) {
        filteredRequest.status = sanitize(request.status);
      }
      if (request.tagIDs) {
        filteredRequest.tagIDs = sanitize(request.tagIDs);
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
      if (Authorizations.isAdmin(loggedUser)) {
        filteredUser.id = user.id;
        filteredUser.name = user.name;
        filteredUser.firstName = user.firstName;
        filteredUser.email = user.email;
        filteredUser.locale = user.locale;
        filteredUser.phone = user.phone;
        filteredUser.mobile = user.mobile;
        filteredUser.iNumber = user.iNumber;
        filteredUser.costCenter = user.costCenter;
        filteredUser.status = user.status;
        filteredUser.eulaAcceptedOn = user.eulaAcceptedOn;
        filteredUser.eulaAcceptedVersion = user.eulaAcceptedVersion;
        filteredUser.tagIDs = user.tagIDs;
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

    if (!users) {
      return null;
    }
    for (const user of users) {
      // Filter
      const filteredUser = UserSecurity.filterUserResponse(user, loggedUser);
      // Ok?
      if (filteredUser) {
        // Add
        filteredUsers.push(filteredUser);
      }
    }
    return filteredUsers;
  }
}

module.exports = UserSecurity;
