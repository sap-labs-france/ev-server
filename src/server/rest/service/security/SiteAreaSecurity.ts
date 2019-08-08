import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import ChargingStationSecurity from './ChargingStationSecurity';
import HttpByIDRequest from '../../../../types/requests/HttpByIDRequest';
import { HttpSiteAreaRequest, HttpSiteAreasRequest } from '../../../../types/requests/HttpSiteAreaRequest';
import SiteArea from '../../../../types/SiteArea';
import SiteSecurity from './SiteSecurity';
import UserToken from '../../../../types/UserToken';
import UtilsSecurity from './UtilsSecurity';

export default class SiteAreaSecurity {

  public static filterSiteAreaRequestByID(request: HttpByIDRequest): string {
    return sanitize(request.ID);
  }

  public static filterSiteAreaRequest(request: Partial<HttpSiteAreaRequest>): HttpSiteAreaRequest {
    // Filter request
    return {
      ID: sanitize(request.ID),
      WithChargeBoxes: !request.WithChargeBoxes ? false : sanitize(request.WithChargeBoxes),
      WithSite: !request.WithSite ? false : sanitize(request.WithSite)
    } as HttpSiteAreaRequest;
  }

  public static filterSiteAreasRequest(request: Partial<HttpSiteAreasRequest>): HttpSiteAreasRequest {
    const filteredRequest: HttpSiteAreasRequest = {
      Search: sanitize(request.Search),
      WithSite: !request.WithSite ? false : UtilsSecurity.filterBoolean(request.WithSite),
      WithChargeBoxes: !request.WithChargeBoxes ? false : UtilsSecurity.filterBoolean(request.WithChargeBoxes),
      WithAvailableChargers: !request.WithAvailableChargers ? false : UtilsSecurity.filterBoolean(request.WithAvailableChargers),
      SiteID: sanitize(request.SiteID)
    } as HttpSiteAreasRequest;
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterSiteAreaUpdateRequest(request: Partial<SiteArea>): Partial<SiteArea> {
    return {
      id: sanitize(request.id),
      ...SiteAreaSecurity._filterSiteAreaRequest(request)
    };
  }

  public static filterSiteAreaCreateRequest(request: Partial<SiteArea>): Partial<SiteArea> {
    return SiteAreaSecurity._filterSiteAreaRequest(request);
  }

  public static _filterSiteAreaRequest(request: Partial<SiteArea>): Partial<SiteArea> {
    return {
      name: sanitize(request.name),
      address: UtilsSecurity.filterAddressRequest(request.address),
      image: sanitize(request.image),
      maximumPower: sanitize(request.maximumPower),
      accessControl: UtilsSecurity.filterBoolean(request.accessControl),
      siteID: sanitize(request.siteID)
    };
  }

  static filterSiteAreaResponse(siteArea, loggedUser: UserToken): SiteArea {
    let filteredSiteArea;

    if (!siteArea) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadSiteArea(loggedUser, siteArea.siteID)) {
      // Admin?
      if (Authorizations.isAdmin(loggedUser.role)) {
        // Yes: set all params
        filteredSiteArea = siteArea;
        if (filteredSiteArea.connectorStats) {
          // TODO: To keep backward compat with Mobile App: remove it once new version is deployed
          filteredSiteArea = { ...filteredSiteArea, ...siteArea.connectorStats };
        }
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
      if (siteArea.connectorStats) {
        filteredSiteArea.connectorStats = siteArea.connectorStats;
        // TODO: To keep backward compat with Mobile App: remove it once new version is deployed
        filteredSiteArea = { ...filteredSiteArea, ...siteArea.connectorStats };
      }
      if (siteArea.hasOwnProperty('accessControl')) {
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

  static filterSiteAreasResponse(siteAreas, loggedUser): SiteArea[] {
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
        filteredSiteAreas.push(filteredSiteArea);
      }
    }
    siteAreas.result = filteredSiteAreas;
  }
}

