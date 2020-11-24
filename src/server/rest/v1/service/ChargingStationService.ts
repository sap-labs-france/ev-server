import { Action, Entity } from '../../../../types/Authorization';
import ChargingStation, { ChargingStationOcppParameters, Command, OCPPParams, StaticLimitAmps } from '../../../../types/ChargingStation';
import { HTTPAuthError, HTTPError } from '../../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';
import { OCPPConfigurationStatus, OCPPGetCompositeScheduleCommandResult, OCPPStatus } from '../../../../types/ocpp/OCPPClient';

import AppAuthError from '../../../../exception/AppAuthError';
import AppError from '../../../../exception/AppError';
import Authorizations from '../../../../authorization/Authorizations';
import BackendError from '../../../../exception/BackendError';
import { ChargingProfile } from '../../../../types/ChargingProfile';
import ChargingStationClientFactory from '../../../../client/ocpp/ChargingStationClientFactory';
import { ChargingStationInErrorType } from '../../../../types/InError';
import ChargingStationSecurity from './security/ChargingStationSecurity';
import ChargingStationStorage from '../../../../storage/mongodb/ChargingStationStorage';
import ChargingStationVendorFactory from '../../../../integration/charging-station-vendor/ChargingStationVendorFactory';
import Constants from '../../../../utils/Constants';
import CpoOCPIClient from '../../../../client/ocpi/CpoOCPIClient';
import { DataResult } from '../../../../types/DataResult';
import { HttpChargingStationCommandRequest } from '../../../../types/requests/HttpChargingStationRequest';
import I18nManager from '../../../../utils/I18nManager';
import LockingHelper from '../../../../locking/LockingHelper';
import LockingManager from '../../../../locking/LockingManager';
import Logging from '../../../../utils/Logging';
import OCPIClientFactory from '../../../../client/ocpi/OCPIClientFactory';
import { OCPIRole } from '../../../../types/ocpi/OCPIRole';
import OCPPStorage from '../../../../storage/mongodb/OCPPStorage';
import OCPPUtils from '../../../ocpp/utils/OCPPUtils';
import { ServerAction } from '../../../../types/Server';
import SiteArea from '../../../../types/SiteArea';
import SiteAreaStorage from '../../../../storage/mongodb/SiteAreaStorage';
import SiteStorage from '../../../../storage/mongodb/SiteStorage';
import SmartChargingFactory from '../../../../integration/smart-charging/SmartChargingFactory';
import { StatusCodes } from 'http-status-codes';
import TenantComponents from '../../../../types/TenantComponents';
import TenantStorage from '../../../../storage/mongodb/TenantStorage';
import TransactionStorage from '../../../../storage/mongodb/TransactionStorage';
import UserToken from '../../../../types/UserToken';
import Utils from '../../../../utils/Utils';
import UtilsService from './UtilsService';

const MODULE_NAME = 'ChargingStationService';

