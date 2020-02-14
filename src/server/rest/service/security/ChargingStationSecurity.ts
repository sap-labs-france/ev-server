import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import { ChargingProfile, ChargingSchedule, ChargingSchedulePeriod, Profile } from '../../../../types/ChargingProfile';
import ChargingStation from '../../../../types/ChargingStation';
import { DataResult } from '../../../../types/DataResult';
import { ChargingStationInError } from '../../../../types/InError';
import { ChargePointStatus } from '../../../../types/ocpp/OCPPServer';
import HttpByIDRequest from '../../../../types/requests/HttpByIDRequest';
import { HttpChargingProfilesRequest, HttpAssignChargingStationToSiteAreaRequest, HttpChargingStationCommandRequest, HttpChargingStationConfigurationRequest, HttpChargingStationGetFirmwareRequest, HttpChargingStationLimitPowerRequest, HttpChargingStationRequest, HttpChargingStationSetMaxIntensitySocketRequest, HttpChargingStationsRequest, HttpIsAuthorizedRequest } from '../../../../types/requests/HttpChargingStationRequest';
import HttpDatabaseRequest from '../../../../types/requests/HttpDatabaseRequest';
import { InactivityStatus } from '../../../../types/Transaction';
import UserToken from '../../../../types/UserToken';
import Utils from '../../../../utils/Utils';
import UtilsSecurity from './UtilsSecurity';
import { filter } from 'bluebird';
import { Action } from '../../../../types/Authorization';


export default class ChargingStationSecurity {

  public static filterAssignChargingStationsToSiteAreaRequest(request: any): HttpAssignChargingStationToSiteAreaRequest {
    return {
      siteAreaID: sanitize(request.siteAreaID),
      chargingStationIDs: request.chargingStationIDs.map(sanitize)
    };
  }

  public static filterChargingStationLimitPowerRequest(request: any): HttpChargingStationLimitPowerRequest {
    return {
      chargeBoxID: sanitize(request.chargeBoxID),
      connectorId: sanitize(request.connectorId),
      ampLimitValue: sanitize(request.ampLimitValue),
    };
  }

  public static filterChargingStationResponse(chargingStation: ChargingStation, loggedUser: UserToken, organizationIsActive: boolean): ChargingStation | ChargingStationInError {
    let filteredChargingStation: ChargingStation;
    if (!chargingStation || !Authorizations.canReadChargingStation(loggedUser)) {
      return null;
    }
    const siteID = chargingStation.siteArea ? chargingStation.siteArea.siteID : null;
    if (organizationIsActive && !Authorizations.canReadSiteArea(loggedUser, siteID)) {
      return null;
    }
    // Check connectors
    Utils.checkAndUpdateConnectorsStatus(chargingStation);
    // Check Auth
    if (Authorizations.canUpdateChargingStation(loggedUser, siteID)) {
      // Yes: set all params
      filteredChargingStation = chargingStation;
      for (const connector of filteredChargingStation.connectors) {
        if (filteredChargingStation.inactive && connector) {
          connector.status = ChargePointStatus.UNAVAILABLE;
          connector.currentConsumption = 0;
          connector.totalConsumption = 0;
          connector.totalInactivitySecs = 0;
          connector.inactivityStatus = InactivityStatus.INFO;
          connector.currentStateOfCharge = 0;
        } else {
          connector.inactivityStatusLevel = Utils.getUIInactivityStatusLevel(connector.inactivityStatus);
        }
      }
    } else {
      // Set only necessary info
      filteredChargingStation = {} as ChargingStation;
      filteredChargingStation.id = chargingStation.id;
      filteredChargingStation.inactive = chargingStation.inactive;
      filteredChargingStation.connectors = chargingStation.connectors.map((connector) => {
        if (!connector) {
          return connector;
        }
        return {
          'id': connector.id,
          'connectorId': connector.connectorId,
          'status': (filteredChargingStation.inactive ? ChargePointStatus.UNAVAILABLE : connector.status),
          'currentConsumption': (filteredChargingStation.inactive ? 0 : connector.currentConsumption),
          'currentStateOfCharge': (filteredChargingStation.inactive ? 0 : connector.currentStateOfCharge),
          'totalConsumption': (filteredChargingStation.inactive ? 0 : connector.totalConsumption),
          'totalInactivitySecs': (filteredChargingStation.inactive ? 0 : connector.totalInactivitySecs),
          'inactivityStatusLevel': Utils.getUIInactivityStatusLevel(connector.inactivityStatus),
          'inactivityStatus': connector.inactivityStatus,
          'activeTransactionID': connector.activeTransactionID,
          'activeTransactionDate': connector.activeTransactionDate,
          'activeTagID': connector.activeTagID,
          'errorCode': connector.errorCode,
          'type': connector.type,
          'power': connector.power,
          'numberOfConnectedPhase': connector.numberOfConnectedPhase,
          'currentType': connector.currentType,
          'voltage': connector.voltage,
          'amperage': connector.amperage
        };
      });
      filteredChargingStation.lastHeartBeat = chargingStation.lastHeartBeat;
      filteredChargingStation.maximumPower = chargingStation.maximumPower;
      filteredChargingStation.chargePointVendor = chargingStation.chargePointVendor;
      filteredChargingStation.chargePointModel = chargingStation.chargePointModel;
      filteredChargingStation.siteAreaID = chargingStation.siteAreaID;
      filteredChargingStation.coordinates = chargingStation.coordinates;
      if (chargingStation.siteArea) {
        filteredChargingStation.siteArea = chargingStation.siteArea;
      }
    }
    // Created By / Last Changed By
    UtilsSecurity.filterCreatedAndLastChanged(
      filteredChargingStation, chargingStation, loggedUser);
    return filteredChargingStation;
  }

