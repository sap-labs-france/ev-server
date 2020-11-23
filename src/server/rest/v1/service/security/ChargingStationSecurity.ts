import { ChargingProfile, ChargingSchedule, ChargingSchedulePeriod, Profile } from '../../../../../types/ChargingProfile';
import { HttpChargingProfilesRequest, HttpChargingStationCommandRequest, HttpChargingStationGetFirmwareRequest, HttpChargingStationLimitPowerRequest, HttpChargingStationOcppParametersRequest, HttpChargingStationParamsUpdateRequest, HttpChargingStationRequest, HttpChargingStationSetMaxIntensitySocketRequest, HttpChargingStationsRequest, HttpIsAuthorizedRequest, HttpTriggerSmartChargingRequest } from '../../../../../types/requests/HttpChargingStationRequest';

import { Command } from '../../../../../types/ChargingStation';
import HttpByIDRequest from '../../../../../types/requests/HttpByIDRequest';
import HttpDatabaseRequest from '../../../../../types/requests/HttpDatabaseRequest';
import Utils from '../../../../../utils/Utils';
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
    filteredRequest.SiteID = sanitize(request.SiteID);
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
    if (Utils.containsGPSCoordinates([request.LocLongitude, request.LocLatitude])) {
      filteredRequest.LocCoordinates = [
        Utils.convertToFloat(sanitize(request.LocLongitude)),
        Utils.convertToFloat(sanitize(request.LocLatitude))
      ];
      if (request.LocMaxDistanceMeters) {
        request.LocMaxDistanceMeters = Utils.convertToInt(sanitize(request.LocMaxDistanceMeters));
        if (request.LocMaxDistanceMeters > 0) {
          filteredRequest.LocMaxDistanceMeters = request.LocMaxDistanceMeters;
        }
      }
    }
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
    if (Utils.objectHasProperty(request, 'forceInactive')) {
      filteredRequest.forceInactive = UtilsSecurity.filterBoolean(request.forceInactive);
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
            numberOfConnectedPhase: sanitize(connector.numberOfConnectedPhase),
            phaseAssignmentToGrid: sanitize(connector.phaseAssignmentToGrid)
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
      if (Utils.objectHasProperty(request.args, 'custom')) {
        filteredRequest.args.custom = UtilsSecurity.filterBoolean(request.args.custom);
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

