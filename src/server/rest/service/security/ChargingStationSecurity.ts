import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import Constants from '../../../../utils/Constants';
import UserToken from '../../../../types/UserToken';
import UtilsSecurity from './UtilsSecurity';
import { HttpAssignChargingStationToSiteAreaRequest, HttpChargingStationsRequest, HttpChargingStationRequest, HttpChargingStationSetMaxIntensitySocketRequest, HttpChargingStationCommandRequest } from '../../../../types/requests/HttpChargingStationRequest';
import HttpByIDRequest from '../../../../types/requests/HttpByIDRequest';
import HttpDatabaseRequest from '../../../../types/requests/HttpDatabaseRequest';
import ChargingStation from '../../../../types/ChargingStation';

export default class ChargingStationSecurity {

  public static filterAssignChargingStationsToSiteAreaRequest(request: Partial<HttpAssignChargingStationToSiteAreaRequest>): HttpAssignChargingStationToSiteAreaRequest {
    return {
      siteAreaID: sanitize(request.siteAreaID),
      chargingStationIDs: request.chargingStationIDs.map(id=>sanitize(id))
    };
  }

  // Charging Station
  public static filterChargingStationResponse(chargingStation: ChargingStation, loggedUser: UserToken, organizationIsActive: boolean): Partial<ChargingStation> {
    let filteredChargingStation;

    if (!chargingStation || !Authorizations.canReadChargingStation(loggedUser)) {
      return null;
    }

    const siteID = chargingStation.siteArea ? chargingStation.siteArea.siteID : null;
    if (organizationIsActive && !Authorizations.canReadSiteArea(loggedUser, siteID)) {
      return null;
    }
    if (Authorizations.canUpdateChargingStation(loggedUser, siteID)) {
      // Yes: set all params
      filteredChargingStation = chargingStation;
      for (const connector of filteredChargingStation.connectors) {
        if (filteredChargingStation.inactive && connector) {
          connector.status = Constants.CONN_STATUS_UNAVAILABLE;
          connector.currentConsumption = 0;
          connector.totalConsumption = 0;
          connector.totalInactivitySecs = 0;
          connector.currentStateOfCharge = 0;
        }
      }
    } else {
      // Set only necessary info
      filteredChargingStation = {};
      filteredChargingStation.id = chargingStation.id;
      filteredChargingStation.chargeBoxID = chargingStation.id;
      filteredChargingStation.inactive = chargingStation.inactive;
      filteredChargingStation.connectors = chargingStation.connectors.map((connector) => {
        if (!connector) {
          return connector;
        }
        return {
          'connectorId': connector.connectorId,
          'status': (filteredChargingStation.inactive ? Constants.CONN_STATUS_UNAVAILABLE : connector.status),
          'currentConsumption': (filteredChargingStation.inactive ? 0 : connector.currentConsumption),
          'currentStateOfCharge': (filteredChargingStation.inactive ? 0 : connector.currentStateOfCharge),
          'totalConsumption': (filteredChargingStation.inactive ? 0 : connector.totalConsumption),
          'totalInactivitySecs': (filteredChargingStation.inactive ? 0 : connector.totalInactivitySecs),
          'activeTransactionID': connector.activeTransactionID,
          'errorCode': connector.errorCode,
          'type': connector.type,
          'power': connector.power,
          'voltage': connector.voltage,
          'amperage': connector.amperage
        };
      });
      filteredChargingStation.lastHeartBeat = chargingStation.lastHeartBeat;
      filteredChargingStation.maximumPower = chargingStation.maximumPower;
      filteredChargingStation.chargePointVendor = chargingStation.chargePointVendor;
      filteredChargingStation.siteAreaID = chargingStation.siteAreaID;
      filteredChargingStation.latitude = chargingStation.latitude;
      filteredChargingStation.longitude = chargingStation.longitude;
      if (chargingStation.siteArea) {
        filteredChargingStation.siteArea = chargingStation.siteArea;
      }
    }
    // Created By / Last Changed By
    UtilsSecurity.filterCreatedAndLastChanged(
      filteredChargingStation, chargingStation, loggedUser);
    return filteredChargingStation;
  }

  public static filterChargingStationsResponse(chargingStations: {result: ChargingStation[]}, loggedUser: UserToken, organizationIsActive: boolean): void {
    const filteredChargingStations = [];
    // Check
    if (!chargingStations.result) {
      return null;
    }
    if (!Authorizations.canListChargingStations(loggedUser)) {
      return null;
    }
    for (const chargingStation of chargingStations.result) {
      // Filter
      const filteredChargingStation = ChargingStationSecurity.filterChargingStationResponse(chargingStation, loggedUser, organizationIsActive);
      if (filteredChargingStation) {
        filteredChargingStations.push(filteredChargingStation);
      }
    }
    chargingStations.result = filteredChargingStations;
  }

