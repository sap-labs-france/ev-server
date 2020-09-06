import { HttpSiteAssignUsersRequest, HttpSiteOwnerRequest, HttpSiteRequest, HttpSiteUserAdminRequest, HttpSiteUsersRequest, HttpSitesRequest } from '../../../../types/requests/HttpSiteRequest';

import Authorizations from '../../../../authorization/Authorizations';
import CompanySecurity from './CompanySecurity';
import { DataResult } from '../../../../types/DataResult';
import Site from '../../../../types/Site';
import SiteAreaSecurity from './SiteAreaSecurity';
import UserToken from '../../../../types/UserToken';
import Utils from '../../../../utils/Utils';
import UtilsSecurity from './UtilsSecurity';
import sanitize from 'mongo-sanitize';

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

  public static filterUpdateSiteOwnerRequest(request: any): HttpSiteOwnerRequest {
    const filteredRequest: HttpSiteOwnerRequest = {
      siteID: sanitize(request.siteID),
      userID: sanitize(request.userID)
    } as HttpSiteOwnerRequest;
    if ('siteOwner' in request) {
      filteredRequest.siteOwner = UtilsSecurity.filterBoolean(request.siteOwner);
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
      ID: sanitize(request.ID),
      WithCompany: sanitize(request.WithCompany)
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
    if (request.Issuer) {
      filteredRequest.Issuer = UtilsSecurity.filterBoolean(request.Issuer);
    }
    filteredRequest.Search = sanitize(request.Search);
    filteredRequest.UserID = sanitize(request.UserID);
    filteredRequest.CompanyID = sanitize(request.CompanyID);
    filteredRequest.SiteID = sanitize(request.SiteID);
    filteredRequest.ExcludeSitesOfUserID = sanitize(request.ExcludeSitesOfUserID);
    filteredRequest.WithCompany = UtilsSecurity.filterBoolean(request.WithCompany);
    filteredRequest.WithAvailableChargers = UtilsSecurity.filterBoolean(request.WithAvailableChargers);
    if (Utils.containsGPSCoordinates([request.LocLongitude, request.LocLatitude])) {
      filteredRequest.LocCoordinates = [
        Utils.convertToFloat(sanitize(request.LocLongitude)),
        Utils.convertToFloat(sanitize(request.LocLatitude))
      ];
      if (request.LocMaxDistanceMeters) {
        request.LocMaxDistanceMeters = Utils.convertToInt(sanitize(request.LocMaxDistanceMeters));
        if (request.LocMaxDistanceMeters > 0) {
          filteredRequest.LocMaxDistanceMeters = request.LocMaxDistanceMeters;
        }
      }
    }
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
    filteredRequest.public = UtilsSecurity.filterBoolean(request.public);
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
      // Set only necessary info
      filteredSite = {};
      filteredSite.id = site.id;
      filteredSite.name = site.name;
      filteredSite.companyID = site.companyID;
      filteredSite.autoUserSiteAssignment = site.autoUserSiteAssignment;
      filteredSite.public = site.public;
      filteredSite.issuer = site.issuer;
      if (Utils.objectHasProperty(site, 'address')) {
        filteredSite.address = UtilsSecurity.filterAddressRequest(site.address);
      }
      if (site.company) {
        filteredSite.company = CompanySecurity.filterCompanyResponse(site.company, loggedUser);
      }
      if (site.siteAreas) {
        filteredSite.siteAreas = SiteAreaSecurity.filterSiteAreasResponse({
          count: site.siteAreas.length,
          result: site.siteAreas
        }, loggedUser);
      }
      if (site.connectorStats) {
        filteredSite.connectorStats = site.connectorStats;
      }
      if (Utils.objectHasProperty(site, 'distanceMeters')) {
        filteredSite.distanceMeters = site.distanceMeters;
      }
      // Created By / Last Changed By
      UtilsSecurity.filterCreatedAndLastChanged(filteredSite, site, loggedUser);
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

