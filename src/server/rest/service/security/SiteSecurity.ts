import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import CompanySecurity from './CompanySecurity';
import { HttpSiteAssignUsersRequest, HttpSiteRequest, HttpSiteUserAdminRequest, HttpSiteUsersRequest, HttpSitesRequest } from '../../../../types/requests/HttpSiteRequest';
import Site from '../../../../types/Site';
import SiteAreaSecurity from './SiteAreaSecurity';
import UserToken from '../../../../types/UserToken';
import UtilsSecurity from './UtilsSecurity';
import { DataResult } from '../../../../types/DataResult';

export default class SiteSecurity {
  public static filterUpdateSiteUserAdminRequest(request: any): HttpSiteUserAdminRequest {
    const filteredRequest: HttpSiteUserAdminRequest = {
      siteID: sanitize(request.siteID),
      userID: sanitize(request.userID)
    } as HttpSiteUserAdminRequest;
    if ('siteAdmin' in request) {
      filteredRequest.siteAdmin = UtilsSecurity.filterBoolean(request.siteAdmin);
    }
    return filteredRequest;
  }

  public static filterAssignSiteUsers(request: any): HttpSiteAssignUsersRequest {
    const filteredRequest: HttpSiteAssignUsersRequest = {
      siteID: sanitize(request.siteID)
    } as HttpSiteAssignUsersRequest;
    filteredRequest.userIDs = request.userIDs.map(sanitize);
    return filteredRequest;
  }

  public static filterSiteRequest(request: any): HttpSiteRequest {
    return {
      ID: sanitize(request.ID)
    };
  }

  public static filterSiteRequestByID(request: any): string {
    return sanitize(request.ID);
  }

  public static filterSiteUsersRequest(request: any): HttpSiteUsersRequest {
    const filteredRequest: HttpSiteUsersRequest = {} as HttpSiteUsersRequest;
    filteredRequest.SiteID = sanitize(request.SiteID);
    filteredRequest.Search = sanitize(request.Search);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterSitesRequest(request: any): HttpSitesRequest {
    const filteredRequest: HttpSitesRequest = {} as HttpSitesRequest;
    filteredRequest.Search = sanitize(request.Search);
    filteredRequest.UserID = sanitize(request.UserID);
    filteredRequest.CompanyID = sanitize(request.CompanyID);
    filteredRequest.SiteID = sanitize(request.SiteID);
    filteredRequest.ExcludeSitesOfUserID = sanitize(request.ExcludeSitesOfUserID);
    filteredRequest.WithCompany = UtilsSecurity.filterBoolean(request.WithCompany);
    filteredRequest.WithAvailableChargers = UtilsSecurity.filterBoolean(request.WithAvailableChargers);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterSiteUpdateRequest(request: any): Partial<Site> {
    const filteredRequest = SiteSecurity._filterSiteRequest(request);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  public static filterSiteCreateRequest(request: any): Partial<Site> {
    return SiteSecurity._filterSiteRequest(request);
  }

  public static _filterSiteRequest(request: any): Partial<Site> {
    const filteredRequest: any = {};
    filteredRequest.name = sanitize(request.name);
    filteredRequest.address = UtilsSecurity.filterAddressRequest(request.address);
    filteredRequest.image = sanitize(request.image);
    filteredRequest.autoUserSiteAssignment =
      UtilsSecurity.filterBoolean(request.autoUserSiteAssignment);
    filteredRequest.companyID = sanitize(request.companyID);
    return filteredRequest;
  }

  static filterSiteResponse(site: Site, loggedUser: UserToken): Site {
    let filteredSite;

    if (!site) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadSite(loggedUser, site.id)) {
      // Admin?
      if (Authorizations.isAdmin(loggedUser)) {
        // Yes: set all params
        filteredSite = site;
        if (filteredSite.connectorStats) {
          // TODO: To keep backward compat with Mobile App: remove it once new version is deployed
          filteredSite = { ...filteredSite, ...site.connectorStats };
        }
      } else {
        // Set only necessary info
        filteredSite = {};
        filteredSite.id = site.id;
        filteredSite.name = site.name;
        filteredSite.companyID = site.companyID;
      }
      if (site.address) {
        filteredSite.address = UtilsSecurity.filterAddressRequest(site.address);
      }
      if (site.company) {
        filteredSite.company = CompanySecurity.filterCompanyResponse(site.company, loggedUser);
      }
      if (site.siteAreas) {
        filteredSite.siteAreas = SiteAreaSecurity.filterSiteAreasResponse({ count: site.siteAreas.length, result: site.siteAreas }, loggedUser);
      }
      if (site.connectorStats) {
        filteredSite.connectorStats = site.connectorStats;
        // TODO: To keep backward compat with Mobile App: remove it once new version is deployed
        filteredSite = { ...filteredSite, ...site.connectorStats };
      }
      // Created By / Last Changed By
      UtilsSecurity.filterCreatedAndLastChanged(
        filteredSite, site, loggedUser);
    }
    return filteredSite;
  }

  static filterSitesResponse(sites: DataResult<Site>, loggedUser) {
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