  public static filterStatusNotificationsResponse(statusNotifications, loggedUser: UserToken) {
    // Check
    if (!Authorizations.canListChargingStations(loggedUser)) {
      return null;
    }
    return statusNotifications;
  }

  public static filterBootNotificationsResponse(statusNotifications, loggedUser: UserToken) {
    // Check
    if (!Authorizations.canListChargingStations(loggedUser)) {
      return null;
    }
    return statusNotifications;
  }

  public static filterChargingStationConfigurationRequest(request: HttpChargingStationRequest): HttpChargingStationRequest {
    return { ChargeBoxID: sanitize(request.ChargeBoxID) };
  }

  public static filterChargingStationRequest(request: HttpByIDRequest): HttpByIDRequest {
    return { ID: sanitize(request.ID) };
  }

  public static filterChargingStationByIDRequest(request: HttpByIDRequest): string {
    return sanitize(request.ID);
  }

  public static filterChargingStationsRequest(request: HttpChargingStationsRequest): HttpChargingStationsRequest {
    const filteredRequest: HttpChargingStationsRequest = {} as HttpChargingStationsRequest;
    filteredRequest.Search = sanitize(request.Search);
    filteredRequest.WithNoSiteArea = UtilsSecurity.filterBoolean(request.WithNoSiteArea);
    filteredRequest.SiteID = sanitize(request.SiteID);
    filteredRequest.WithSite = UtilsSecurity.filterBoolean(request.WithSite);
    filteredRequest.SiteAreaID = sanitize(request.SiteAreaID);
    filteredRequest.IncludeDeleted = UtilsSecurity.filterBoolean(request.IncludeDeleted);
    filteredRequest.ErrorType = sanitize(request.ErrorType);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterNotificationsRequest(request: HttpDatabaseRequest, loggedUser: UserToken): HttpDatabaseRequest {
    let filteredRequest: HttpDatabaseRequest = {} as HttpDatabaseRequest;
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterChargingStationParamsUpdateRequest(request: Partial<ChargingStation>, loggedUser: UserToken): Partial<ChargingStation> {
    // Set
    const filteredRequest: any = {};
    filteredRequest.id = sanitize(request.id);
    if (request.hasOwnProperty('chargingStationURL')) {
      filteredRequest.chargingStationURL = sanitize(request.chargingStationURL);
    }
    if (request.hasOwnProperty('numberOfConnectedPhase')) {
      filteredRequest.numberOfConnectedPhase = sanitize(request.numberOfConnectedPhase);
    }
    if (request.hasOwnProperty('maximumPower')) {
      filteredRequest.maximumPower = sanitize(request.maximumPower);
    }
    if (request.hasOwnProperty('cannotChargeInParallel')) {
      filteredRequest.cannotChargeInParallel = UtilsSecurity.filterBoolean(request.cannotChargeInParallel);
    }
    if (request.hasOwnProperty('siteArea')) {
      filteredRequest.siteArea = sanitize(request.siteArea);
    }
    if (request.hasOwnProperty('powerLimitUnit')) {
      filteredRequest.powerLimitUnit = sanitize(request.powerLimitUnit);
    }
    if (request.hasOwnProperty('latitude')) {
      filteredRequest.latitude = sanitize(request.latitude);
    }
    if (request.hasOwnProperty('longitude')) {
      filteredRequest.longitude = sanitize(request.longitude);
    }
    if (request.connectors) {
      // Filter
      filteredRequest.connectors = request.connectors.map((connector) => {
        if (!connector) {
          return connector;
        }
        return {
          connectorId: sanitize(connector.connectorId),
          power: sanitize(connector.power),
          type: sanitize(connector.type),
          voltage: sanitize(connector.voltage),
          amperage: sanitize(connector.amperage)
        };
      });
    }
    return filteredRequest;
  }

  public static filterChargingStationActionRequest(request: HttpChargingStationCommandRequest, action: string, loggedUser: UserToken): HttpChargingStationCommandRequest {
    const filteredRequest: any = {} as HttpChargingStationCommandRequest;
    // Check
    filteredRequest.chargeBoxID = sanitize(request.chargeBoxID);
    // Do not check action?
    filteredRequest.args = request.args;
    return filteredRequest;
  }

  public static filterChargingStationSetMaxIntensitySocketRequest(request: HttpChargingStationSetMaxIntensitySocketRequest): HttpChargingStationSetMaxIntensitySocketRequest {
    return {
      chargeBoxID: sanitize(request.chargeBoxID),
      maxIntensity: request.args ? sanitize(request.args.maxIntensity) : null
    };
  }
}

