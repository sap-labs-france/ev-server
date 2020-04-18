import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import ChargingStationSecurity from './ChargingStationSecurity';
import { HttpSiteAreaConsumptionsRequest, HttpSiteAreaRequest, HttpSiteAreasRequest } from '../../../../types/requests/HttpSiteAreaRequest';
import SiteArea, { SiteAreaConsumption, SiteAreaConsumptionValues } from '../../../../types/SiteArea';
import SiteSecurity from './SiteSecurity';
import UserToken from '../../../../types/UserToken';
import UtilsSecurity from './UtilsSecurity';
import { DataResult } from '../../../../types/DataResult';
import Utils from '../../../../utils/Utils';

export default class SiteAreaSecurity {

  public static filterSiteAreaRequestByID(request: any): string {
    return sanitize(request.ID);
  }

  public static filterSiteAreaRequest(request: any): HttpSiteAreaRequest {
    // Filter request
    return {
      ID: sanitize(request.ID),
      WithChargeBoxes: !request.WithChargeBoxes ? false : sanitize(request.WithChargeBoxes),
      WithSite: !request.WithSite ? false : sanitize(request.WithSite)
    } as HttpSiteAreaRequest;
  }

  public static filterSiteAreasRequest(request: any): HttpSiteAreasRequest {
    const filteredRequest: HttpSiteAreasRequest = {
      Search: sanitize(request.Search),
      WithSite: !request.WithSite ? false : UtilsSecurity.filterBoolean(request.WithSite),
      WithChargeBoxes: !request.WithChargeBoxes ? false : UtilsSecurity.filterBoolean(request.WithChargeBoxes),
      WithAvailableChargers: !request.WithAvailableChargers ? false : UtilsSecurity.filterBoolean(request.WithAvailableChargers),
      SiteID: sanitize(request.SiteID)
    } as HttpSiteAreasRequest;
    if (request.Issuer) {
      filteredRequest.Issuer = UtilsSecurity.filterBoolean(request.Issuer);
    }
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterSiteAreaConsumptionRequest(request: any): HttpSiteAreaConsumptionsRequest {
    return {
      SiteAreaID: sanitize(request.SiteAreaID),
      StartDate: sanitize(request.StartDate),
      EndDate: sanitize(request.EndDate)
    };
  }

  public static filterSiteAreaUpdateRequest(request: any): Partial<SiteArea> {
    return {
      id: sanitize(request.id),
      ...SiteAreaSecurity._filterSiteAreaRequest(request)
    };
  }

  public static filterSiteAreaCreateRequest(request: any): Partial<SiteArea> {
    return SiteAreaSecurity._filterSiteAreaRequest(request);
  }

  public static _filterSiteAreaRequest(request: any): Partial<SiteArea> {
    return {
      name: sanitize(request.name),
      address: UtilsSecurity.filterAddressRequest(request.address),
      image: sanitize(request.image),
      maximumPower: sanitize(request.maximumPower),
      smartCharging: UtilsSecurity.filterBoolean(request.smartCharging),
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
      if (Utils.objectHasProperty(siteArea, 'address')) {
        filteredSiteArea.address = UtilsSecurity.filterAddressRequest(siteArea.address);
      }
      if (siteArea.connectorStats) {
        filteredSiteArea.connectorStats = siteArea.connectorStats;
      }
      if (Utils.objectHasProperty(siteArea, 'accessControl')) {
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

  static filterSiteAreasResponse(siteAreas: DataResult<SiteArea>, loggedUser) {
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
      // Add
      if (filteredSiteArea) {
        filteredSiteAreas.push(filteredSiteArea);
      }
    }
    siteAreas.result = filteredSiteAreas;
  }

  static filterSiteAreaConsumptionResponse(siteAreaConsumptionValues: SiteAreaConsumptionValues[],
    siteAreaLimit: number, siteAreaId: string): SiteAreaConsumption {
    // Create Site Area Consumption
    const siteAreaConsumption: SiteAreaConsumption = {
      siteAreaId: siteAreaId,
      values: []
    };
    for (const siteAreaConsumptionValue of siteAreaConsumptionValues) {
      siteAreaConsumption.values.push({ date: siteAreaConsumptionValue.date, instantPower: siteAreaConsumptionValue.instantPower, limitWatts: siteAreaLimit });
    }
    // Add Values where no Consumption is available
    for (let i = 1; i < siteAreaConsumption.values.length; i++) {
      if (siteAreaConsumption.values[i - 1].date.getTime() + 60000 !== siteAreaConsumption.values[i].date.getTime() && siteAreaConsumption.values[i]) {
        const addedValue = JSON.parse(JSON.stringify(siteAreaConsumption.values[i]));
        const newDate = new Date(siteAreaConsumption.values[i - 1].date.getTime() + 60000);
        addedValue.date = newDate;
        addedValue.instantPower = 0;
        siteAreaConsumption.values.splice(i, 0, addedValue);
        i++;
      }
      if (siteAreaConsumption.values[i].date.getTime() - 60000 !== siteAreaConsumption.values[i - 1].date.getTime() && siteAreaConsumption.values[i]) {
        const addedValue = JSON.parse(JSON.stringify(siteAreaConsumption.values[i]));
        const newDate = new Date(siteAreaConsumption.values[i].date.getTime() - 60000);
        addedValue.date = newDate;
        addedValue.instantPower = 0;
        siteAreaConsumption.values.splice(i, 0, addedValue);
        i++;
      }
    }
    return siteAreaConsumption;
  }
}
