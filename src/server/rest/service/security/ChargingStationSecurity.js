const sanitize = require('mongo-sanitize');
const Authorizations = require('../../../../authorization/Authorizations');
const UtilsSecurity = require('./UtilsSecurity');
let SiteAreaSecurity; // Avoid circular deps

class ChargingStationSecurity {
  static getSiteAreaSecurity() {
    if (!SiteAreaSecurity) {
      SiteAreaSecurity = require('./SiteAreaSecurity');
    }
    return SiteAreaSecurity;
  }

  // eslint-disable-next-line no-unused-vars
  static filterAddChargingStationsToSiteAreaRequest(request, loggedUser) {
    const filteredRequest = {};
    // Set
    filteredRequest.siteAreaID = sanitize(request.siteAreaID);
    if (request.chargingStationIDs) {
      filteredRequest.chargingStationIDs = request.chargingStationIDs.map(chargingStationID => sanitize(chargingStationID));
    }
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterRemoveChargingStationsFromSiteAreaRequest(request, loggedUser) {
    const filteredRequest = {};
    // Set
    filteredRequest.siteAreaID = sanitize(request.siteAreaID);
    if (request.chargingStationIDs) {
      filteredRequest.chargingStationIDs = request.chargingStationIDs.map(chargingStationID => sanitize(chargingStationID));
    }
    return filteredRequest;
  }

  // Charging Station
  static filterChargingStationResponse(chargingStation, loggedUser) {
    let filteredChargingStation;

    if (!chargingStation) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadChargingStation(loggedUser, chargingStation)) {
      // Admin?
      if (Authorizations.isAdmin(loggedUser)) {
        // Yes: set all params
        filteredChargingStation = chargingStation;
      } else {
        // Set only necessary info
        filteredChargingStation = {};
        filteredChargingStation.id = chargingStation.id;
        filteredChargingStation.chargeBoxID = chargingStation.chargeBoxID;
        filteredChargingStation.connectors = chargingStation.connectors.map((connector) => {
          return {
            'activeTransactionID': connector.activeTransactionID,
            'connectorId': connector.connectorId,
            'currentConsumption': connector.currentConsumption,
            'currentStateOfCharge': connector.currentStateOfCharge,
            'errorCode': connector.errorCode,
            'type': connector.type,
            'power': connector.power,
            'status': connector.status,
            'totalConsumption': connector.totalConsumption
          };
        });
        filteredChargingStation.lastHeartBeat = chargingStation.lastHeartBeat;
        filteredChargingStation.inactive = chargingStation.inactive;
        filteredChargingStation.maximumPower = chargingStation.maximumPower;
        filteredChargingStation.chargePointVendor = chargingStation.chargePointVendor;
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

  static filterChargingStationsResponse(chargingStations, loggedUser) {
    const filteredChargingStations = [];

    // Check
    if (!chargingStations) {
      return null;
    }
    if (!Authorizations.canListChargingStations(loggedUser)) {
      return null;
    }
    for (const chargingStation of chargingStations) {
      // Filter
      const filteredChargingStation = ChargingStationSecurity.filterChargingStationResponse(chargingStation, loggedUser);
      // Ok?
      if (filteredChargingStation) {
        // Add
        filteredChargingStations.push(filteredChargingStation);
      }
    }
    return filteredChargingStations;
  }

  // eslint-disable-next-line no-unused-vars
  static filterChargingStationDeleteRequest(request, loggedUser) {
    const filteredRequest = {};
    // Set
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterChargingStationConfigurationRequest(request, loggedUser) {
    const filteredRequest = {};
    // Set
    filteredRequest.ChargeBoxID = sanitize(request.ChargeBoxID);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterChargingStationRequest(request, loggedUser) {
    const filteredRequest = {};
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterChargingStationsRequest(request, loggedUser) {
    const filteredRequest = {};
    filteredRequest.Search = sanitize(request.Search);
    filteredRequest.WithNoSiteArea = UtilsSecurity.filterBoolean(request.WithNoSiteArea);
    filteredRequest.SiteID = sanitize(request.SiteID);
    filteredRequest.WithSite = UtilsSecurity.filterBoolean(request.WithSite);
    filteredRequest.ChargeBoxID = sanitize(request.ChargeBoxID);
    filteredRequest.SiteAreaID = sanitize(request.SiteAreaID);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterChargingStationParamsUpdateRequest(request, loggedUser) {
    // Set
    const filteredRequest = {};
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
    if (request.connectors) {
      // Filter
      filteredRequest.connectors = request.connectors.map((connector) => {
        return { 
          connectorId: sanitize(connector.connectorId),
          power: sanitize(connector.power),
          type: sanitize(connector.type)
        };
      });
    }
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterChargingStationActionRequest(request, action, loggedUser) {
    const filteredRequest = {};
    // Check
    filteredRequest.chargeBoxID = sanitize(request.chargeBoxID);
    // Do not check action?
    filteredRequest.args =  request.args;
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterChargingStationSetMaxIntensitySocketRequest(request, loggedUser) {
    const filteredRequest = {};
    // Check
    filteredRequest.chargeBoxID = sanitize(request.chargeBoxID);
    filteredRequest.maxIntensity =  sanitize(request.args.maxIntensity);
    return filteredRequest;
  }
}

module.exports = ChargingStationSecurity;
