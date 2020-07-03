import { ChargePointStatus, OCPPBootNotificationRequestExtended, OCPPStatusNotificationRequestExtended } from '../../../../types/ocpp/OCPPServer';
import { ChargingProfile, ChargingSchedule, ChargingSchedulePeriod, Profile } from '../../../../types/ChargingProfile';
import ChargingStation, { Command } from '../../../../types/ChargingStation';
import { HttpChargingProfilesRequest, HttpChargingStationCommandRequest, HttpChargingStationGetFirmwareRequest, HttpChargingStationLimitPowerRequest, HttpChargingStationOcppParametersRequest, HttpChargingStationParamsUpdateRequest, HttpChargingStationRequest, HttpChargingStationSetMaxIntensitySocketRequest, HttpChargingStationsRequest, HttpIsAuthorizedRequest, HttpTriggerSmartChargingRequest } from '../../../../types/requests/HttpChargingStationRequest';

import Authorizations from '../../../../authorization/Authorizations';
import { ChargingStationInError } from '../../../../types/InError';
import { DataResult } from '../../../../types/DataResult';
import HttpByIDRequest from '../../../../types/requests/HttpByIDRequest';
import HttpDatabaseRequest from '../../../../types/requests/HttpDatabaseRequest';
import SiteAreaSecurity from './SiteAreaSecurity';
import TenantComponents from '../../../../types/TenantComponents';
import UserSecurity from './UserSecurity';
import UserToken from '../../../../types/UserToken';
import Utils from '../../../../utils/Utils';
import UtilsSecurity from './UtilsSecurity';
import sanitize from 'mongo-sanitize';

export default class ChargingStationSecurity {

  public static filterChargingStationLimitPowerRequest(request: any): HttpChargingStationLimitPowerRequest {
    return {
      chargeBoxID: sanitize(request.chargeBoxID),
      chargePointID: sanitize(request.chargePointID),
      ampLimitValue: sanitize(request.ampLimitValue),
      forceUpdateChargingPlan: UtilsSecurity.filterBoolean(request.forceUpdateChargingPlan),
    };
  }

