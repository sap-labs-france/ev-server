import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import CompanySecurity from './CompanySecurity';
import SiteAreaSecurity from './SiteAreaSecurity';
import UserSecurity from './UserSecurity';
import { HttpSiteUserAssignmentRequest, HttpSiteUserRoleChangeRequest, HttpSiteRequest, HttpSitesRequest, HttpSiteUsersRequest } from '../../../../types/requests/HttpSiteUserRequest';
import AppError from '../../../../exception/AppError';
import Constants from '../../../../utils/Constants';
import HttpByIDRequest from '../../../../types/requests/HttpByIDRequest';
import AppAuthError from '../../../../exception/AppAuthError';
import Site from '../../../../types/Site';
import Utils from '../../../../utils/Utils';
import UtilsSecurity from './UtilsSecurity';

export default class SiteSecurity {

  public static filterUpdateSiteUsersRoleRequest(request: Partial<HttpSiteUserRoleChangeRequest>, userToken): HttpSiteUserRoleChangeRequest {
    if (!request.siteAdmin) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Must provide whether is admin or not`, 500,
        'SiteSecurity', 'filterUpdateSiteUsersRoleRequest', userToken);
    }
    if(!request.siteID){
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The Site's ID must be provided`, 500,
        'SiteSecurity', 'filterUpdateSiteUsersRoleRequest', userToken);
    }
    if(!request.userID){
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The User's ID must be provided`, 500,
        'SiteSecurity', 'filterUpdateSiteUsersRoleRequest', userToken);
    }

    
    return {siteAdmin: sanitize(request.siteAdmin), userID: sanitize(request.userID), siteID: sanitize(request.siteID)};
  }

  public static filterAssignSiteUsers(request: Partial<HttpSiteUserAssignmentRequest>, userToken): HttpSiteUserAssignmentRequest {
    if (!Authorizations.canUpdateSite(userToken)) {
      throw new AppAuthError(
        Constants.ACTION_UPDATE,
        Constants.ENTITY_SITE,
        request.siteID,
        Constants.HTTP_AUTH_ERROR,
        'SiteService', 'handleRemoveUsersFromSite',
        userToken);
    }
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
    const filteredRequest: HttpSiteUserAssignmentRequest = {} as HttpSiteUserAssignmentRequest;
    filteredRequest.siteID = sanitize(request.siteID);
    filteredRequest.userIDs = request.userIDs.map((userID) => {
      return sanitize(userID);
    });
    return filteredRequest;
  }

  public static filterSiteDeleteRequest(request: Partial<HttpByIDRequest>, userToken): string {
    if (!Authorizations.canDeleteSite(userToken)) {
      throw new AppAuthError(
        Constants.ACTION_DELETE,
        Constants.ENTITY_SITE,
        request.ID,
        Constants.HTTP_AUTH_ERROR,
        'SiteService', 'handleDeleteSite',
        userToken);
    }
    return this.filterSiteRequest(request);
  }

  public static filterSiteRequest(request: Partial<HttpByIDRequest>): string {
    return request.ID?sanitize(request.ID):null;
  }

  public static filterSiteUsersRequest(request: Partial<HttpSiteUsersRequest>): HttpSiteUsersRequest {
    const filteredRequest: HttpSiteUsersRequest = {} as HttpSiteUsersRequest;
    filteredRequest.SiteID = sanitize(request.SiteID);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterSitesRequest(request: Partial<HttpSitesRequest>, userToken): HttpSitesRequest {
    const filteredRequest: HttpSitesRequest = {} as HttpSitesRequest;
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

  public static filterSiteUpdateRequest(request: Partial<Site>, userToken): Partial<Site> {
    if (!request.id) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Site ID is mandatory`, Constants.HTTP_GENERAL_ERROR,
        'Site', 'checkIfSiteValid',
        userToken.id);
    }
    if (!request.name) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Site Name is mandatory`, Constants.HTTP_GENERAL_ERROR,
        'Site', 'checkIfSiteValid',
        userToken.id, request.id);
    }
    if (!request.companyID) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Company ID is mandatory for the Site`, Constants.HTTP_GENERAL_ERROR,
        'Sites', 'checkIfSiteValid',
        userToken.id, request.id);
    }    
    const filteredRequest = SiteSecurity._filterSiteRequest<Partial<Site>>(request, userToken);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  public static filterSiteCreateRequest(request: Optional<Site, 'id'>, userToken): Optional<Site, 'id'> {
    if (!request.name) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Site Name is mandatory`, Constants.HTTP_GENERAL_ERROR,
        'Site', 'checkIfSiteValid',
        userToken.id, request.id);
    }
    if (!request.companyID) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Company ID is mandatory for the Site`, Constants.HTTP_GENERAL_ERROR,
        'Sites', 'checkIfSiteValid',
        userToken.id, request.id);
    }
    return SiteSecurity._filterSiteRequest<Optional<Site, 'id'>>(request, userToken);
  }

  public static _filterSiteRequest<K extends Partial<Site>>(request: K, userToken): K {
    const filtered: K = {} as K;
    Utils.conditionalCopies(request, filtered, ['name', 'address', 'image', 'companyID'], [sanitize]);
    Utils.conditionalCopies(request, filtered, ['allowAllUsersToStopTransactions', 'autoUserSiteAssignment'], [UtilsSecurity.filterBoolean]);
    return filtered;
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
        filteredSite.company = CompanySecurity.filterCompanyResponse(site.company, loggedUser);//TODO change
      }
      if (site.siteAreas) {
        filteredSite.siteAreas = SiteAreaSecurity.filterSiteAreasResponse(site.siteAreas, loggedUser);
      }
      if (site.users) {
        filteredSite.users = site.users.map((user) => {
          return UserSecurity.filterMinimalUserResponse(user, loggedUser);
        });
      }
      if (site.hasOwnProperty('availableChargers')) {
        filteredSite.availableChargers = site.availableChargers;
      }
      if (site.hasOwnProperty('totalChargers')) {
        filteredSite.totalChargers = site.totalChargers;
      }
      if (site.hasOwnProperty('availableConnectors')) {
        filteredSite.availableConnectors = site.availableConnectors;
      }
      if (site.hasOwnProperty('totalConnectors')) {
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

