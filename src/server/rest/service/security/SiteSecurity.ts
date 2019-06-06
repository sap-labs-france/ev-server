import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import UtilsSecurity from './UtilsSecurity';

let CompanySecurity; // Avoid circular deps
let SiteAreaSecurity; // Avoid circular deps
let UserSecurity; // Avoid circular deps
export default class SiteSecurity {
  static getCompanySecurity() {
    if (!CompanySecurity) {
      CompanySecurity = require('./CompanySecurity');
    }
    return CompanySecurity;
  }

  static getSiteAreaSecurity() {
    if (!SiteAreaSecurity) {
      SiteAreaSecurity = require('./SiteAreaSecurity');
    }
    return SiteAreaSecurity;
  }

  static getUserSecurity() {
    if (!UserSecurity) {
      UserSecurity = require('./UserSecurity');
    }
    return UserSecurity;
  }

  // eslint-disable-next-line no-unused-vars
  static filterAddUsersToSiteRequest(request, loggedUser) {
    const filteredRequest:any = {};
    // Set
    filteredRequest.siteID = sanitize(request.siteID);
    if (request.userIDs) {
      filteredRequest.userIDs = request.userIDs.map(userID => sanitize(userID));
    }
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterRemoveUsersFromSiteRequest(request, loggedUser) {
    const filteredRequest:any = {};
    // Set
    filteredRequest.siteID = sanitize(request.siteID);
    if (request.userIDs) {
      filteredRequest.userIDs = request.userIDs.map(userID => sanitize(userID));
    }
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterSiteDeleteRequest(request, loggedUser) {
    const filteredRequest:any = {};
    // Set
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterSiteRequest(request, loggedUser) {
    const filteredRequest:any = {};
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterSitesRequest(request, loggedUser) {
    const filteredRequest:any = {};
    filteredRequest.Search = sanitize(request.Search);
    filteredRequest.UserID = sanitize(request.UserID);
    filteredRequest.CompanyID = sanitize(request.CompanyID);
    filteredRequest.ExcludeSitesOfUserID = sanitize(request.ExcludeSitesOfUserID);
    filteredRequest.WithCompany = UtilsSecurity.filterBoolean(request.WithCompany);
    filteredRequest.WithAvailableChargers = UtilsSecurity.filterBoolean(request.WithAvailableChargers);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  static filterSiteUpdateRequest(request, loggedUser) {
    // SetSites
    const filteredRequest = SiteSecurity._filterSiteRequest(request, loggedUser);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  static filterSiteCreateRequest(request, loggedUser) {
    return SiteSecurity._filterSiteRequest(request, loggedUser);
  }

  static _filterSiteRequest(request, loggedUser) {
    const filteredRequest:any = {};
    filteredRequest.name = sanitize(request.name);
    filteredRequest.address = UtilsSecurity.filterAddressRequest(request.address, loggedUser);
    filteredRequest.image = sanitize(request.image);
    filteredRequest.allowAllUsersToStopTransactions =
      UtilsSecurity.filterBoolean(request.allowAllUsersToStopTransactions);
    filteredRequest.autoUserSiteAssignment =
      UtilsSecurity.filterBoolean(request.autoUserSiteAssignment);   
    filteredRequest.gps = sanitize(request.gps);
    if (request.userIDs) {
      // Handle Users
      filteredRequest.userIDs = request.userIDs.map((userID) => {
        return sanitize(userID);
      });
      filteredRequest.userIDs = request.userIDs.filter((userID) => {
        // Check auth
        if (Authorizations.canReadUser(loggedUser, {id: userID})) {
          return true;
        }
        return false;
      });
    }
    filteredRequest.companyID = sanitize(request.companyID);
    return filteredRequest;
  }

  static filterSiteResponse(site, loggedUser) {
    let filteredSite;

    if (!site) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadSite(loggedUser, site)) {
      // Admin?
      if (Authorizations.isAdmin(loggedUser)) {
        // Yes: set all params
        filteredSite = site;
      } else {
        // Set only necessary info
        filteredSite = {};
        filteredSite.id = site.id;
        filteredSite.name = site.name;
        filteredSite.gps = site.gps;
        filteredSite.companyID = site.companyID;
      }
      if (site.address) {
        filteredSite.address = UtilsSecurity.filterAddressRequest(site.address, loggedUser);
      }
      if (site.company) {
        filteredSite.company = SiteSecurity.getCompanySecurity().filterCompanyResponse(site.company, loggedUser);
      }
      if (site.siteAreas) {
        filteredSite.siteAreas = SiteSecurity.getSiteAreaSecurity().filterSiteAreasResponse(site.siteAreas, loggedUser);
      }
      if (site.users) {
        filteredSite.users = site.users.map((user) => {
          return SiteSecurity.getUserSecurity().filterMinimalUserResponse(user, loggedUser);
        });
      }
      if (site.hasOwnProperty("availableChargers")) {
        filteredSite.availableChargers = site.availableChargers;
      }
      if (site.hasOwnProperty("totalChargers")) {
        filteredSite.totalChargers = site.totalChargers;
      }
      if (site.hasOwnProperty("availableConnectors")) {
        filteredSite.availableConnectors = site.availableConnectors;
      }
      if (site.hasOwnProperty("totalConnectors")) {
        filteredSite.totalConnectors = site.totalConnectors;
      }
      // Created By / Last Changed By
      UtilsSecurity.filterCreatedAndLastChanged(
        filteredSite, site, loggedUser);
    }
    return filteredSite;
  }

  static filterSitesResponse(sites, loggedUser) {
    const filteredSites = [];

    if (!sites.result) {
      return null;
    }
    if (!Authorizations.canListSites(loggedUser)) {
      return null;
    }
    for (const site of sites.result) {
      // Filter
      const filteredSite = SiteSecurity.filterSiteResponse(site, loggedUser);
      // Ok?
      if (filteredSite) {
        // Add
        filteredSites.push(filteredSite);
      }
    }
    sites.result = filteredSites;
  }
}