  public static filterChargingStationResponse(chargingStation: ChargingStation, loggedUser: UserToken): ChargingStation | ChargingStationInError {
    let filteredChargingStation: ChargingStation;
    if (!chargingStation) {
      return null;
    }
    const siteID = chargingStation.siteArea ? chargingStation.siteArea.siteID : null;
    if (Utils.isComponentActiveFromToken(loggedUser, TenantComponents.ORGANIZATION) &&
      !Authorizations.canReadSiteArea(loggedUser, siteID)) {
      return null;
    }
    // Check connectors
    Utils.checkAndUpdateConnectorsStatus(chargingStation);
    // Check Auth
    if (Authorizations.canReadChargingStation(loggedUser)) {
      filteredChargingStation = {} as ChargingStation;
      if (Authorizations.canUpdateChargingStation(loggedUser, siteID)) {
        filteredChargingStation.capabilities = chargingStation.capabilities;
        filteredChargingStation.firmwareUpdateStatus = chargingStation.firmwareUpdateStatus;
        filteredChargingStation.firmwareVersion = chargingStation.firmwareVersion;
        filteredChargingStation.ocppProtocol = chargingStation.ocppProtocol;
        filteredChargingStation.ocppVersion = chargingStation.ocppVersion;
        filteredChargingStation.chargeBoxSerialNumber = chargingStation.chargeBoxSerialNumber;
        filteredChargingStation.chargePointSerialNumber = chargingStation.chargePointSerialNumber;
        filteredChargingStation.ocppProtocol = chargingStation.ocppProtocol;
        filteredChargingStation.ocppVersion = chargingStation.ocppVersion;
        filteredChargingStation.chargingStationURL = chargingStation.chargingStationURL;
        filteredChargingStation.currentIPAddress = chargingStation.currentIPAddress;
        filteredChargingStation.currentServerLocalIPAddressPort = chargingStation.currentServerLocalIPAddressPort;
        filteredChargingStation.endpoint = chargingStation.endpoint;
        filteredChargingStation.ocppStandardParameters = chargingStation.ocppStandardParameters;
        filteredChargingStation.ocppVendorParameters = chargingStation.ocppVendorParameters;
        filteredChargingStation.voltage = chargingStation.voltage;
      }
      filteredChargingStation.id = chargingStation.id;
      filteredChargingStation.inactive = chargingStation.inactive;
      filteredChargingStation.powerLimitUnit = chargingStation.powerLimitUnit;
      filteredChargingStation.lastReboot = chargingStation.lastReboot;
      filteredChargingStation.lastHeartBeat = chargingStation.lastHeartBeat;
      filteredChargingStation.maximumPower = chargingStation.maximumPower;
      filteredChargingStation.chargePointVendor = chargingStation.chargePointVendor;
      filteredChargingStation.chargePointModel = chargingStation.chargePointModel;
      filteredChargingStation.siteAreaID = chargingStation.siteAreaID;
      filteredChargingStation.coordinates = chargingStation.coordinates;
      if (chargingStation.ocpiData) {
        filteredChargingStation.ocpiData = chargingStation.ocpiData;
      }
      filteredChargingStation.connectors = chargingStation.connectors.map((connector) => {
        if (!connector) {
          return connector;
        }
        return {
          id: connector.id,
          connectorId: connector.connectorId,
          status: (filteredChargingStation.inactive ? ChargePointStatus.UNAVAILABLE : connector.status),
          currentInstantWatts: (filteredChargingStation.inactive ? 0 : connector.currentInstantWatts),
          currentStateOfCharge: (filteredChargingStation.inactive ? 0 : connector.currentStateOfCharge),
          currentTotalConsumptionWh: (filteredChargingStation.inactive ? 0 : connector.currentTotalConsumptionWh),
          currentTotalInactivitySecs: (filteredChargingStation.inactive ? 0 : connector.currentTotalInactivitySecs),
          currentInactivityStatus: connector.currentInactivityStatus,
          currentTransactionID: connector.currentTransactionID,
          currentTransactionDate: connector.currentTransactionDate,
          currentTagID: connector.currentTagID,
          errorCode: connector.errorCode,
          type: connector.type,
          power: connector.power,
          numberOfConnectedPhase: connector.numberOfConnectedPhase,
          currentType: connector.currentType,
          voltage: connector.voltage,
          amperage: connector.amperage,
          user: UserSecurity.filterMinimalUserResponse(connector.user, loggedUser)
        };
      });
      if (chargingStation.chargePoints) {
        filteredChargingStation.chargePoints = chargingStation.chargePoints.map((chargePoint) => {
          if (!chargePoint) {
            return chargePoint;
          }
          return {
            chargePointID: chargePoint.chargePointID,
            currentType: chargePoint.currentType,
            voltage: chargePoint.voltage,
            amperage: chargePoint.amperage,
            numberOfConnectedPhase: chargePoint.numberOfConnectedPhase,
            cannotChargeInParallel: chargePoint.cannotChargeInParallel,
            sharePowerToAllConnectors: chargePoint.sharePowerToAllConnectors,
            excludeFromPowerLimitation: chargePoint.excludeFromPowerLimitation,
            ocppParamForPowerLimitation: chargePoint.ocppParamForPowerLimitation,
            power: chargePoint.power,
            efficiency: chargePoint.efficiency,
            connectorIDs: chargePoint.connectorIDs
          };
        });
      }
    }
    if (chargingStation.siteArea) {
      filteredChargingStation.siteArea = SiteAreaSecurity.filterSiteAreaResponse(chargingStation.siteArea, loggedUser);
    }
    // Sort Connector
    filteredChargingStation.connectors.sort(
      (connector1, connector2) => connector1.connectorId - connector2.connectorId);
    // Created By / Last Changed By
    UtilsSecurity.filterCreatedAndLastChanged(
      filteredChargingStation, chargingStation, loggedUser);
    return filteredChargingStation;
  }

