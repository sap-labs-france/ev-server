import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import UtilsSecurity from './UtilsSecurity';
import ChargingStationSecurity from './ChargingStationSecurity';
import SiteSecurity from './SiteSecurity';
import ByID from '../../../../types/requests/ByID';
import { IncomingSiteAreaSearch, FilteredSiteAreaSearch, IncomingSiteAreasSearch, FilteredSiteAreasSearch } from '../../../../types/requests/SiteAreaSearch';
import BadRequestError from '../../../../exception/BadRequestError';

export default class SiteAreaSecurity {


  public static filterSiteAreaDeleteRequest(request: ByID): string {
    return sanitize(request.ID);
  }

  public static filterSiteAreaRequest(request: IncomingSiteAreaSearch): FilteredSiteAreaSearch {
    //Throw error if arguments missing
    if(! request.ID) {
      throw new BadRequestError({message: 'ID is required for all SiteArea related requests'});
    }

    //Filter request
    const filteredRequest: FilteredSiteAreaSearch = {} as FilteredSiteAreaSearch;
    filteredRequest.ID = sanitize(request.ID);
    filteredRequest.WithChargeBoxes = !request.WithChargeBoxes ? false : sanitize(request.WithChargeBoxes);
    filteredRequest.WithSite = !request.WithSite ? false : sanitize(request.WithSite);
    return filteredRequest;
  }

  public static filterSiteAreasRequest(request: IncomingSiteAreasSearch): FilteredSiteAreasSearch {
    //Throw error if arguments missing
    if(! request.Search || ! request.SiteID) {
      throw new BadRequestError({message: 'SiteID and Search are required for all SiteAreas related requests'});
    }

    //Filter request
    const filteredRequest: FilteredSiteAreasSearch = {} as FilteredSiteAreasSearch;
    filteredRequest.Search = sanitize(request.Search);
    filteredRequest.WithSite = !request.WithSite ? false : UtilsSecurity.filterBoolean(request.WithSite);
    filteredRequest.WithChargeBoxes = !request.WithChargeBoxes ? false : UtilsSecurity.filterBoolean(request.WithChargeBoxes);
    filteredRequest.WithAvailableChargers = !request.WithAvailableChargers ? false : UtilsSecurity.filterBoolean(request.WithAvailableChargers);
    filteredRequest.SiteID = sanitize(request.SiteID);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }


  static filterSiteAreaUpdateRequest(request:) {
    // Set
    const filteredRequest = SiteAreaSecurity._filterSiteAreaRequest(request);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  static filterSiteAreaCreateRequest(request) {
    return SiteAreaSecurity._filterSiteAreaRequest(request);
  }

  // eslint-disable-next-line no-unused-vars
  static _filterSiteAreaRequest(request) {
    const filteredRequest: any = {};
    filteredRequest.name = sanitize(request.name);
    filteredRequest.address = UtilsSecurity.filterAddressRequest(request.address);
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


