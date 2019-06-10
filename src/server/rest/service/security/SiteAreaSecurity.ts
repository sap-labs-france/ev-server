import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import UtilsSecurity from './UtilsSecurity';
import ChargingStationSecurity from './ChargingStationSecurity';
import SiteSecurity from './SiteSecurity';

export default class SiteAreaSecurity {


  // eslint-disable-next-line no-unused-vars
  static filterSiteAreaDeleteRequest(request, loggedUser) {
    const filteredRequest: any = {};
    // Set
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterSiteAreaRequest(request, loggedUser) {
    const filteredRequest: any = {};
    filteredRequest.ID = sanitize(request.ID);
    filteredRequest.WithChargeBoxes = sanitize(request.WithChargeBoxes);
    filteredRequest.WithSite = sanitize(request.WithSite);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterSiteAreasRequest(request, loggedUser) {
    const filteredRequest: any = {};
    filteredRequest.Search = sanitize(request.Search);
    filteredRequest.WithSite = UtilsSecurity.filterBoolean(request.WithSite);
    filteredRequest.WithChargeBoxes = UtilsSecurity.filterBoolean(request.WithChargeBoxes);
    filteredRequest.WithAvailableChargers = UtilsSecurity.filterBoolean(request.WithAvailableChargers);
    filteredRequest.SiteID = sanitize(request.SiteID);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  static filterSiteAreaUpdateRequest(request, loggedUser) {
    // Set
    const filteredRequest = SiteAreaSecurity._filterSiteAreaRequest(request, loggedUser);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  static filterSiteAreaCreateRequest(request, loggedUser) {
    return SiteAreaSecurity._filterSiteAreaRequest(request, loggedUser);
  }

  // eslint-disable-next-line no-unused-vars
  static _filterSiteAreaRequest(request, loggedUser) {
    const filteredRequest: any = {};
    filteredRequest.name = sanitize(request.name);
    filteredRequest.address = UtilsSecurity.filterAddressRequest(request.address, loggedUser);
    filteredRequest.image = sanitize(request.image);
    filteredRequest.maximumPower = sanitize(request.maximumPower);
    filteredRequest.accessControl = UtilsSecurity.filterBoolean(request.accessControl);
    filteredRequest.siteID = sanitize(request.siteID);
    filteredRequest.chargeBoxIDs = sanitize(request.chargeBoxIDs);
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
        filteredSiteArea.address = UtilsSecurity.filterAddressRequest(siteArea.address, loggedUser);
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
        filteredSiteArea.site = SiteSecurity.filterSiteResponse(siteArea.site, loggedUser);
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