export default class ChargingStationService {
  public static async handleUpdateChargingStationParams(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationSecurity.filterChargingStationParamsUpdateRequest(req.body);
    // Check the Charging Station
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, filteredRequest.id);
    UtilsService.assertObjectExists(action, chargingStation, `Charging Station '${filteredRequest.id}' does not exist.`,
      MODULE_NAME, 'handleUpdateChargingStationParams', req.user);
    // OCPI Charging Station
    if (!chargingStation.issuer) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Charging Station '${chargingStation.id}' not issued by the organization`,
        module: MODULE_NAME, method: 'handleUpdateChargingStationParams',
        user: req.user,
        action: action
      });
    }
    let siteArea: SiteArea = null;
    // Check the Site Area
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.ORGANIZATION) && filteredRequest.siteAreaID) {
      siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, filteredRequest.siteAreaID);
      UtilsService.assertObjectExists(action, siteArea, `Site Area '${filteredRequest.siteAreaID}' does not exist.`,
        MODULE_NAME, 'handleUpdateChargingStationParams', req.user);
    }
    // Check Auth
    if (!Authorizations.canUpdateChargingStation(req.user, siteArea ? siteArea.siteID : null)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE, entity: Entity.CHARGING_STATION,
        module: MODULE_NAME, method: 'handleUpdateChargingStationParams',
        value: chargingStation.id
      });
    }
    // Update props
    if (filteredRequest.chargingStationURL) {
      chargingStation.chargingStationURL = filteredRequest.chargingStationURL;
    }
    if (Utils.objectHasProperty(filteredRequest, 'maximumPower')) {
      chargingStation.maximumPower = filteredRequest.maximumPower;
    }
    if (Utils.objectHasProperty(filteredRequest, 'public')) {
      if (filteredRequest.public === false && filteredRequest.public !== chargingStation.public) {
        // Remove charging station from ocpi
        if (Utils.isComponentActiveFromToken(req.user, TenantComponents.OCPI)) {
          const tenant = await TenantStorage.getTenant(req.user.tenantID);
          try {
            const ocpiClient: CpoOCPIClient = await OCPIClientFactory.getAvailableOcpiClient(tenant, OCPIRole.CPO) as CpoOCPIClient;
            if (ocpiClient) {
              await ocpiClient.removeChargingStation(chargingStation);
            }
          } catch (error) {
            Logging.logError({
              tenantID: req.user.tenantID,
              module: MODULE_NAME, method: 'handleUpdateChargingStationParams',
              action: action,
              user: req.user,
              message: `Unable to remove charging station ${chargingStation.id} from IOP`,
              detailedMessages: { error: error.message, stack: error.stack }
            });
          }
        }
      }
      chargingStation.public = filteredRequest.public;
    }
    if (Utils.objectHasProperty(filteredRequest, 'excludeFromSmartCharging')) {
      chargingStation.excludeFromSmartCharging = filteredRequest.excludeFromSmartCharging;
    }
    if (Utils.objectHasProperty(filteredRequest, 'forceInactive')) {
      chargingStation.forceInactive = filteredRequest.forceInactive;
    }
    // Existing Connectors
    if (!Utils.isEmptyArray(filteredRequest.connectors)) {
      for (const filteredConnector of filteredRequest.connectors) {
        const connector = Utils.getConnectorFromID(chargingStation, filteredConnector.connectorId);
        // Update Connectors only if no Charge Point is defined
        if (connector && Utils.isEmptyArray(chargingStation.chargePoints)) {
          connector.type = filteredConnector.type;
          connector.power = filteredConnector.power;
          connector.amperage = filteredConnector.amperage;
          connector.voltage = filteredConnector.voltage;
          connector.currentType = filteredConnector.currentType;
          connector.numberOfConnectedPhase = filteredConnector.numberOfConnectedPhase;
        }
        // Phase Assignment
        if (siteArea?.numberOfPhases === 3) {
          connector.phaseAssignmentToGrid = filteredConnector.phaseAssignmentToGrid;
        }
      }
    }
    // Update Site Area
    if (siteArea) {
      // OCPI Site Area
      if (!siteArea.issuer) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.GENERAL_ERROR,
          message: `Site Area '${siteArea.name}' with ID '${siteArea.id}' not issued by the organization`,
          module: MODULE_NAME, method: 'handleUpdateChargingStationParams',
          user: req.user,
          action: action
        });
      }
      chargingStation.siteAreaID = siteArea.id;
      // Check number of phases corresponds to the site area one
      for (const connector of chargingStation.connectors) {
        const numberOfConnectedPhase = Utils.getNumberOfConnectedPhases(chargingStation, null, connector.connectorId);
        if (numberOfConnectedPhase !== 1 && siteArea?.numberOfPhases === 1) {
          throw new AppError({
            source: Constants.CENTRAL_SERVER,
            action: action,
            errorCode: HTTPError.THREE_PHASE_CHARGER_ON_SINGLE_PHASE_SITE_AREA,
            message: `Error occurred while updating chargingStation: '${chargingStation.id}'. Site area '${chargingStation.siteArea.name}' is single phased.`,
            module: MODULE_NAME, method: 'handleUpdateChargingStationParams',
            user: req.user,
          });
        }
      }
      // Check Smart Charging
      if (!siteArea.smartCharging) {
        delete chargingStation.excludeFromSmartCharging;
      }
    } else {
      delete chargingStation.excludeFromSmartCharging;
      chargingStation.siteAreaID = null;
    }
    if (filteredRequest.coordinates && filteredRequest.coordinates.length === 2) {
      chargingStation.coordinates = [
        filteredRequest.coordinates[0],
        filteredRequest.coordinates[1]
      ];
    }
    // Update timestamp
    chargingStation.lastChangedBy = { 'id': req.user.id };
    chargingStation.lastChangedOn = new Date();
    // Update
    await ChargingStationStorage.saveChargingStation(req.user.tenantID, chargingStation);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      source: chargingStation.id, action: action,
      user: req.user, module: MODULE_NAME,
      method: 'handleUpdateChargingStationParams',
      message: 'Parameters have been updated successfully',
      detailedMessages: {
        'chargingStationURL': chargingStation.chargingStationURL
      }
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleChargingStationLimitPower(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationSecurity.filterChargingStationLimitPowerRequest(req.body);
    // Check
    if (!filteredRequest.chargePointID) {
      throw new AppError({
        source: filteredRequest.chargeBoxID,
        action: action,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'You must provide a Charge Point ID',
        module: MODULE_NAME, method: 'handleChargingStationLimitPower',
        user: req.user
      });
    }
    // Charging Station
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, filteredRequest.chargeBoxID);
    UtilsService.assertObjectExists(action, chargingStation, `Charging Station '${filteredRequest.chargeBoxID}' does not exist.`,
      MODULE_NAME, 'handleChargingStationLimitPower', req.user);
    // Charge Point
    const chargePoint = Utils.getChargePointFromID(chargingStation, filteredRequest.chargePointID);
    UtilsService.assertObjectExists(action, chargePoint, `Charge Point '${filteredRequest.chargePointID}' does not exist.`,
      MODULE_NAME, 'handleChargingStationLimitPower', req.user);
    // Min Current
    const numberOfPhases = Utils.getNumberOfConnectedPhases(chargingStation, chargePoint, 0);
    if (filteredRequest.ampLimitValue < (StaticLimitAmps.MIN_LIMIT_PER_PHASE * numberOfPhases * chargePoint.connectorIDs.length)) {
      throw new AppError({
        source: filteredRequest.chargeBoxID,
        action: action,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Limitation to ${filteredRequest.ampLimitValue}A is too low, min required is ${StaticLimitAmps.MIN_LIMIT_PER_PHASE * numberOfPhases * chargePoint.connectorIDs.length}A`,
        module: MODULE_NAME, method: 'handleChargingStationLimitPower',
        user: req.user
      });
    }
    let siteID = null;
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.ORGANIZATION)) {
      // Get the Site Area
      const siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, chargingStation.siteAreaID);
      siteID = siteArea ? siteArea.siteID : null;
    }
    // Check Auth
    if (!Authorizations.canUpdateChargingStation(req.user, siteID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE, entity: Entity.CHARGING_STATION,
        module: MODULE_NAME, method: 'handleChargingStationLimitPower',
        value: chargingStation.id
      });
    }
    // Get the Vendor instance
    const chargingStationVendor = ChargingStationVendorFactory.getChargingStationVendorImpl(chargingStation);
    if (!chargingStationVendor) {
      throw new AppError({
        source: chargingStation.id,
        action: action,
        errorCode: HTTPError.FEATURE_NOT_SUPPORTED_ERROR,
        message: `No vendor implementation is available (${chargingStation.chargePointVendor}) for limiting the charge`,
        module: MODULE_NAME, method: 'handleChargingStationLimitPower',
        user: req.user
      });
    }
    // Check if static limitation is supported
    if (!chargingStationVendor.hasStaticLimitationSupport(chargingStation)) {
      throw new AppError({
        source: chargingStation.id,
        action: action,
        errorCode: HTTPError.FEATURE_NOT_SUPPORTED_ERROR,
        message: 'Charging Station does not support power limitation',
        module: MODULE_NAME, method: 'handleChargingStationLimitPower',
        user: req.user
      });
    }
    // Check Charging Profile
    const chargingProfiles = await ChargingStationStorage.getChargingProfiles(req.user.tenantID,
      { chargingStationIDs: [chargingStation.id], connectorID: 0 },
      Constants.DB_PARAMS_MAX_LIMIT);
    const updatedChargingProfiles: ChargingProfile[] = Utils.cloneObject(chargingProfiles.result) as ChargingProfile[];
    for (let index = 0; index < updatedChargingProfiles.length; index++) {
      const updatedChargingProfile = updatedChargingProfiles[index];
      let planHasBeenAdjusted = false;
      // Check schedules
      if (updatedChargingProfile.profile && updatedChargingProfile.profile.chargingSchedule &&
        updatedChargingProfile.profile.chargingSchedule.chargingSchedulePeriod) {
        for (const chargingSchedulePeriod of updatedChargingProfile.profile.chargingSchedule.chargingSchedulePeriod) {
          // Check the limit max is beyond the new values
          if (chargingSchedulePeriod.limit > filteredRequest.ampLimitValue) {
            // Adjust it
            planHasBeenAdjusted = true;
            chargingSchedulePeriod.limit = filteredRequest.ampLimitValue;
          }
        }
      }
      // Charging plan updated?
      if (planHasBeenAdjusted) {
        // Check Force Update?
        if (!filteredRequest.forceUpdateChargingPlan) {
          throw new AppError({
            source: chargingStation.id,
            action: action,
            user: req.user,
            errorCode: HTTPError.GENERAL_ERROR,
            message: `Cannot change the current limitation to ${filteredRequest.ampLimitValue}A because of an existing charging plan!`,
            module: MODULE_NAME, method: 'handleChargingStationLimitPower',
            detailedMessages: { result: chargingProfiles.result[index] }
          });
        }
        // Log
        Logging.logWarning({
          tenantID: req.user.tenantID,
          source: chargingStation.id,
          action: action,
          user: req.user,
          module: MODULE_NAME, method: 'handleChargingStationLimitPower',
          message: `Adjust the Charging Plan power limit to ${filteredRequest.ampLimitValue}A`,
          detailedMessages: { chargingProfile: chargingProfiles.result[index] }
        });
        // Apply & Save charging plan
        await OCPPUtils.setAndSaveChargingProfile(req.user.tenantID, updatedChargingProfile, req.user);
        break;
      }
    }
    // Call the limitation
    const result = await chargingStationVendor.setStaticPowerLimitation(req.user.tenantID, chargingStation,
      chargePoint, filteredRequest.ampLimitValue);
    if (result.status !== OCPPConfigurationStatus.ACCEPTED && result.status !== OCPPConfigurationStatus.REBOOT_REQUIRED) {
      throw new AppError({
        source: chargingStation.id,
        action: action,
        errorCode: HTTPError.LIMIT_POWER_ERROR,
        module: MODULE_NAME, method: 'handleChargingStationLimitPower',
        message: `Cannot limit the charger's power to ${filteredRequest.ampLimitValue}A: '${result.status}'`,
        detailedMessages: { result },
        user: req.user
      });
    }
    Logging.logInfo({
      tenantID: req.user.tenantID,
      source: chargingStation.id,
      action: action,
      user: req.user,
      module: MODULE_NAME, method: 'handleChargingStationLimitPower',
      message: `The charger's power limit has been successfully set to ${filteredRequest.ampLimitValue}A`,
      detailedMessages: { result }
    });
    // Ok
    res.json({ status: result.status });
    next();
  }

  public static async handleGetChargingProfiles(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationSecurity.filterChargingProfilesRequest(req.query);
    // Check auth
    if (!Authorizations.canListChargingProfiles(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST, entity: Entity.CHARGING_PROFILES,
        module: MODULE_NAME, method: 'handleGetChargingProfiles'
      });
    }
    // Profiles of the charging station?
    let profilesProject: string[] = [ 'profile.chargingProfileKind', 'profile.chargingProfilePurpose', 'profile.stackLevel' ];
    if (filteredRequest.ChargeBoxID) {
      // Enhanced the projection
      profilesProject = ['profile'];
    }
    // Get the profiles
    const chargingProfiles = await ChargingStationStorage.getChargingProfiles(req.user.tenantID,
      { search: filteredRequest.Search,
        chargingStationIDs: filteredRequest.ChargeBoxID ? filteredRequest.ChargeBoxID.split('|') : null,
        connectorID: filteredRequest.ConnectorID,
        withChargingStation: filteredRequest.WithChargingStation,
        withSiteArea: true,
        siteIDs: Authorizations.getAuthorizedSiteIDs(req.user, filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : null), },
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort, onlyRecordCount: filteredRequest.OnlyRecordCount },
      [
        'id', 'chargingStationID', 'chargePointID', 'connectorID', 'chargingStation.id',
        'chargingStation.siteArea.id', 'chargingStation.siteArea.name', 'chargingStation.siteArea.maximumPower',
        ...profilesProject
      ]);
    // Build the result
    res.json(chargingProfiles);
    next();
  }

  public static async handleTriggerSmartCharging(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if Component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.SMART_CHARGING,
      Action.UPDATE, Entity.SITE_AREA, MODULE_NAME, 'handleTriggerSmartCharging');
    // Filter
    const filteredRequest = ChargingStationSecurity.filterTriggerSmartCharging(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.siteAreaID, MODULE_NAME, 'handleTriggerSmartCharging', req.user);
    // Get Site Area
    const siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, filteredRequest.siteAreaID);
    UtilsService.assertObjectExists(action, siteArea, `Site Area '${filteredRequest.siteAreaID}' does not exist`,
      MODULE_NAME, 'handleTriggerSmartCharging', req.user);
    // Check auth
    if (!Authorizations.canUpdateSiteArea(req.user, siteArea.siteID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE, entity: Entity.SITE_AREA,
        module: MODULE_NAME, method: 'handleTriggerSmartCharging',
        value: filteredRequest.siteAreaID
      });
    }
    // Call Smart Charging
    const smartCharging = await SmartChargingFactory.getSmartChargingImpl(req.user.tenantID);
    if (!smartCharging) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Smart Charging service is not configured',
        module: MODULE_NAME, method: 'handleTriggerSmartCharging',
        action: action,
        user: req.user
      });
    }
    const siteAreaLock = await LockingHelper.createSiteAreaSmartChargingLock(req.user.tenantID, siteArea);
    if (siteAreaLock) {
      try {
        // Call
        const actionsResponse = await smartCharging.computeAndApplyChargingProfiles(siteArea);
        if (actionsResponse && actionsResponse.inError > 0) {
          throw new AppError({
            source: Constants.CENTRAL_SERVER,
            action: action,
            errorCode: HTTPError.GENERAL_ERROR,
            module: MODULE_NAME, method: 'handleTriggerSmartCharging',
            user: req.user,
            message: 'Error occurred while triggering the smart charging',
          });
        }
      } finally {
        // Release lock
        await LockingManager.release(siteAreaLock);
      }
    }
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleUpdateChargingProfile(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationSecurity.filterChargingProfileUpdateRequest(req.body);
    // Check existence
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, filteredRequest.chargingStationID);
    UtilsService.assertObjectExists(action, chargingStation, `ChargingStation '${filteredRequest.chargingStationID}' does not exist.`,
      MODULE_NAME, 'handleUpdateChargingProfile', req.user);
    // OCPI Charging Station
    if (!chargingStation.issuer) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Charging Station '${chargingStation.id}' not issued by the organization`,
        module: MODULE_NAME, method: 'handleUpdateChargingProfile',
        user: req.user,
        action: action
      });
    }
    const chargePoint = Utils.getChargePointFromID(chargingStation, filteredRequest.chargePointID);
    UtilsService.assertObjectExists(action, chargePoint, `Charge Point '${filteredRequest.chargePointID}' does not exist.`,
      MODULE_NAME, 'handleUpdateChargingProfile', req.user);
    // Check Mandatory fields
    Utils.checkIfChargingProfileIsValid(chargingStation, chargePoint, filteredRequest, req);
    let siteID = null;
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.ORGANIZATION)) {
      // Get the Site Area
      const siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, chargingStation.siteAreaID);
      siteID = siteArea ? siteArea.siteID : null;
    }
    // Check Auth
    if (!Authorizations.canUpdateChargingStation(req.user, siteID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE, entity: Entity.CHARGING_STATION,
        module: MODULE_NAME, method: 'handleUpdateChargingProfile',
        value: chargingStation.id
      });
    }
    // Check if Charging Profile is supported
    if (!chargingStation.capabilities || !chargingStation.capabilities.supportChargingProfiles) {
      throw new AppError({
        source: chargingStation.id,
        action: action,
        errorCode: HTTPError.FEATURE_NOT_SUPPORTED_ERROR,
        user: req.user,
        module: MODULE_NAME, method: 'handleUpdateChargingProfile',
        message: `Charging Station '${chargingStation.id}' does not support Charging Profiles`,
      });
    }
    // Apply & Save charging plan
    const chargingProfileID = await OCPPUtils.setAndSaveChargingProfile(req.user.tenantID, filteredRequest, req.user);
    // Ok
    res.json(Object.assign({ id: chargingProfileID }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleDeleteChargingProfile(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check existence
    const chargingProfileID = ChargingStationSecurity.filterChargingProfileRequestByID(req.query);
    // Get Profile
    const chargingProfile = await ChargingStationStorage.getChargingProfile(req.user.tenantID, chargingProfileID);
    UtilsService.assertObjectExists(action, chargingProfile, `Charging Profile ID '${chargingProfileID}' does not exist.`,
      MODULE_NAME, 'handleDeleteChargingProfile', req.user);
    // Get Charging Station
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, chargingProfile.chargingStationID);
    UtilsService.assertObjectExists(action, chargingStation, `ChargingStation '${chargingProfile.chargingStationID}' does not exist.`,
      MODULE_NAME, 'handleDeleteChargingProfile', req.user);
    // OCPI Charging Station
    if (!chargingStation.issuer) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Charging Station '${chargingStation.id}' not issued by the organization`,
        module: MODULE_NAME, method: 'handleDeleteChargingProfile',
        user: req.user,
        action: action
      });
    }
    // Check Component
    let siteID = null;
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.ORGANIZATION)) {
      // Get the Site Area
      const siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, chargingStation.siteAreaID);
      siteID = siteArea ? siteArea.siteID : null;
    }
    // Check Auth
    if (!Authorizations.canUpdateChargingStation(req.user, siteID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE, entity: Entity.CHARGING_STATION,
        module: MODULE_NAME, method: 'handleDeleteChargingProfile',
        value: chargingStation.id
      });
    }
    try {
      // Delete
      await OCPPUtils.clearAndDeleteChargingProfile(req.user.tenantID, chargingProfile);
    } catch (error) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        action: action,
        errorCode: HTTPError.CLEAR_CHARGING_PROFILE_NOT_SUCCESSFUL,
        message: 'Error occurred while clearing Charging Profile',
        module: MODULE_NAME, method: 'handleDeleteChargingProfile',
        user: req.user, actionOnUser: req.user,
        detailedMessages: { error: error.message, stack: error.stack }
      });
    }
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetChargingStationOcppParameters(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationSecurity.filterChargingStationOcppParametersRequest(req.query);
    // Check
    UtilsService.assertIdIsProvided(action, filteredRequest.ChargeBoxID, MODULE_NAME, 'handleGetChargingStationOcppParameters', req.user);
    // Get the Charging Station`
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, filteredRequest.ChargeBoxID);
    // Found?
    UtilsService.assertObjectExists(action, chargingStation, `ChargingStation '${filteredRequest.ChargeBoxID}' does not exist`,
      MODULE_NAME, 'handleGetChargingStationOcppParameters', req.user);
    // Check auth
    if (!Authorizations.canReadChargingStation(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ, entity: Entity.CHARGING_STATION,
        module: MODULE_NAME, method: 'handleGetChargingStationOcppParameters',
        value: chargingStation.id
      });
    }
    // Get the Parameters
    const parameters = await ChargingStationStorage.getOcppParameters(req.user.tenantID, chargingStation.id);
    // Return the result
    res.json(parameters);
    next();
  }

  public static async handleRequestChargingStationOcppParameters(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationSecurity.filterRequestChargingStationOcppParametersRequest(req.body);
    UtilsService.assertIdIsProvided(action, filteredRequest.chargeBoxID, MODULE_NAME, 'handleRequestChargingStationOcppParameters', req.user);
    // Check auth
    if (!Authorizations.canReadChargingStation(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ, entity: Entity.CHARGING_STATION,
        module: MODULE_NAME, method: 'handleRequestChargingStationOcppParameters',
        value: filteredRequest.chargeBoxID
      });
    }
    // Get the Charging Station
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, filteredRequest.chargeBoxID);
    // Found?
    UtilsService.assertObjectExists(action, chargingStation, `ChargingStation '${filteredRequest.chargeBoxID}' does not exist`,
      MODULE_NAME, 'handleRequestChargingStationOcppParameters', req.user);
    // Get the Config
    const result = await OCPPUtils.requestAndSaveChargingStationOcppParameters(
      req.user.tenantID, chargingStation, filteredRequest.forceUpdateOCPPParamsFromTemplate);
    // Ok
    res.json(result);
    next();
  }

  public static async handleDeleteChargingStation(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const chargingStationID = ChargingStationSecurity.filterChargingStationRequestByID(req.query);
    // Check Mandatory fields
    UtilsService.assertIdIsProvided(action, chargingStationID, MODULE_NAME,
      'handleDeleteChargingStation', req.user);
    // Get
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, chargingStationID);
    UtilsService.assertObjectExists(action, chargingStation, `Charging Station with ID '${chargingStationID}' does not exist`,
      MODULE_NAME, 'handleDeleteChargingStation', req.user);
    // OCPI Charging Station
    if (!chargingStation.issuer) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Charging Station '${chargingStation.id}' not issued by the organization`,
        module: MODULE_NAME, method: 'handleDeleteChargingStation',
        user: req.user,
        action: action
      });
    }
    let siteID = null;
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.ORGANIZATION)) {
      // Get the Site Area
      const siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, chargingStation.siteAreaID);
      siteID = siteArea ? siteArea.siteID : null;
    }
    // Check auth
    if (!Authorizations.canDeleteChargingStation(req.user, siteID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.DELETE, entity: Entity.CHARGING_STATION,
        module: MODULE_NAME, method: 'handleDeleteChargingStation',
        value: chargingStationID
      });
    }
    // Deleted
    if (chargingStation.deleted) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        action: action,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: `Charging Station with ID '${chargingStationID}' is already deleted`,
        module: MODULE_NAME,
        method: 'handleDeleteChargingStation',
        user: req.user
      });
    }
    for (const connector of chargingStation.connectors) {
      if (connector && connector.currentTransactionID) {
        const transaction = await TransactionStorage.getTransaction(req.user.tenantID, connector.currentTransactionID);
        if (transaction && !transaction.stop) {
          throw new AppError({
            source: Constants.CENTRAL_SERVER,
            action: action,
            errorCode: HTTPError.EXISTING_TRANSACTION_ERROR,
            message: `Charging Station '${chargingStation.id}' can't be deleted due to existing active transactions`,
            module: MODULE_NAME,
            method: 'handleDeleteChargingStation',
            user: req.user
          });
        } else {
          OCPPUtils.checkAndFreeChargingStationConnector(chargingStation, connector.connectorId);
        }
      }
    }
    // Remove Site Area
    chargingStation.siteArea = null;
    chargingStation.siteAreaID = null;
    // Set as deleted
    chargingStation.deleted = true;
    // Check if charging station has had transactions
    const transactions = await TransactionStorage.getTransactions(req.user.tenantID,
      { chargeBoxIDs: [chargingStation.id] }, Constants.DB_PARAMS_COUNT_ONLY);
    if (transactions.count > 0) {
      // Delete logically
      await ChargingStationStorage.saveChargingStation(req.user.tenantID, chargingStation);
    } else {
      // Delete physically
      await ChargingStationStorage.deleteChargingStation(req.user.tenantID, chargingStation.id);
    }
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleDeleteChargingStation',
      message: `Charging Station '${chargingStation.id}' has been deleted successfully`,
      action: action,
      detailedMessages: { chargingStation }
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetChargingStation(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationSecurity.filterChargingStationRequest(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleGetChargingStation', req.user);
    // Check auth
    if (!Authorizations.canReadChargingStation(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ, entity: Entity.CHARGING_STATION,
        module: MODULE_NAME, method: 'handleGetChargingStation',
        value: filteredRequest.ID
      });
    }
    // Query charging station
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, filteredRequest.ID, {},
      [
        'id', 'inactive', 'public', 'chargingStationURL', 'issuer', 'maximumPower', 'excludeFromSmartCharging', 'lastReboot',
        'siteAreaID', 'siteArea.id', 'siteArea.name', 'siteArea.smartCharging', 'siteArea.siteID',
        'siteArea.site.id', 'siteArea.site.name', 'voltage', 'coordinates', 'forceInactive', 'firmwareUpdateStatus',
        'capabilities', 'endpoint', 'chargePointVendor', 'chargePointModel', 'ocppVersion', 'ocppProtocol', 'lastSeen',
        'firmwareVersion', 'currentIPAddress', 'ocppStandardParameters', 'ocppVendorParameters', 'connectors', 'chargePoints',
        'createdOn', 'chargeBoxSerialNumber', 'chargePointSerialNumber', 'powerLimitUnit'
      ]
    );
    UtilsService.assertObjectExists(action, chargingStation, `Charging Station '${filteredRequest.ID}' does not exist`,
      MODULE_NAME, 'handleGetChargingStation', req.user);
    // Deleted?
    if (chargingStation.deleted) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: `ChargingStation with ID '${filteredRequest.ID}' is logically deleted`,
        module: MODULE_NAME,
        method: 'handleGetChargingStation',
        user: req.user
      });
    }
    res.json(chargingStation);
    next();
  }

  public static async handleGetChargingStations(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    res.json(await ChargingStationService.getChargingStations(req));
    next();
  }

  public static async handleExportChargingStationsOCPPParams(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Always with site
    req.query.WithSite = 'true';
    // Get Charging Stations
    const chargingStations = await ChargingStationService.getChargingStations(req);
    for (const chargingStation of chargingStations.result) {
      // Check all chargers
      if (!Authorizations.canExportParams(req.user, chargingStation.siteArea.siteID)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: req.user,
          action: Action.EXPORT_PARAMS,
          entity: Entity.CHARGING_STATION,
          module: MODULE_NAME,
          method: 'handleExportChargingStationsOCPPParams',
        });
      }
    }
    const ocppParams: OCPPParams[] = [];
    // Set the attachement name
    res.attachment('exported-ocpp-params.csv');
    let writeHeader = true;
    for (const chargingStation of chargingStations.result) {
      const ocppParameters = await ChargingStationStorage.getOcppParameters(req.user.tenantID, chargingStation.id);
      // Get OCPP Params
      const dataToExport = ChargingStationService.convertOCPPParamsToCSV({
        params: ocppParameters.result,
        siteName: chargingStation.siteArea.site.name,
        siteAreaName: chargingStation.siteArea.name,
        chargingStationName: chargingStation.id
      }, writeHeader);
      // Send OCPP Params
      res.write(dataToExport);
      writeHeader = false;
    }
    // End of stream
    res.end();
  }

  public static async handleExportChargingStations(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Export
    await UtilsService.exportToCSV(req, res, 'exported-charging-stations.csv',
      ChargingStationService.getChargingStations.bind(this), ChargingStationService.convertToCSV.bind(this));
  }

  public static async handleGetChargingStationsInError(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!Authorizations.canListChargingStations(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST, entity: Entity.CHARGING_STATIONS,
        module: MODULE_NAME, method: 'handleGetChargingStations'
      });
    }
    // Filter
    const filteredRequest = ChargingStationSecurity.filterChargingStationsRequest(req.query);
    // Check component
    if (filteredRequest.SiteID) {
      UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
        Action.READ, Entity.CHARGING_STATIONS, MODULE_NAME, 'handleGetChargingStations');
    }
    let errorType;
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.ORGANIZATION)) {
      // Get the Site Area
      errorType = (filteredRequest.ErrorType ? filteredRequest.ErrorType.split('|') :
        [ChargingStationInErrorType.MISSING_SETTINGS, ChargingStationInErrorType.CONNECTION_BROKEN,
          ChargingStationInErrorType.CONNECTOR_ERROR, ChargingStationInErrorType.MISSING_SITE_AREA]);
    } else {
      errorType = (filteredRequest.ErrorType ? filteredRequest.ErrorType.split('|') :
        [ChargingStationInErrorType.MISSING_SETTINGS, ChargingStationInErrorType.CONNECTION_BROKEN,
          ChargingStationInErrorType.CONNECTOR_ERROR]);
    }
    // Get Charging Stations
    const chargingStations = await ChargingStationStorage.getChargingStationsInError(req.user.tenantID,
      {
        search: filteredRequest.Search,
        siteIDs: Authorizations.getAuthorizedSiteIDs(req.user, filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : null),
        siteAreaIDs: (filteredRequest.SiteAreaID ? filteredRequest.SiteAreaID.split('|') : null),
        errorType
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.Sort,
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      [
        'id', 'inactive', 'connectorsStatus', 'connectorsConsumption', 'public', 'errorCodeDetails', 'errorCode', 'lastSeen',
        'connectors.connectorId', 'connectors.status', 'connectors.type', 'connectors.power', 'connectors.errorCode',
      ]
    );
    // Return
    res.json(chargingStations);
    next();
  }

  public static async handleGetStatusNotifications(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check auth
    if (!Authorizations.canListChargingStations(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST, entity: Entity.CHARGING_STATIONS,
        module: MODULE_NAME, method: 'handleGetStatusNotifications'
      });
    }
    // Filter
    const filteredRequest = ChargingStationSecurity.filterNotificationsRequest(req.query);
    // Get all Status Notifications
    const statusNotifications = await OCPPStorage.getStatusNotifications(req.user.tenantID, {},
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort });
    // Return
    res.json(statusNotifications);
    next();
  }

  public static async handleGetBootNotifications(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check auth
    if (!Authorizations.canListChargingStations(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user, action: Action.LIST,
        entity: Entity.CHARGING_STATIONS,
        module: MODULE_NAME, method: 'handleGetBootNotifications'
      });
    }
    // Filter
    const filteredRequest = ChargingStationSecurity.filterNotificationsRequest(req.query);
    // Get all Status Notifications
    const bootNotifications = await OCPPStorage.getBootNotifications(req.user.tenantID, {},
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort });
    // Return
    res.json(bootNotifications);
    next();
  }

  public static async handleGetFirmware(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Filter
    const filteredRequest = ChargingStationSecurity.filterChargingStationGetFirmwareRequest(req.query);
    if (!filteredRequest.FileName) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The firmware FileName is mandatory',
        module: MODULE_NAME,
        method: 'handleGetFirmware'
      });
    }
    // Open a download stream and pipe it in the response
    const bucketStream = ChargingStationStorage.getChargingStationFirmware(filteredRequest.FileName);
    // Set headers
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename=' + filteredRequest.FileName);
    // Write chunks
    bucketStream.on('data', (chunk) => {
      res.write(chunk);
    });
    // Handle Errors
    bucketStream.on('error', (error) => {
      Logging.logError({
        tenantID: Constants.DEFAULT_TENANT,
        action: action,
        message: `Firmware '${filteredRequest.FileName}' has not been found!`,
        module: MODULE_NAME, method: 'handleGetFirmware',
        detailedMessages: { error: error.message, stack: error.stack },
      });
      res.sendStatus(StatusCodes.NOT_FOUND);
    });
    // End of download
    bucketStream.on('end', () => {
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        action: action,
        message: `Firmware '${filteredRequest.FileName}' has been downloaded with success`,
        module: MODULE_NAME, method: 'handleGetFirmware',
      });
      res.end();
    });
  }

  public static async handleAction(action: ServerAction, command: Command, req: Request, res: Response, next: NextFunction) {
    // Filter - Type is hacked because code below is. Would need approval to change code structure.
    const filteredRequest: HttpChargingStationCommandRequest =
      ChargingStationSecurity.filterChargingStationActionRequest(req.body);
    UtilsService.assertIdIsProvided(action, filteredRequest.chargeBoxID, MODULE_NAME, 'handleAction', req.user);
    // Get the Charging station
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, filteredRequest.chargeBoxID);
    UtilsService.assertObjectExists(action, chargingStation, `Charging Station with ID '${filteredRequest.chargeBoxID}' does not exist`,
      MODULE_NAME, 'handleAction', req.user);
    let result;
    // Remote Stop Transaction / Unlock Connector
    if (command === Command.REMOTE_STOP_TRANSACTION) {
      // Check Transaction ID
      if (!filteredRequest.args || !filteredRequest.args.transactionId) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.GENERAL_ERROR,
          message: 'Transaction ID is mandatory',
          module: MODULE_NAME,
          method: 'handleAction',
          user: req.user,
          action: action,
        });
      }
      // Get Transaction
      const transaction = await TransactionStorage.getTransaction(req.user.tenantID, filteredRequest.args.transactionId);
      UtilsService.assertObjectExists(action, transaction, `Transaction ID '${filteredRequest.args.transactionId}' does not exist`,
        MODULE_NAME, 'handleAction', req.user);
      // Add connector ID
      filteredRequest.args.connectorId = transaction.connectorId;
      // Check Tag ID
      if (!req.user.tagIDs || req.user.tagIDs.length === 0) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.USER_NO_BADGE_ERROR,
          message: 'The user does not have any badge',
          module: MODULE_NAME,
          method: 'handleAction',
          user: req.user,
          action: action,
        });
      }
      // Check if user is authorized
      await Authorizations.isAuthorizedToStopTransaction(req.user.tenantID, chargingStation, transaction, req.user.tagIDs[0],
        ServerAction.STOP_TRANSACTION, Action.REMOTE_STOP_TRANSACTION);
      // Set the tag ID to handle the Stop Transaction afterwards
      transaction.remotestop = {
        timestamp: new Date(),
        tagID: req.user.tagIDs[0],
        userID: req.user.id
      };
      // Save Transaction
      await TransactionStorage.saveTransaction(req.user.tenantID, transaction);
      // Ok: Execute it
      result = await this.handleChargingStationCommand(
        req.user.tenantID, req.user, chargingStation, action, command, filteredRequest.args);
      // Remote Start Transaction
    } else if (command === Command.REMOTE_START_TRANSACTION) {
      // Check Tag ID
      if (!filteredRequest.args || !filteredRequest.args.tagID) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.USER_NO_BADGE_ERROR,
          message: 'The user does not have any badge',
          module: MODULE_NAME,
          method: 'handleAction',
          user: req.user,
          action: action,
        });
      }
      // Check if user is authorized
      await Authorizations.isAuthorizedToStartTransaction(req.user.tenantID, chargingStation, filteredRequest.args.tagID,
        ServerAction.CHARGING_STATION_REMOTE_START_TRANSACTION, Action.REMOTE_START_TRANSACTION);
      // Ok: Execute it
      result = await this.handleChargingStationCommand(
        req.user.tenantID, req.user, chargingStation, action, command, filteredRequest.args);
    } else if (command === Command.GET_COMPOSITE_SCHEDULE) {
      // Check auth
      if (!Authorizations.canPerformActionOnChargingStation(req.user, command as unknown as Action, chargingStation)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: req.user,
          action: command as unknown as Action,
          entity: Entity.CHARGING_STATION,
          module: MODULE_NAME, method: 'handleAction',
          value: chargingStation.id
        });
      }
      // Get the Vendor instance
      const chargingStationVendor = ChargingStationVendorFactory.getChargingStationVendorImpl(chargingStation);
      if (!chargingStationVendor) {
        throw new AppError({
          source: chargingStation.id,
          action: action,
          errorCode: HTTPError.FEATURE_NOT_SUPPORTED_ERROR,
          message: `No vendor implementation is available (${chargingStation.chargePointVendor}) for limiting the charge`,
          module: MODULE_NAME, method: 'handleAction',
          user: req.user
        });
      }
      // Get composite schedule
      if (filteredRequest.args.connectorId === 0) {
        result = [] as OCPPGetCompositeScheduleCommandResult[];
        for (const connector of chargingStation.connectors) {
          // Connector ID > 0
          const chargePoint = Utils.getChargePointFromID(chargingStation, connector.chargePointID);
          result.push(await chargingStationVendor.getCompositeSchedule(
            req.user.tenantID, chargingStation, chargePoint, connector.connectorId, filteredRequest.args.duration));
        }
      } else {
        // Connector ID > 0
        const connector = Utils.getConnectorFromID(chargingStation, filteredRequest.args.connectorId);
        const chargePoint = Utils.getChargePointFromID(chargingStation, connector?.chargePointID);
        result = await chargingStationVendor.getCompositeSchedule(
          req.user.tenantID, chargingStation, chargePoint, filteredRequest.args.connectorId, filteredRequest.args.duration);
      }
    } else {
      // Check auth
      if (!Authorizations.canPerformActionOnChargingStation(req.user, command as unknown as Action, chargingStation)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: req.user,
          action: command as unknown as Action,
          entity: Entity.CHARGING_STATION,
          module: MODULE_NAME, method: 'handleAction',
          value: chargingStation.id
        });
      }
      // Execute it
      result = await this.handleChargingStationCommand(
        req.user.tenantID, req.user, chargingStation, action, command, filteredRequest.args);
    }
    // Return
    res.json(result);
    next();
  }

  public static async handleCheckSmartChargingConnection(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check if Component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.SMART_CHARGING,
      Action.CHECK_CONNECTION, Entity.CHARGING_STATION, MODULE_NAME, 'handleCheckSmartChargingConnection');
    // Check auth
    if (!Authorizations.canReadSetting(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        entity: Entity.SETTING,
        action: Action.UPDATE,
        module: MODULE_NAME,
        method: 'handleCheckSmartChargingConnection'
      });
    }
    // Get implementation
    const smartCharging = await SmartChargingFactory.getSmartChargingImpl(req.user.tenantID);
    if (!smartCharging) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Smart Charging service is not configured',
        module: MODULE_NAME, method: 'handleCheckSmartChargingConnection',
        action: action,
        user: req.user
      });
    }
    // Check
    await smartCharging.checkConnection();
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  private static async checkConnectorsActionAuthorizations(tenantID: string, user: UserToken, chargingStation: ChargingStation) {
    const results = [];
    if (Utils.isComponentActiveFromToken(user, TenantComponents.ORGANIZATION)) {
      try {
        // Site is mandatory
        if (!chargingStation.siteArea) {
          throw new AppError({
            source: chargingStation.id,
            errorCode: HTTPError.CHARGER_WITH_NO_SITE_AREA_ERROR,
            message: `Charging Station '${chargingStation.id}' is not assigned to a Site Area!`,
            module: MODULE_NAME,
            method: 'checkConnectorsActionAuthorizations',
            user: user
          });
        }

        // Site -----------------------------------------------------
        chargingStation.siteArea.site = await SiteStorage.getSite(tenantID, chargingStation.siteArea.siteID);
        if (!chargingStation.siteArea.site) {
          throw new AppError({
            source: chargingStation.id,
            errorCode: HTTPError.SITE_AREA_WITH_NO_SITE_ERROR,
            message: `Site Area '${chargingStation.siteArea.name}' is not assigned to a Site!`,
            module: MODULE_NAME,
            method: 'checkConnectorsActionAuthorizations',
            user: user
          });
        }
      } catch (error) {
        // Problem with site assignment so do not allow any action
        for (let index = 0; index < chargingStation.connectors.length; index++) {
          results.push(
            {
              'isStartAuthorized': false,
              'isStopAuthorized': false,
              'isTransactionDisplayAuthorized': false
            }
          );
        }
        return results;
      }
    }
    // Check authorization for each connectors
    for (let index = 0; index < chargingStation.connectors.length; index++) {
      const foundConnector = chargingStation.connectors.find(
        (connector) => connector.connectorId === index + 1);
      if (foundConnector.currentTransactionID > 0) {
        const transaction = await TransactionStorage.getTransaction(user.tenantID, foundConnector.currentTransactionID);
        results.push({
          'isStartAuthorized': false,
          'isStopAuthorized': Authorizations.canStopTransaction(user, transaction),
          'isTransactionDisplayAuthorized': Authorizations.canReadTransaction(user, transaction),
        });
      } else {
        results.push({
          'isStartAuthorized': Authorizations.canStartTransaction(user, chargingStation),
          'isStopAuthorized': false,
          'isTransactionDisplayAuthorized': false,
        });
      }
    }
    return results;
  }

  private static async getChargingStations(req: Request): Promise<DataResult<ChargingStation>> {
    // Check auth
    if (!Authorizations.canListChargingStations(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST, entity: Entity.CHARGING_STATIONS,
        module: MODULE_NAME, method: 'getChargingStations',
      });
    }
    // Filter
    const filteredRequest = ChargingStationSecurity.filterChargingStationsRequest(req.query);
    // Check Users
    let userProject: string[] = [];
    if (Authorizations.canListUsers(req.user)) {
      userProject = [ 'connectors.user.id', 'connectors.user.name', 'connectors.user.firstName', 'connectors.user.email' ];
    }
    // Get Charging Stations
    const chargingStations = await ChargingStationStorage.getChargingStations(req.user.tenantID,
      {
        search: filteredRequest.Search,
        withNoSiteArea: filteredRequest.WithNoSiteArea,
        withSite: filteredRequest.WithSite,
        connectorStatuses: (filteredRequest.ConnectorStatus ? filteredRequest.ConnectorStatus.split('|') : null),
        connectorTypes: (filteredRequest.ConnectorType ? filteredRequest.ConnectorType.split('|') : null),
        issuer: filteredRequest.Issuer,
        siteIDs: Authorizations.getAuthorizedSiteIDs(req.user, filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : null),
        siteAreaIDs: (filteredRequest.SiteAreaID ? filteredRequest.SiteAreaID.split('|') : null),
        includeDeleted: filteredRequest.IncludeDeleted,
        locCoordinates: filteredRequest.LocCoordinates,
        locMaxDistanceMeters: filteredRequest.LocMaxDistanceMeters,
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.Sort,
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      [
        'id', 'inactive', 'connectorsStatus', 'connectorsConsumption', 'public', 'firmwareVersion', 'chargePointVendor', 'chargePointModel',
        'ocppVersion', 'ocppProtocol', 'lastSeen', 'firmwareUpdateStatus', 'coordinates', 'issuer', 'voltage',
        'siteAreaID', 'siteArea.id', 'siteArea.name', 'siteArea.siteID', 'siteArea.site.name',
        'connectors.connectorId', 'connectors.status', 'connectors.type', 'connectors.power', 'connectors.errorCode',
        'connectors.currentTotalConsumptionWh', 'connectors.currentInstantWatts', 'connectors.currentStateOfCharge',
        'connectors.currentTransactionID', 'connectors.currentTotalInactivitySecs', 'connectors.currentTagID',
        ...userProject
      ]
    );
    return chargingStations;
  }

  private static convertOCPPParamsToCSV(ocppParams: OCPPParams, writeHeader = true): string {
    let csv = '';
    // Header
    if (writeHeader) {
      csv = `Charging Station${Constants.CSV_SEPARATOR}Name${Constants.CSV_SEPARATOR}Value${Constants.CSV_SEPARATOR}Site Area${Constants.CSV_SEPARATOR}Site\r\n`;
    }
    // Content
    for (const param of ocppParams.params) {
      csv += `${ocppParams.chargingStationName}` + Constants.CSV_SEPARATOR;
      csv += `${param.key}` + Constants.CSV_SEPARATOR;
      csv += `${Utils.replaceSpecialCharsInCSVValueParam(param.value)}` + Constants.CSV_SEPARATOR;
      csv += `${ocppParams.siteAreaName}` + Constants.CSV_SEPARATOR;
      csv += `${ocppParams.siteName}\r\n`;
    }
    return csv;
  }

  private static convertToCSV(loggedUser: UserToken, chargingStations: ChargingStation[], writeHeader = true): string {
    let csv = '';
    const i18nManager = new I18nManager(loggedUser.locale);
    // Header
    if (writeHeader) {
      csv = `Name${Constants.CSV_SEPARATOR}Created On${Constants.CSV_SEPARATOR}Number of Connectors${Constants.CSV_SEPARATOR}Site Area${Constants.CSV_SEPARATOR}Latitude${Constants.CSV_SEPARATOR}Longitude${Constants.CSV_SEPARATOR}Charge Point S/N${Constants.CSV_SEPARATOR}Model${Constants.CSV_SEPARATOR}Charge Box S/N${Constants.CSV_SEPARATOR}Vendor${Constants.CSV_SEPARATOR}Firmware Version${Constants.CSV_SEPARATOR}OCPP Version${Constants.CSV_SEPARATOR}OCPP Protocol${Constants.CSV_SEPARATOR}Last Seen${Constants.CSV_SEPARATOR}Last Reboot${Constants.CSV_SEPARATOR}Maximum Power (Watt)${Constants.CSV_SEPARATOR}Power Limit Unit\r\n`;
    }
    // Content
    for (const chargingStation of chargingStations) {
      csv += `${chargingStation.id}` + Constants.CSV_SEPARATOR;
      csv += `${i18nManager.formatDateTime(chargingStation.createdOn, 'L')} ${i18nManager.formatDateTime(chargingStation.createdOn, 'LT')}` + Constants.CSV_SEPARATOR;
      csv += `${chargingStation.connectors ? chargingStation.connectors.length : '0'}` + Constants.CSV_SEPARATOR;
      csv += `${chargingStation.siteArea.name}` + Constants.CSV_SEPARATOR;
      if (chargingStation.coordinates && chargingStation.coordinates.length === 2) {
        csv += `${chargingStation.coordinates[1]}` + Constants.CSV_SEPARATOR;
        csv += `${chargingStation.coordinates[0]}` + Constants.CSV_SEPARATOR;
      } else {
        csv += `''${Constants.CSV_SEPARATOR}''`;
      }
      csv += `${chargingStation.chargePointSerialNumber}` + Constants.CSV_SEPARATOR;
      csv += `${chargingStation.chargePointModel}` + Constants.CSV_SEPARATOR;
      csv += `${chargingStation.chargeBoxSerialNumber}` + Constants.CSV_SEPARATOR;
      csv += `${chargingStation.chargePointVendor}` + Constants.CSV_SEPARATOR;
      csv += `${chargingStation.firmwareVersion}` + Constants.CSV_SEPARATOR;
      csv += `${chargingStation.ocppVersion}` + Constants.CSV_SEPARATOR;
      csv += `${chargingStation.ocppProtocol}` + Constants.CSV_SEPARATOR;
      csv += `${i18nManager.formatDateTime(chargingStation.lastSeen, 'L')} ${i18nManager.formatDateTime(chargingStation.lastSeen, 'LT')}` + Constants.CSV_SEPARATOR;
      csv += `${i18nManager.formatDateTime(chargingStation.lastReboot, 'L')} ${i18nManager.formatDateTime(chargingStation.lastReboot, 'LT')}` + Constants.CSV_SEPARATOR;
      csv += `${chargingStation.maximumPower}` + Constants.CSV_SEPARATOR;
      csv += `${chargingStation.powerLimitUnit}\r\n`;
    }
    return csv;
  }

  private static async handleChargingStationCommand(tenantID: string, user: UserToken, chargingStation: ChargingStation,
    action: ServerAction, command: Command, params: any): Promise<any> {
    let result: any;
    // Get the OCPP Client
    const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(tenantID, chargingStation);
    if (!chargingStationClient) {
      throw new BackendError({
        source: chargingStation.id,
        action: action,
        module: MODULE_NAME, method: 'handleChargingStationCommand',
        message: 'Charging Station is not connected to the backend',
      });
    }
    try {
      // Handle Requests
      switch (command) {
        // Reset
        case Command.RESET:
          result = await chargingStationClient.reset({ type: params.type });
          break;
        // Clear cache
        case Command.CLEAR_CACHE:
          result = await chargingStationClient.clearCache();
          break;
        // Get Configuration
        case Command.GET_CONFIGURATION:
          result = await chargingStationClient.getConfiguration({ key: params.key });
          break;
        // Set Configuration
        case Command.CHANGE_CONFIGURATION:
          // Change the config
          result = await chargingStationClient.changeConfiguration({
            key: params.key,
            value: params.value
          });
          // Check
          if (result.status === OCPPConfigurationStatus.ACCEPTED ||
              result.status === OCPPConfigurationStatus.REBOOT_REQUIRED) {
            // Reboot?
            if (result.status === OCPPConfigurationStatus.REBOOT_REQUIRED) {
              Logging.logWarning({
                tenantID: tenantID,
                source: chargingStation.id,
                user: user,
                action: action,
                module: MODULE_NAME, method: 'handleChargingStationCommand',
                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                message: `Reboot is required due to change of OCPP Parameter '${params.key}' to '${params.value}'`,
                detailedMessages: { result }
              });
            }
            // Custom param?
            if (params.custom) {
              // Get OCPP Parameters from DB
              const ocppParametersFromDB = await ChargingStationStorage.getOcppParameters(tenantID, chargingStation.id);
              // Set new structure
              const chargingStationOcppParameters: ChargingStationOcppParameters = {
                id: chargingStation.id,
                configuration: ocppParametersFromDB.result,
                timestamp: new Date()
              };
              // Search for existing Custom param
              const foundOcppParam = chargingStationOcppParameters.configuration.find((ocppParam) => ocppParam.key === params.key);
              if (foundOcppParam) {
                // Update param
                foundOcppParam.value = params.value;
                // Save config
                if (foundOcppParam.custom) {
                  // Save
                  await ChargingStationStorage.saveOcppParameters(tenantID, chargingStationOcppParameters);
                } else {
                  // Not a custom param: refresh the whole OCPP Parameters
                  await OCPPUtils.requestAndSaveChargingStationOcppParameters(tenantID, chargingStation);
                }
              } else {
                // Add custom param
                chargingStationOcppParameters.configuration.push(params);
                // Save
                await ChargingStationStorage.saveOcppParameters(tenantID, chargingStationOcppParameters);
              }
            } else {
              // Refresh the whole OCPP Parameters
              await OCPPUtils.requestAndSaveChargingStationOcppParameters(tenantID, chargingStation);
            }
            // Check update with Vendor
            const chargingStationVendor = ChargingStationVendorFactory.getChargingStationVendorImpl(chargingStation);
            if (chargingStationVendor) {
              await chargingStationVendor.checkUpdateOfOCPPParams(tenantID, chargingStation, params.key, params.value);
            }
          }
          break;
        // Unlock Connector
        case Command.UNLOCK_CONNECTOR:
          result = await chargingStationClient.unlockConnector({ connectorId: params.connectorId });
          break;
        // Start Transaction
        case Command.REMOTE_START_TRANSACTION:
          result = await chargingStationClient.remoteStartTransaction({
            connectorId: params.connectorId,
            idTag: params.tagID
          });
          break;
        // Stop Transaction
        case Command.REMOTE_STOP_TRANSACTION:
          result = await chargingStationClient.remoteStopTransaction({
            transactionId: params.transactionId
          });
          break;
        // Change availability
        case Command.CHANGE_AVAILABILITY:
          result = await chargingStationClient.changeAvailability({
            connectorId: params.connectorId,
            type: params.type
          });
          break;
        // Get diagnostic
        case Command.GET_DIAGNOSTICS:
          result = await chargingStationClient.getDiagnostics({
            location: params.location,
            retries: params.retries,
            retryInterval: params.retryInterval,
            startTime: params.startTime,
            stopTime: params.stopTime
          });
          break;
        // Update Firmware
        case Command.UPDATE_FIRMWARE:
          result = await chargingStationClient.updateFirmware({
            location: params.location,
            retries: params.retries,
            retrieveDate: params.retrieveDate,
            retryInterval: params.retryInterval
          });
          break;
      }
      // Ok?
      if (result) {
        // OCPP Command with status
        if (Utils.objectHasProperty(result, 'status') && result.status !== OCPPStatus.ACCEPTED) {
          Logging.logError({
            tenantID: tenantID,
            source: chargingStation.id,
            user: user,
            module: MODULE_NAME, method: 'handleChargingStationCommand',
            action: action,
            message: `OCPP Command '${command}' has failed`,
            detailedMessages: { params, result }
          });
        } else {
          // OCPP Command with no status
          Logging.logInfo({
            tenantID: tenantID,
            source: chargingStation.id,
            user: user,
            module: MODULE_NAME, method: 'handleChargingStationCommand',
            action: action,
            message: `OCPP Command '${command}' has been executed successfully`,
            detailedMessages: { params, result }
          });
        }
        return result;
      }
      // Throw error
      throw new AppError({
        source: chargingStation.id,
        action: action,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Unknown OCPP command '${command}'`,
        module: MODULE_NAME,
        method: 'handleChargingStationCommand',
        user: user,
      });
    } catch (error) {
      throw new AppError({
        source: chargingStation.id,
        action: action,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `OCPP Command '${command}' has failed`,
        module: MODULE_NAME, method: 'handleChargingStationCommand',
        user: user,
        detailedMessages: { error: error.message, stack: error.stack, params }
      });
    }
  }
}
