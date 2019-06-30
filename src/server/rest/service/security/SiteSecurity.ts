import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import CompanySecurity from './CompanySecurity';
import SiteAreaSecurity from './SiteAreaSecurity';
import UserSecurity from './UserSecurity';
import { HttpSiteAssignUsersRequest, HttpSitesRequest, HttpSiteUsersRequest, HttpSiteUserAdminRequest, HttpSiteRequest } from '../../../../types/requests/HttpSiteRequest';
import HttpByIDRequest from '../../../../types/requests/HttpByIDRequest';
import Site from '../../../../types/Site';
import UtilsSecurity from './UtilsSecurity';

export default class SiteSecurity {

  public static filterUpdateSiteUserAdminRequest(request: Partial<HttpSiteUserAdminRequest>): HttpSiteUserAdminRequest {
    const filteredRequest: HttpSiteUserAdminRequest = {
      siteID: sanitize(request.siteID),
      userID: sanitize(request.userID)
    } as HttpSiteUserAdminRequest;
    if ('siteAdmin' in request) {
      filteredRequest.siteAdmin = UtilsSecurity.filterBoolean(request.siteAdmin);
    }
    return filteredRequest;
  }

  public static filterAssignSiteUsers(request: Partial<HttpSiteAssignUsersRequest>): HttpSiteAssignUsersRequest {
    const filteredRequest: HttpSiteAssignUsersRequest = {
      siteID: sanitize(request.siteID)
    } as HttpSiteAssignUsersRequest;
    filteredRequest.userIDs = request.userIDs.map((userID) => {
      return sanitize(userID);
    });
    return filteredRequest;
  }

  public static filterSiteRequest(request: HttpByIDRequest): HttpSiteRequest {
    return {
      ID: sanitize(request.ID)
    };
  }

  public static filterSiteRequestByID(request: HttpByIDRequest): string {
    return sanitize(request.ID);
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

  public static filterSiteUpdateRequest(request: Partial<Site>): Partial<Site> {
    const filteredRequest = SiteSecurity._filterSiteRequest(request);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  public static filterSiteCreateRequest(request: Partial<Site>): Partial<Site> {
    return SiteSecurity._filterSiteRequest(request);
  }

  public static _filterSiteRequest(request: Partial<Site>): Partial<Site> {
    const filteredRequest: any = {};
    filteredRequest.name = sanitize(request.name);
    filteredRequest.address = UtilsSecurity.filterAddressRequest(request.address);
    filteredRequest.image = sanitize(request.image);
    filteredRequest.allowAllUsersToStopTransactions =
      UtilsSecurity.filterBoolean(request.allowAllUsersToStopTransactions);
    filteredRequest.autoUserSiteAssignment =
      UtilsSecurity.filterBoolean(request.autoUserSiteAssignment);
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
      if (filteredSite) {
        filteredSites.push(filteredSite);
      }
    }
    sites.result = filteredSites;
  }
}