  public static filterChargingStationsResponse(chargingStations: DataResult<ChargingStation>, loggedUser: UserToken, organizationIsActive: boolean) {
    const filteredChargingStations: ChargingStation[] | ChargingStationInError[] = [];
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

  public static filterChargingStationConfigurationRequest(request: any): HttpChargingStationRequest {
    return { ChargeBoxID: sanitize(request.ChargeBoxID) };
  }

  public static filterChargingStationProfilesRequest(request: any): HttpChargingProfilesRequest {
    const filteredRequest: HttpChargingProfilesRequest = {} as HttpChargingProfilesRequest;
    filteredRequest.ChargeBoxID = sanitize(request.ChargeBoxID);
    filteredRequest.ConnectorID = sanitize(request.ConnectorID);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterRequestChargingStationConfigurationRequest(request: any): HttpChargingStationConfigurationRequest {
    return {
      chargeBoxID: sanitize(request.chargeBoxID),
      forceUpdateOCPPParamsFromTemplate: UtilsSecurity.filterBoolean(request.forceUpdateOCPPParamsFromTemplate)
    };
  }

  public static filterChargingStationRequest(request: any): HttpByIDRequest {
    return { ID: sanitize(request.ID) };
  }

  public static filterChargingStationRequestByID(request: any): string {
    return sanitize(request.ID);
  }

  public static filterChargingStationsRequest(request: any): HttpChargingStationsRequest {
    const filteredRequest: HttpChargingStationsRequest = {} as HttpChargingStationsRequest;
    if (request.Issuer) {
      filteredRequest.Issuer = UtilsSecurity.filterBoolean(request.Issuer);
    }
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

  public static filterNotificationsRequest(request: any): HttpDatabaseRequest {
    const filteredRequest: HttpDatabaseRequest = {} as HttpDatabaseRequest;
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterChargingStationParamsUpdateRequest(request: any): Partial<ChargingStation> {
    const filteredRequest: any = {};
    filteredRequest.id = sanitize(request.id);
    if (request.hasOwnProperty('chargingStationURL')) {
      filteredRequest.chargingStationURL = sanitize(request.chargingStationURL);
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
    if (request.hasOwnProperty('currentType')) {
      filteredRequest.currentType = sanitize(request.currentType);
    }
    if (request.coordinates && request.coordinates.length === 2) {
      filteredRequest.coordinates = [
        sanitize(request.coordinates[0]),
        sanitize(request.coordinates[1])
      ];
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
          amperage: sanitize(connector.amperage),
          currentType: sanitize(connector.currentType),
          numberOfConnectedPhase: sanitize(connector.numberOfConnectedPhase)
        };
      });
    }
    return filteredRequest;
  }


  public static filterChargingProfileUpdateRequest(request: any): ChargingProfile {
    const filteredRequest: ChargingProfile = {} as ChargingProfile;
    if (request.hasOwnProperty('chargingStationID')) {
      filteredRequest.chargingStationID = sanitize(request.chargingStationID);
    }
    if (request.hasOwnProperty('connectorID')) {
      filteredRequest.connectorID = sanitize(request.connectorID);
    }
    if (request.hasOwnProperty('profile')) {
      filteredRequest.profile = ChargingStationSecurity.filterChargingProfile(request.profile);
    }
    return filteredRequest;
  }

  public static filterChargingStationActionRequest(request: any): HttpChargingStationCommandRequest {
    const filteredRequest: HttpChargingStationCommandRequest = {} as HttpChargingStationCommandRequest;
    // Check
    filteredRequest.chargeBoxID = sanitize(request.chargeBoxID);
    // Do not check action?
    if (request.args) {
      filteredRequest.args = {};
      // Check
      if (request.args.hasOwnProperty('type')) {
        filteredRequest.args.type = sanitize(request.args.type);
      }
      if (request.args.hasOwnProperty('key')) {
        filteredRequest.args.key = sanitize(request.args.key);
      }
      if (request.args.hasOwnProperty('value')) {
        filteredRequest.args.value = sanitize(request.args.value);
      }
      if (request.args.hasOwnProperty('connectorId')) {
        filteredRequest.args.connectorId = sanitize(request.args.connectorId);
      }
      if (request.args.hasOwnProperty('duration')) {
        filteredRequest.args.duration = sanitize(request.args.duration);
      }
      if (request.args.hasOwnProperty('chargingRateUnit')) {
        filteredRequest.args.chargingRateUnit = sanitize(request.args.chargingRateUnit);
      }
      if (request.args.hasOwnProperty('chargingProfilePurpose')) {
        filteredRequest.args.chargingProfilePurpose = sanitize(request.args.chargingProfilePurpose);
      }
      if (request.args.hasOwnProperty('stackLevel')) {
        filteredRequest.args.stackLevel = sanitize(request.args.stackLevel);
      }
      if (request.args.hasOwnProperty('tagID')) {
        filteredRequest.args.tagID = sanitize(request.args.tagID);
      }
      if (request.args.hasOwnProperty('location')) {
        filteredRequest.args.location = sanitize(request.args.location);
      }
      if (request.args.hasOwnProperty('retries')) {
        filteredRequest.args.retries = sanitize(request.args.retries);
      }
      if (request.args.hasOwnProperty('retryInterval')) {
        filteredRequest.args.retryInterval = sanitize(request.args.retryInterval);
      }
      if (request.args.hasOwnProperty('startTime')) {
        filteredRequest.args.startTime = sanitize(request.args.startTime);
      }
      if (request.args.hasOwnProperty('stopTime')) {
        filteredRequest.args.stopTime = sanitize(request.args.stopTime);
      }
      if (request.args.hasOwnProperty('retrieveDate')) {
        filteredRequest.args.retrieveDate = sanitize(request.args.retrieveDate);
      }
      if (request.args.hasOwnProperty('retryInterval')) {
        filteredRequest.args.retryInterval = sanitize(request.args.retryInterval);
      }
      if (request.args.hasOwnProperty('transactionId')) {
        filteredRequest.args.transactionId = sanitize(request.args.transactionId);
      }
      if (request.args.hasOwnProperty('csChargingProfiles')) {
        filteredRequest.args.csChargingProfiles = ChargingStationSecurity.filterChargingProfile(request.args.csChargingProfiles);
      }
    }
    return filteredRequest;
  }

  public static filterChargingStationSetMaxIntensitySocketRequest(request: any): HttpChargingStationSetMaxIntensitySocketRequest {
    return {
      chargeBoxID: sanitize(request.chargeBoxID),
      maxIntensity: request.args ? sanitize(request.args.maxIntensity) : null
    };
  }

  public static filterIsAuthorizedRequest(request: any): HttpIsAuthorizedRequest {
    const filteredRequest: HttpIsAuthorizedRequest = {
      Action: sanitize(request.Action),
      Arg1: sanitize(request.Arg1),
      Arg2: sanitize(request.Arg2),
      Arg3: sanitize(request.Arg3)
    };
    if (filteredRequest.Action === Action.REMOTE_STOP_TRANSACTION) {
      filteredRequest.Action = Action.REMOTE_STOP_TRANSACTION;
    }
    return filteredRequest;
  }

  public static filterChargingStationGetFirmwareRequest(request: any): HttpChargingStationGetFirmwareRequest {
    return {
      FileName: sanitize(request.FileName),
    };
  }

  private static filterChargingProfile(request: any): Profile {
    const filteredRequest: Profile = {} as Profile;
    // Check
    if (request.hasOwnProperty('chargingProfileId')) {
      filteredRequest.chargingProfileId = sanitize(request.chargingProfileId);
    }
    if (request.hasOwnProperty('transactionId')) {
      filteredRequest.transactionId = sanitize(request.transactionId);
    }
    if (request.hasOwnProperty('stackLevel')) {
      filteredRequest.stackLevel = sanitize(request.stackLevel);
    }
    if (request.hasOwnProperty('chargingProfilePurpose')) {
      filteredRequest.chargingProfilePurpose = sanitize(request.chargingProfilePurpose);
    }
    if (request.hasOwnProperty('chargingProfileKind')) {
      filteredRequest.chargingProfileKind = sanitize(request.chargingProfileKind);
    }
    if (request.hasOwnProperty('recurrencyKind')) {
      filteredRequest.recurrencyKind = sanitize(request.recurrencyKind);
    }
    if (request.hasOwnProperty('validFrom')) {
      filteredRequest.validFrom = sanitize(request.validFrom);
    }
    if (request.hasOwnProperty('validTo')) {
      filteredRequest.validTo = sanitize(request.validTo);
    }
    if (request.hasOwnProperty('chargingSchedule')) {
      const chargingSchedule: ChargingSchedule = {} as ChargingSchedule;
      filteredRequest.chargingSchedule = chargingSchedule;
      // Check
      if (request.chargingSchedule.hasOwnProperty('duration')) {
        chargingSchedule.duration = sanitize(request.chargingSchedule.duration);
      }
      if (request.chargingSchedule.hasOwnProperty('startSchedule')) {
        chargingSchedule.startSchedule = sanitize(request.chargingSchedule.startSchedule);
      }
      if (request.chargingSchedule.hasOwnProperty('chargingRateUnit')) {
        chargingSchedule.chargingRateUnit = sanitize(request.chargingSchedule.chargingRateUnit);
      }
      if (request.chargingSchedule.hasOwnProperty('minChargeRate')) {
        chargingSchedule.minChargeRate = sanitize(request.chargingSchedule.minChargeRate);
      }
      if (request.chargingSchedule.hasOwnProperty('chargingSchedulePeriod')) {
        filteredRequest.chargingSchedule.chargingSchedulePeriod = [];
        // Check
        for (const chargingSchedulePeriod of request.chargingSchedule.chargingSchedulePeriod) {
          const chargingSchedulePeriodNew: ChargingSchedulePeriod = {} as ChargingSchedulePeriod;
          // Check
          if (chargingSchedulePeriod.hasOwnProperty('startPeriod')) {
            chargingSchedulePeriodNew.startPeriod = sanitize(chargingSchedulePeriod.startPeriod);
          }
          if (chargingSchedulePeriod.hasOwnProperty('limit')) {
            chargingSchedulePeriodNew.limit = sanitize(chargingSchedulePeriod.limit);
          }
          if (chargingSchedulePeriod.hasOwnProperty('numberPhases')) {
            chargingSchedulePeriodNew.numberPhases = sanitize(chargingSchedulePeriod.numberPhases);
          }
          // Add
          filteredRequest.chargingSchedule.chargingSchedulePeriod.push(chargingSchedulePeriodNew);
        }
      }
    }
    return filteredRequest;
  }


}

