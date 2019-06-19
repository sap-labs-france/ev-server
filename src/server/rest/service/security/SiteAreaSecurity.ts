import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import UtilsSecurity from './UtilsSecurity';
import ChargingStationSecurity from './ChargingStationSecurity';
import SiteSecurity from './SiteSecurity';
import ByID from '../../../../types/requests/ByID';
import { HttpSiteAreaSearchRequest, HttpSiteAreasSearchRequest } from '../../../../types/requests/SiteAreaSearch';
import BadRequestError from '../../../../exception/BadRequestError';
import { HttpSiteAreaUpdateRequest, HttpSiteAreaCreateRequest } from '../../../../types/requests/SiteAreaData';
import AppAuthError from '../../../../exception/AppAuthError';
import Constants from '../../../../utils/Constants';
import { Request } from 'express';
import AppError from '../../../../exception/AppError';
import { create } from 'domain';
import Utils from '../../../../utils/Utils';

export default class SiteAreaSecurity {


  public static filterSiteAreaDeleteRequest(request: ByID, userToken): string {
    Utils.assertObjectExists(request.ID, 'Site Area ID must be provided', 'SiteAreaService', 'handleDeleteSiteArea', userToken);
    return sanitize(request.ID);
  }

  public static filterSiteAreaRequest(request: Partial<HttpSiteAreaSearchRequest>, userToken): HttpSiteAreaSearchRequest {
    //Throw error if arguments missing
    Utils.assertObjectExists(request.ID, 'ID must be provided.', 'SiteAreaSecurity', 'filterSiteAreaRequest', userToken);

    //Filter request
    const filteredRequest: HttpSiteAreaSearchRequest = {} as HttpSiteAreaSearchRequest;
    filteredRequest.ID = sanitize(request.ID);
    filteredRequest.WithChargeBoxes = !request.WithChargeBoxes ? false : sanitize(request.WithChargeBoxes);
    filteredRequest.WithSite = !request.WithSite ? false : sanitize(request.WithSite);
    return filteredRequest;
  }

  public static filterSiteAreasRequest(request: Partial<HttpSiteAreasSearchRequest>, userToken): HttpSiteAreasSearchRequest {
    // Check auth
    if (!Authorizations.canListSiteAreas(userToken)) {
      // Not Authorized!
      throw new AppAuthError(
        Constants.ACTION_LIST,
        Constants.ENTITY_SITE_AREAS,
        null,
        560, 'SiteAreaService', 'handleGetSiteAreas',
        userToken);
    }

    //Filter request
    const filteredRequest: HttpSiteAreasSearchRequest = {} as HttpSiteAreasSearchRequest;
    filteredRequest.Search = sanitize(request.Search);
    filteredRequest.WithSite = !request.WithSite ? false : UtilsSecurity.filterBoolean(request.WithSite);
    filteredRequest.WithChargeBoxes = !request.WithChargeBoxes ? false : UtilsSecurity.filterBoolean(request.WithChargeBoxes);
    filteredRequest.WithAvailableChargers = !request.WithAvailableChargers ? false : UtilsSecurity.filterBoolean(request.WithAvailableChargers);
    filteredRequest.SiteID = sanitize(request.SiteID);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }


