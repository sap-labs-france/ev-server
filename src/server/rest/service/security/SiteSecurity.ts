import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import UtilsSecurity from './UtilsSecurity';
import CompanySecurity from './CompanySecurity';
import SiteAreaSecurity from './SiteAreaSecurity';
import UserSecurity from './UserSecurity';
import SiteUserRequest from '../../../../types/requests/SiteUserRequest';
import AppError from '../../../../exception/AppError';
import Constants from '../../../../utils/Constants';
import HttpByIDRequest from '../../../../types/requests/HttpByIDRequest';

export default class SiteSecurity {

  public static filterUpdateSiteUsersRoleRequest(request: Partial<SiteUserRequest>, userToken): SiteUserRequest {
    if (!request.role) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The role must be provided`, 500,
        'SiteService', 'handleUpdateSiteUsersRole', userToken);
    }
    if (request.role !== Constants.ROLE_ADMIN && request.role !== Constants.ROLE_BASIC) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The role ${request.role} is not supported`, 500,
        'SiteService', 'handleUpdateSiteUsersRole', userToken);
    }
    return {role: sanitize(request.role), ...this.filterAssignSiteUsers(request, userToken)};
  }

  public static filterAssignSiteUsers(request: Partial<SiteUserRequest>, userToken) {
    if (!request.siteID) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The Site's ID must be provided`, 500,
        'SiteSecurity', 'filterAssignSiteUsers', userToken);
    }
    if (!request.userIDs || (request.userIDs && request.userIDs.length <= 0)) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The User's IDs must be provided`, 500,
        'SiteScurity', 'filterAssignSiteUsers', userToken);
    }
    const filteredRequest: SiteUserRequest = {} as SiteUserRequest;
    filteredRequest.siteID = sanitize(request.siteID);
    filteredRequest.userIDs = request.userIDs.map((userID) => {
      return sanitize(userID);
    });
    return filteredRequest;
  }

  public static filterSiteDeleteRequest(request: Partial<HttpByIDRequest>): string {
    return this.filterSiteRequest(request);
  }

  public static filterSiteRequest(request: Partial<HttpByIDRequest>): string {
    return request.ID?sanitize(request.ID):null;
  }

  static filterSiteUsersRequest(request) {
    const filteredRequest: any = {};
    filteredRequest.siteID = sanitize(request.SiteID);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  static filterSitesRequest(request) {
    const filteredRequest: any = {};
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

  public static _filterSiteRequest(request, userToken) {
    const filteredRequest: any = {};
    filteredRequest.name = sanitize(request.name);
    filteredRequest.address = UtilsSecurity.filterAddressRequest(request.address);
    filteredRequest.image = sanitize(request.image);
    filteredRequest.allowAllUsersToStopTransactions =
      UtilsSecurity.filterBoolean(request.allowAllUsersToStopTransactions);
    filteredRequest.autoUserSiteAssignment =
      UtilsSecurity.filterBoolean(request.autoUserSiteAssignment);
    //filteredRequest.gps = sanitize(request.gps);
    if (request.userIDs) {
      // Handle Users
      filteredRequest.userIDs = request.userIDs.map((userID) => {
        return sanitize(userID);
      });
      filteredRequest.userIDs = request.userIDs.filter((userID) => {
        // Check auth
        if (Authorizations.canReadUser(userToken, userID)) {
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
    if (Authorizations.canReadSite(loggedUser, site.id)) {
      // Admin?
      if (Authorizations.isAdmin(loggedUser.role)) {
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
        filteredSite.address = UtilsSecurity.filterAddressRequest(site.address);
      }
      if (site.company) {
        filteredSite.company = CompanySecurity.filterCompanyResponse({id: site.company._id.toHexString(), ...site.company}, loggedUser);//TODO change
      }
      if (site.siteAreas) {
        filteredSite.siteAreas = SiteAreaSecurity.filterSiteAreasResponse(site.siteAreas, loggedUser);
      }
      if (site.users) {
        filteredSite.users = site.users.map((user) => {
          return UserSecurity.filterMinimalUserResponse(user, loggedUser);
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