  public static filterMinimalChargingStationResponse(chargingStation: ChargingStation, loggedUser: UserToken): ChargingStation | ChargingStationInError {
    let filteredChargingStation: ChargingStation;
    if (!chargingStation) {
      return null;
    }
    const siteID = chargingStation.siteArea ? chargingStation.siteArea.siteID : null;
    if (Utils.isComponentActiveFromToken(loggedUser, TenantComponents.ORGANIZATION) &&
      !Authorizations.canReadSiteArea(loggedUser, siteID)) {
      return null;
    }
    // Check connectors
    Utils.checkAndUpdateConnectorsStatus(chargingStation);
    // Check Auth
    if (Authorizations.canReadChargingStation(loggedUser)) {
      filteredChargingStation = {} as ChargingStation;
      filteredChargingStation.id = chargingStation.id;
    }
    if (chargingStation.siteArea) {
      filteredChargingStation.siteArea = SiteAreaSecurity.filterMinimalSiteAreaResponse(chargingStation.siteArea, loggedUser);
    }
    return filteredChargingStation;
  }

  public static filterChargingStationsResponse(chargingStations: DataResult<ChargingStation>,
    loggedUser: UserToken) {
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
      const filteredChargingStation = ChargingStationSecurity.filterChargingStationResponse(
        chargingStation, loggedUser);
      if (filteredChargingStation) {
        filteredChargingStations.push(filteredChargingStation);
      }
    }
    chargingStations.result = filteredChargingStations;
  }

  public static filterChargingProfilesResponse(chargingProfiles: DataResult<ChargingProfile>, loggedUser: UserToken): void {
    const filteredChargingProfiles: ChargingProfile[] = [];
    // Check
    if (!chargingProfiles.result) {
      return null;
    }
    if (!Authorizations.canListChargingProfiles(loggedUser)) {
      return null;
    }
    for (const chargingProfile of chargingProfiles.result) {
      const filteredChargingProfile = this.filterChargingProfileResponse(chargingProfile, loggedUser);
      if (filteredChargingProfile) {
        filteredChargingProfiles.push(filteredChargingProfile);
      }
    }
    chargingProfiles.result = filteredChargingProfiles;
  }

  static filterChargingProfileResponse(chargingProfile: ChargingProfile, loggedUser: UserToken): ChargingProfile {
    const filteredChargingProfile = {} as ChargingProfile;
    if (!chargingProfile) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadChargingProfile(loggedUser)) {
      filteredChargingProfile.id = chargingProfile.id;
      filteredChargingProfile.chargingStationID = chargingProfile.chargingStationID;
      filteredChargingProfile.chargePointID = chargingProfile.chargePointID;
      filteredChargingProfile.connectorID = chargingProfile.connectorID;
      filteredChargingProfile.chargingStation = chargingProfile.chargingStation;
      if (filteredChargingProfile.chargingStation) {
        filteredChargingProfile.chargingStation =
          ChargingStationSecurity.filterMinimalChargingStationResponse(chargingProfile.chargingStation, loggedUser);
      }
      filteredChargingProfile.profile = {} as Profile;
      filteredChargingProfile.profile.chargingProfileId = chargingProfile.profile.chargingProfileId;
      filteredChargingProfile.profile.transactionId = chargingProfile.profile.transactionId;
      filteredChargingProfile.profile.stackLevel = chargingProfile.profile.stackLevel;
      filteredChargingProfile.profile.chargingProfilePurpose = chargingProfile.profile.chargingProfilePurpose;
      filteredChargingProfile.profile.chargingProfileKind = chargingProfile.profile.chargingProfileKind;
      filteredChargingProfile.profile.recurrencyKind = chargingProfile.profile.recurrencyKind;
      filteredChargingProfile.profile.validFrom = chargingProfile.profile.validFrom;
      filteredChargingProfile.profile.validTo = chargingProfile.profile.validTo;
      if (Utils.objectHasProperty(chargingProfile.profile, 'chargingSchedule')) {
        const chargingSchedule = {} as ChargingSchedule;
        filteredChargingProfile.profile.chargingSchedule = chargingSchedule;
        chargingSchedule.duration = chargingProfile.profile.chargingSchedule.duration;
        chargingSchedule.startSchedule = chargingProfile.profile.chargingSchedule.startSchedule;
        chargingSchedule.chargingRateUnit = chargingProfile.profile.chargingSchedule.chargingRateUnit;
        chargingSchedule.minChargeRate = chargingProfile.profile.chargingSchedule.minChargeRate;
        filteredChargingProfile.profile.chargingSchedule.chargingSchedulePeriod = [];
        // Check
        for (const chargingSchedulePeriod of chargingProfile.profile.chargingSchedule.chargingSchedulePeriod) {
          const chargingSchedulePeriodNew: ChargingSchedulePeriod = {} as ChargingSchedulePeriod;
          chargingSchedulePeriodNew.startPeriod = sanitize(chargingSchedulePeriod.startPeriod);
          chargingSchedulePeriodNew.limit = sanitize(chargingSchedulePeriod.limit);
          chargingSchedulePeriodNew.numberPhases = sanitize(chargingSchedulePeriod.numberPhases);
          // Add
          filteredChargingProfile.profile.chargingSchedule.chargingSchedulePeriod.push(chargingSchedulePeriodNew);
        }
      }
    }
    return filteredChargingProfile;
  }

  public static filterStatusNotificationsResponse(statusNotifications: OCPPStatusNotificationRequestExtended[],
    loggedUser: UserToken): OCPPStatusNotificationRequestExtended[] {
    // Check
    if (!Authorizations.canListChargingStations(loggedUser)) {
      return [];
    }
    return statusNotifications;
  }

  public static filterBootNotificationsResponse(bootNotifications: OCPPBootNotificationRequestExtended[],
    loggedUser: UserToken): OCPPBootNotificationRequestExtended[] {
    // Check
    if (!Authorizations.canListChargingStations(loggedUser)) {
      return [];
    }
    return bootNotifications;
  }

  public static filterChargingStationOcppParametersRequest(request: any): HttpChargingStationRequest {
    return { ChargeBoxID: sanitize(request.ChargeBoxID) };
  }

  public static filterChargingProfilesRequest(request: any): HttpChargingProfilesRequest {
    const filteredRequest: HttpChargingProfilesRequest = {} as HttpChargingProfilesRequest;
    filteredRequest.Search = sanitize(request.Search),
    filteredRequest.ChargeBoxID = sanitize(request.ChargeBoxID);
    filteredRequest.ConnectorID = sanitize(request.ConnectorID);
    filteredRequest.WithChargingStation = UtilsSecurity.filterBoolean(request.WithChargingStation);
    filteredRequest.WithSiteArea = UtilsSecurity.filterBoolean(request.WithSiteArea);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterTriggerSmartCharging(request: any): HttpTriggerSmartChargingRequest {
    return {
      siteAreaID: sanitize(request.SiteAreaID)
    };
  }

  public static filterRequestChargingStationOcppParametersRequest(request: any): HttpChargingStationOcppParametersRequest {
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

  public static filterChargingProfileRequestByID(request: any): string {
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
    filteredRequest.ConnectorStatus = sanitize(request.ConnectorStatus);
    filteredRequest.ConnectorType = sanitize(request.ConnectorType);
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

  public static filterChargingStationParamsUpdateRequest(request: any): HttpChargingStationParamsUpdateRequest {
    const filteredRequest = {} as HttpChargingStationParamsUpdateRequest;
    filteredRequest.id = sanitize(request.id);
    if (Utils.objectHasProperty(request, 'chargingStationURL')) {
      filteredRequest.chargingStationURL = sanitize(request.chargingStationURL);
    }
    if (Utils.objectHasProperty(request, 'maximumPower')) {
      filteredRequest.maximumPower = sanitize(request.maximumPower);
    }
    if (Utils.objectHasProperty(request, 'excludeFromSmartCharging')) {
      filteredRequest.excludeFromSmartCharging = UtilsSecurity.filterBoolean(request.excludeFromSmartCharging);
    }
    if (Utils.objectHasProperty(request, 'public')) {
      filteredRequest.public = UtilsSecurity.filterBoolean(request.public);
    }
    if (Utils.objectHasProperty(request, 'siteAreaID')) {
      filteredRequest.siteAreaID = sanitize(request.siteAreaID);
    }
    if (request.coordinates && request.coordinates.length === 2) {
      filteredRequest.coordinates = [
        sanitize(request.coordinates[0]),
        sanitize(request.coordinates[1])
      ];
    }
    // Filter connectors
    if (request.connectors) {
      filteredRequest.connectors = request.connectors.map((connector) => {
        if (connector) {
          return {
            connectorId: sanitize(connector.connectorId),
            power: sanitize(connector.power),
            type: sanitize(connector.type),
            voltage: sanitize(connector.voltage),
            amperage: sanitize(connector.amperage),
            currentType: sanitize(connector.currentType),
            numberOfConnectedPhase: sanitize(connector.numberOfConnectedPhase)
          };
        }
        return null;
      });
    }
    return filteredRequest;
  }


  public static filterChargingProfileUpdateRequest(request: any): ChargingProfile {
    const filteredRequest: ChargingProfile = {} as ChargingProfile;
    if (Utils.objectHasProperty(request, 'id')) {
      filteredRequest.id = sanitize(request.id);
    }
    if (Utils.objectHasProperty(request, 'chargingStationID')) {
      filteredRequest.chargingStationID = sanitize(request.chargingStationID);
    }
    if (Utils.objectHasProperty(request, 'connectorID')) {
      filteredRequest.connectorID = sanitize(request.connectorID);
    }
    if (Utils.objectHasProperty(request, 'chargePointID')) {
      filteredRequest.chargePointID = sanitize(request.chargePointID);
    }
    if (Utils.objectHasProperty(request, 'profile')) {
      filteredRequest.profile = ChargingStationSecurity.filterChargingProfileRequest(request.profile);
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
      if (Utils.objectHasProperty(request.args, 'type')) {
        filteredRequest.args.type = sanitize(request.args.type);
      }
      if (Utils.objectHasProperty(request.args, 'key')) {
        filteredRequest.args.key = sanitize(request.args.key);
      }
      if (Utils.objectHasProperty(request.args, 'value')) {
        filteredRequest.args.value = sanitize(request.args.value);
      }
      if (Utils.objectHasProperty(request.args, 'connectorId')) {
        filteredRequest.args.connectorId = sanitize(request.args.connectorId);
      }
      if (Utils.objectHasProperty(request.args, 'duration')) {
        filteredRequest.args.duration = sanitize(request.args.duration);
      }
      if (Utils.objectHasProperty(request.args, 'chargingRateUnit')) {
        filteredRequest.args.chargingRateUnit = sanitize(request.args.chargingRateUnit);
      }
      if (Utils.objectHasProperty(request.args, 'chargingProfilePurpose')) {
        filteredRequest.args.chargingProfilePurpose = sanitize(request.args.chargingProfilePurpose);
      }
      if (Utils.objectHasProperty(request.args, 'stackLevel')) {
        filteredRequest.args.stackLevel = sanitize(request.args.stackLevel);
      }
      if (Utils.objectHasProperty(request.args, 'tagID')) {
        filteredRequest.args.tagID = sanitize(request.args.tagID);
      }
      if (Utils.objectHasProperty(request.args, 'location')) {
        filteredRequest.args.location = sanitize(request.args.location);
      }
      if (Utils.objectHasProperty(request.args, 'retries')) {
        filteredRequest.args.retries = sanitize(request.args.retries);
      }
      if (Utils.objectHasProperty(request.args, 'retryInterval')) {
        filteredRequest.args.retryInterval = sanitize(request.args.retryInterval);
      }
      if (Utils.objectHasProperty(request.args, 'startTime')) {
        filteredRequest.args.startTime = sanitize(request.args.startTime);
      }
      if (Utils.objectHasProperty(request.args, 'stopTime')) {
        filteredRequest.args.stopTime = sanitize(request.args.stopTime);
      }
      if (Utils.objectHasProperty(request.args, 'retrieveDate')) {
        filteredRequest.args.retrieveDate = sanitize(request.args.retrieveDate);
      }
      if (Utils.objectHasProperty(request.args, 'retryInterval')) {
        filteredRequest.args.retryInterval = sanitize(request.args.retryInterval);
      }
      if (Utils.objectHasProperty(request.args, 'transactionId')) {
        filteredRequest.args.transactionId = sanitize(request.args.transactionId);
      }
      if (Utils.objectHasProperty(request.args, 'csChargingProfiles')) {
        filteredRequest.args.csChargingProfiles = ChargingStationSecurity.filterChargingProfileRequest(request.args.csChargingProfiles);
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
    if (filteredRequest.Action === Command.REMOTE_STOP_TRANSACTION) {
      filteredRequest.Action = Command.REMOTE_STOP_TRANSACTION;
    }
    return filteredRequest;
  }

  public static filterChargingStationGetFirmwareRequest(request: any): HttpChargingStationGetFirmwareRequest {
    return {
      FileName: sanitize(request.FileName),
    };
  }

  private static filterChargingProfileRequest(request: any): Profile {
    const filteredRequest: Profile = {} as Profile;
    // Check
    if (Utils.objectHasProperty(request, 'chargingProfileId')) {
      filteredRequest.chargingProfileId = sanitize(request.chargingProfileId);
    }
    if (Utils.objectHasProperty(request, 'transactionId')) {
      filteredRequest.transactionId = sanitize(request.transactionId);
    }
    if (Utils.objectHasProperty(request, 'stackLevel')) {
      filteredRequest.stackLevel = sanitize(request.stackLevel);
    }
    if (Utils.objectHasProperty(request, 'chargingProfilePurpose')) {
      filteredRequest.chargingProfilePurpose = sanitize(request.chargingProfilePurpose);
    }
    if (Utils.objectHasProperty(request, 'chargingProfileKind')) {
      filteredRequest.chargingProfileKind = sanitize(request.chargingProfileKind);
    }
    if (Utils.objectHasProperty(request, 'recurrencyKind')) {
      filteredRequest.recurrencyKind = sanitize(request.recurrencyKind);
    }
    if (Utils.objectHasProperty(request, 'validFrom')) {
      filteredRequest.validFrom = sanitize(request.validFrom);
    }
    if (Utils.objectHasProperty(request, 'validTo')) {
      filteredRequest.validTo = sanitize(request.validTo);
    }
    if (Utils.objectHasProperty(request, 'chargingSchedule')) {
      const chargingSchedule: ChargingSchedule = {} as ChargingSchedule;
      filteredRequest.chargingSchedule = chargingSchedule;
      // Check
      if (Utils.objectHasProperty(request.chargingSchedule, 'duration')) {
        chargingSchedule.duration = sanitize(request.chargingSchedule.duration);
      }
      if (Utils.objectHasProperty(request.chargingSchedule, 'startSchedule')) {
        chargingSchedule.startSchedule = sanitize(request.chargingSchedule.startSchedule);
      }
      if (Utils.objectHasProperty(request.chargingSchedule, 'chargingRateUnit')) {
        chargingSchedule.chargingRateUnit = sanitize(request.chargingSchedule.chargingRateUnit);
      }
      if (Utils.objectHasProperty(request.chargingSchedule, 'minChargeRate')) {
        chargingSchedule.minChargeRate = sanitize(request.chargingSchedule.minChargeRate);
      }
      if (Utils.objectHasProperty(request.chargingSchedule, 'chargingSchedulePeriod')) {
        filteredRequest.chargingSchedule.chargingSchedulePeriod = [];
        // Check
        for (const chargingSchedulePeriod of request.chargingSchedule.chargingSchedulePeriod) {
          const chargingSchedulePeriodNew: ChargingSchedulePeriod = {} as ChargingSchedulePeriod;
          // Check
          if (Utils.objectHasProperty(chargingSchedulePeriod, 'startPeriod')) {
            chargingSchedulePeriodNew.startPeriod = sanitize(chargingSchedulePeriod.startPeriod);
          }
          if (Utils.objectHasProperty(chargingSchedulePeriod, 'limit')) {
            chargingSchedulePeriodNew.limit = sanitize(chargingSchedulePeriod.limit);
          }
          if (Utils.objectHasProperty(chargingSchedulePeriod, 'numberPhases')) {
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