  public static filterSiteAreaUpdateRequest(request: Partial<HttpSiteAreaUpdateRequest>, userToken): HttpSiteAreaUpdateRequest {
    // Set
    if(! request.id) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Site id is mandatory`, 500,
        'SiteAreaSecurity', 'filterSiteAreaUpdateRequest',
        userToken.id, request.id);
    }
    const filteredRequest = {id: sanitize(request.id), ...SiteAreaSecurity._filterSiteAreaRequest(request, userToken)};
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  public static filterSiteAreaCreateRequest(request: Partial<HttpSiteAreaCreateRequest>, userToken): HttpSiteAreaCreateRequest {
    // Check auth
    if (!Authorizations.canCreateSite(userToken)) {
      // Not Authorized!
      throw new AppAuthError(
        Constants.ACTION_CREATE,
        Constants.ENTITY_SITE_AREA,
        null,
        560, 'SiteAreaSecurity', 'filterSiteAreaCreateRequest',
        userToken);
    }

    return SiteAreaSecurity._filterSiteAreaRequest(request, userToken);
  }

  public static _filterSiteAreaRequest(request: Partial<HttpSiteAreaUpdateRequest>, userToken): HttpSiteAreaCreateRequest {
    const filteredRequest: HttpSiteAreaCreateRequest = {} as HttpSiteAreaCreateRequest;
    // Check if name exists, if not throw error
    if(! request.name) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Site Area Name is mandatory`, 500,
        'SiteAreaSecurity', 'filterSiteAreaRequest',
        userToken.id, request.id);
    }
    filteredRequest.name = sanitize(request.name);
    filteredRequest.address = UtilsSecurity.filterAddressRequest(request.address);
    filteredRequest.image = sanitize(request.image);
    filteredRequest.maximumPower = sanitize(request.maximumPower);
    filteredRequest.accessControl = UtilsSecurity.filterBoolean(request.accessControl);
    filteredRequest.chargeBoxIDs = request.chargeBoxIDs?sanitize(request.chargeBoxIDs):[];
    
    // Check if siteID exists, if not throw error
    if(! request.siteID) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Site ID is mandatory`, 500,
        'SiteAreaSecurity', 'filterSiteAreaRequest',
        userToken.id, request.id);
    }
    filteredRequest.siteID = sanitize(request.siteID);
    return filteredRequest;
  }

  static filterSiteAreaResponse(siteArea, loggedUser) {
    let filteredSiteArea;

    if (!siteArea) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadSiteArea(loggedUser, siteArea)) {
      // Admin?
      if (Authorizations.isAdmin(loggedUser)) {
        // Yes: set all params
        filteredSiteArea = siteArea;
      } else {
        // Set only necessary info
        filteredSiteArea = {};
        filteredSiteArea.id = siteArea.id;
        filteredSiteArea.name = siteArea.name;
        filteredSiteArea.siteID = siteArea.siteID;
        filteredSiteArea.maximumPower = siteArea.maximumPower;
      }
      if (siteArea.hasOwnProperty('address')) {
        filteredSiteArea.address = UtilsSecurity.filterAddressRequest(siteArea.address);
      }
      if (siteArea.hasOwnProperty("availableChargers")) {
        filteredSiteArea.availableChargers = siteArea.availableChargers;
      }
      if (siteArea.hasOwnProperty("totalChargers")) {
        filteredSiteArea.totalChargers = siteArea.totalChargers;
      }
      if (siteArea.hasOwnProperty("availableConnectors")) {
        filteredSiteArea.availableConnectors = siteArea.availableConnectors;
      }
      if (siteArea.hasOwnProperty("totalConnectors")) {
        filteredSiteArea.totalConnectors = siteArea.totalConnectors;
      }
      if (siteArea.hasOwnProperty("accessControl")) {
        filteredSiteArea.accessControl = siteArea.accessControl;
      }
      if (siteArea.site) {
        // Site
        filteredSiteArea.site = SiteSecurity.filterSiteResponse(siteArea.site._model, loggedUser);
      }
      if (siteArea.chargeBoxes) {
        filteredSiteArea.chargeBoxes = ChargingStationSecurity
          .filterChargingStationsResponse(siteArea.chargeBoxes, loggedUser, true);
      }
      // Created By / Last Changed By
      UtilsSecurity.filterCreatedAndLastChanged(
        filteredSiteArea, siteArea, loggedUser);
    }
    return filteredSiteArea;
  }

  static filterSiteAreasResponse(siteAreas, loggedUser) {
    const filteredSiteAreas = [];
    if (!siteAreas.result) {
      return null;
    }
    if (!Authorizations.canListSiteAreas(loggedUser)) {
      return null;
    }
    for (const siteArea of siteAreas.result) {
      // Filter
      const filteredSiteArea = SiteAreaSecurity.filterSiteAreaResponse(siteArea, loggedUser);
      // Ok?
      if (filteredSiteArea) {
        // Add
        filteredSiteAreas.push(filteredSiteArea);
      }
    }
    siteAreas.result = filteredSiteAreas;
  }

}

