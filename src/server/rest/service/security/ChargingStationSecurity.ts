import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import Constants from '../../../../utils/Constants';
import UtilsSecurity from './UtilsSecurity';

export default class ChargingStationSecurity {

  // eslint-disable-next-line no-unused-vars
  static filterAddChargingStationsToSiteAreaRequest(request, loggedUser) {
    const filteredRequest: any = {};
    // Set
    filteredRequest.siteAreaID = sanitize(request.siteAreaID);
    if (request.chargingStationIDs) {
      filteredRequest.chargingStationIDs = request.chargingStationIDs.map((chargingStationID) => {
        return sanitize(chargingStationID);
      });
    }
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterRemoveChargingStationsFromSiteAreaRequest(request, loggedUser) {
    const filteredRequest: any = {};
    // Set
    filteredRequest.siteAreaID = sanitize(request.siteAreaID);
    if (request.chargingStationIDs) {
      filteredRequest.chargingStationIDs = request.chargingStationIDs.map((chargingStationID) => {
        return sanitize(chargingStationID);
      });
    }
    return filteredRequest;
  }

  // Charging Station
  static filterChargingStationResponse(chargingStation, loggedUser, organizationIsActive) {
    let filteredChargingStation;

    if (!chargingStation) {
      return null;
    }
    // Check organization
    if (organizationIsActive && !Authorizations.isAdmin(loggedUser.role) && (!chargingStation.siteArea || !Authorizations.canReadSite(loggedUser, chargingStation.siteArea.siteID))) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadChargingStation(loggedUser)) {
      // Admin?
      if (Authorizations.isAdmin(loggedUser.role)) {
        // Yes: set all params
        filteredChargingStation = chargingStation;
        for (const connector of filteredChargingStation.connectors) {
          if (filteredChargingStation.inactive) {
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
        filteredChargingStation.chargeBoxID = chargingStation.chargeBoxID;
        filteredChargingStation.inactive = chargingStation.inactive;
        filteredChargingStation.connectors = chargingStation.connectors.map((connector) => {
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
    }
    return filteredChargingStation;
  }

  static filterChargingStationsResponse(chargingStations, loggedUser, organizationIsActive) {
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
      // Ok?
      if (filteredChargingStation) {
        // Add
        filteredChargingStations.push(filteredChargingStation);
      }
    }
    chargingStations.result = filteredChargingStations;
  }

  static filterStatusNotificationsResponse(statusNotifications, loggedUser) {
    // Check
    if (!Authorizations.canListChargingStations(loggedUser)) {
      return null;
    }
    return statusNotifications;
  }

  static filterBootNotificationsResponse(statusNotifications, loggedUser) {
    // Check
    if (!Authorizations.canListChargingStations(loggedUser)) {
      return null;
    }
    return statusNotifications;
  }

  // eslint-disable-next-line no-unused-vars
  static filterChargingStationDeleteRequest(request, loggedUser) {
    const filteredRequest: any = {};
    // Set
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterChargingStationConfigurationRequest(request, loggedUser) {
    const filteredRequest: any = {};
    // Set
    filteredRequest.ChargeBoxID = sanitize(request.ChargeBoxID);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterChargingStationRequest(request, loggedUser) {
    const filteredRequest: any = {};
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterChargingStationsRequest(request, loggedUser) {
    const filteredRequest: any = {};
    filteredRequest.Search = sanitize(request.Search);
    filteredRequest.WithNoSiteArea = UtilsSecurity.filterBoolean(request.WithNoSiteArea);
    filteredRequest.SiteID = sanitize(request.SiteID);
    filteredRequest.WithSite = UtilsSecurity.filterBoolean(request.WithSite);
    filteredRequest.ChargeBoxID = sanitize(request.ChargeBoxID);
    filteredRequest.SiteAreaID = sanitize(request.SiteAreaID);
    filteredRequest.IncludeDeleted = UtilsSecurity.filterBoolean(request.IncludeDeleted);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterChargingStationsInErrorRequest(request, loggedUser) {
    const filteredRequest: any = {};
    filteredRequest.Search = sanitize(request.Search);
    filteredRequest.WithNoSiteArea = UtilsSecurity.filterBoolean(request.WithNoSiteArea);
    filteredRequest.SiteID = sanitize(request.SiteID);
    filteredRequest.WithSite = UtilsSecurity.filterBoolean(request.WithSite);
    filteredRequest.ChargeBoxID = sanitize(request.ChargeBoxID);
    filteredRequest.SiteAreaID = sanitize(request.SiteAreaID);
    filteredRequest.ErrorType = sanitize(request.ErrorType);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterStatusNotificationsRequest(request, loggedUser) {
    const filteredRequest: any = {};
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterBootNotificationsRequest(request, loggedUser) {
    const filteredRequest: any = {};
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterChargingStationParamsUpdateRequest(request, loggedUser) {
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

  // eslint-disable-next-line no-unused-vars
  static filterChargingStationActionRequest(request, action, loggedUser) {
    const filteredRequest: any = {};
    // Check
    filteredRequest.chargeBoxID = sanitize(request.chargeBoxID);
    // Do not check action?
    filteredRequest.args = request.args;
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterChargingStationSetMaxIntensitySocketRequest(request, loggedUser) {
    const filteredRequest: any = {};
    // Check
    filteredRequest.chargeBoxID = sanitize(request.chargeBoxID);
    filteredRequest.maxIntensity = sanitize(request.args.maxIntensity);
    return filteredRequest;
  }
}

