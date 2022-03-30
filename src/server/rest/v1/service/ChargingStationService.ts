import { Action, Entity } from '../../../../types/Authorization';
import ChargingStation, { ChargingStationOcppParameters, ChargingStationQRCode, Command, OCPPParams, OcppParameter, StaticLimitAmps } from '../../../../types/ChargingStation';
import { HTTPAuthError, HTTPError } from '../../../../types/HTTPError';
import { HttpChargingStationChangeConfigurationRequest, HttpChargingStationGetCompositeScheduleRequest, HttpChargingStationStartTransactionRequest, HttpChargingStationStopTransactionRequest, HttpChargingStationsRequest } from '../../../../types/requests/HttpChargingStationRequest';
import { NextFunction, Request, Response } from 'express';
import { OCPICommandResponse, OCPICommandResponseType } from '../../../../types/ocpi/OCPICommandResponse';
import { OCPPChangeConfigurationResponse, OCPPConfigurationStatus, OCPPGetCompositeScheduleResponse, OCPPStatus, OCPPUnlockStatus } from '../../../../types/ocpp/OCPPClient';
import Tenant, { TenantComponents } from '../../../../types/Tenant';

import AppAuthError from '../../../../exception/AppAuthError';
import AppError from '../../../../exception/AppError';
import Authorizations from '../../../../authorization/Authorizations';
import BackendError from '../../../../exception/BackendError';
import { ChargingProfile } from '../../../../types/ChargingProfile';
import ChargingStationClient from '../../../../client/ocpp/ChargingStationClient';
import ChargingStationClientFactory from '../../../../client/ocpp/ChargingStationClientFactory';
import { ChargingStationInErrorType } from '../../../../types/InError';
import ChargingStationStorage from '../../../../storage/mongodb/ChargingStationStorage';
import ChargingStationValidator from '../validator/ChargingStationValidator';
import ChargingStationVendorFactory from '../../../../integration/charging-station-vendor/ChargingStationVendorFactory';
import Constants from '../../../../utils/Constants';
import CpoOCPIClient from '../../../../client/ocpi/CpoOCPIClient';
import CpoOICPClient from '../../../../client/oicp/CpoOICPClient';
import { DataResult } from '../../../../types/DataResult';
import EmspOCPIClient from '../../../../client/ocpi/EmspOCPIClient';
import I18nManager from '../../../../utils/I18nManager';
import LockingHelper from '../../../../locking/LockingHelper';
import LockingManager from '../../../../locking/LockingManager';
import Logging from '../../../../utils/Logging';
import LoggingHelper from '../../../../utils/LoggingHelper';
import OCPIClientFactory from '../../../../client/ocpi/OCPIClientFactory';
import { OCPIEvseStatus } from '../../../../types/ocpi/OCPIEvse';
import { OCPIRole } from '../../../../types/ocpi/OCPIRole';
import OCPPCommon from '../../../ocpp/utils/OCPPCommon';
import OCPPStorage from '../../../../storage/mongodb/OCPPStorage';
import OCPPUtils from '../../../ocpp/utils/OCPPUtils';
import { OICPActionType } from '../../../../types/oicp/OICPEvseData';
import OICPClientFactory from '../../../../client/oicp/OICPClientFactory';
import OICPUtils from '../../../oicp/OICPUtils';
import { ServerAction } from '../../../../types/Server';
import SiteArea from '../../../../types/SiteArea';
import SiteAreaStorage from '../../../../storage/mongodb/SiteAreaStorage';
import SiteStorage from '../../../../storage/mongodb/SiteStorage';
import SmartChargingFactory from '../../../../integration/smart-charging/SmartChargingFactory';
import { StatusCodes } from 'http-status-codes';
import Tag from '../../../../types/Tag';
import TagStorage from '../../../../storage/mongodb/TagStorage';
import TransactionStorage from '../../../../storage/mongodb/TransactionStorage';
import User from '../../../../types/User';
import UserStorage from '../../../../storage/mongodb/UserStorage';
import UserToken from '../../../../types/UserToken';
import Utils from '../../../../utils/Utils';
import UtilsService from './UtilsService';

const MODULE_NAME = 'ChargingStationService';

export default class ChargingStationService {
  public static async handleUpdateChargingStationParams(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationValidator.getInstance().validateChargingStationParametersUpdateReq({ ...req.params, ...req.body });
    // Check the Charging Station
    const chargingStation = await UtilsService.checkAndGetChargingStationAuthorization(
      req.tenant, req.user, filteredRequest.id, Action.UPDATE, action, null, { withSiteArea: true });
    // OCPI Charging Station
    if (!chargingStation.issuer) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Charging Station '${chargingStation.id}' not issued by the organization`,
        module: MODULE_NAME, method: 'handleUpdateChargingStationParams',
        user: req.user,
        action
      });
    }
    // Site Area
    let siteArea: SiteArea = null;
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.ORGANIZATION) && filteredRequest.siteAreaID) {
      siteArea = await UtilsService.checkAndGetSiteAreaAuthorization(
        req.tenant, req.user, filteredRequest.siteAreaID, Action.READ, action, null, { withSite: true });
    }
    // Check Auth
    if (!await Authorizations.canUpdateChargingStation(req.user, siteArea ? siteArea.siteID : null)) {
      throw new AppAuthError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.UPDATE, entity: Entity.CHARGING_STATION,
        module: MODULE_NAME, method: 'handleUpdateChargingStationParams',
        value: chargingStation.id,
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
      // Charging Station is public but cannot belong to a non public Site
      if (Utils.isComponentActiveFromToken(req.user, TenantComponents.ORGANIZATION) &&
          filteredRequest.public && !siteArea.site?.public) {
        throw new AppError({
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          action,
          errorCode: HTTPError.FEATURE_NOT_SUPPORTED_ERROR,
          message: `Cannot set charging station ${chargingStation.id} attached to the non public site ${siteArea.site.name} public`,
          module: MODULE_NAME, method: 'handleUpdateChargingStationParams',
          user: req.user
        });
      }
      chargingStation.public = filteredRequest.public;
      // Handle update in Roaming
      void ChargingStationService.updateChargingStationRoaming(req.tenant, req.user, chargingStation, action);
    }
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.OCPI)) {
      if (Utils.objectHasProperty(filteredRequest, 'tariffID')) {
        chargingStation.tariffID = filteredRequest.tariffID;
      }
    }
    if (Utils.objectHasProperty(filteredRequest, 'excludeFromSmartCharging')) {
      chargingStation.excludeFromSmartCharging = filteredRequest.excludeFromSmartCharging;
    }
    if (Utils.objectHasProperty(filteredRequest, 'forceInactive')) {
      chargingStation.forceInactive = filteredRequest.forceInactive;
    }
    let resetAndApplyTemplate = false;
    if (Utils.objectHasProperty(filteredRequest, 'manualConfiguration')) {
      // Auto config -> Manual Config
      if (!chargingStation.manualConfiguration && filteredRequest.manualConfiguration) {
        chargingStation.manualConfiguration = filteredRequest.manualConfiguration;
        delete chargingStation.templateHash;
        delete chargingStation.templateHashCapabilities;
        delete chargingStation.templateHashOcppStandard;
        delete chargingStation.templateHashOcppVendor;
        delete chargingStation.templateHashTechnical;
      // Manual config -> Auto Config || Auto Config with no Charge Point
      } else if ((chargingStation.manualConfiguration && !filteredRequest.manualConfiguration) ||
        (!filteredRequest.manualConfiguration && Utils.isEmptyArray(chargingStation.chargePoints))) {
        // If charging station is not configured manually anymore, the template will be applied again
        chargingStation.manualConfiguration = filteredRequest.manualConfiguration;
        const chargingStationTemplate = await OCPPUtils.getChargingStationTemplate(chargingStation);
        // If not template was found, throw error (Check is done on technical configuration)
        if (!chargingStationTemplate) {
          throw new AppError({
            action,
            errorCode: HTTPError.GENERAL_ERROR,
            message: `Error occurred while updating chargingStation: '${chargingStation.id}'. No template found`,
            module: MODULE_NAME, method: 'handleUpdateChargingStationParams',
            user: req.user,
          });
        }
        resetAndApplyTemplate = true;
      }
    }
    // Existing Connectors
    if (!Utils.isEmptyArray(filteredRequest.connectors)) {
      for (const filteredConnector of filteredRequest.connectors) {
        const connector = Utils.getConnectorFromID(chargingStation, filteredConnector.connectorId);
        // Update Connectors only if no Charge Point is defined
        if (connector && (Utils.isEmptyArray(chargingStation.chargePoints) || chargingStation.manualConfiguration)) {
          connector.type = filteredConnector.type;
          connector.power = filteredConnector.power;
          connector.amperage = filteredConnector.amperage;
          connector.voltage = filteredConnector.voltage;
          connector.currentType = filteredConnector.currentType;
          connector.numberOfConnectedPhase = filteredConnector.numberOfConnectedPhase;
        }
        connector.phaseAssignmentToGrid = filteredConnector.phaseAssignmentToGrid;
        if (Utils.isComponentActiveFromToken(req.user, TenantComponents.OCPI)) {
          if (Utils.objectHasProperty(filteredConnector, 'tariffID')) {
            connector.tariffID = filteredConnector.tariffID;
          }
        }
      }
    }
    // Manual Config
    if (chargingStation.manualConfiguration) {
      // Existing charge points
      if (!Utils.isEmptyArray(filteredRequest.chargePoints)) {
        // Update and check the Charge Points
        for (const filteredChargePoint of filteredRequest.chargePoints) {
          const chargePoint = Utils.getChargePointFromID(chargingStation, filteredChargePoint.chargePointID);
          // Update Connectors only if manual configuration is enabled
          if (chargePoint) {
            chargePoint.currentType = filteredChargePoint.currentType,
            chargePoint.voltage = filteredChargePoint.voltage,
            chargePoint.amperage = filteredChargePoint.amperage,
            chargePoint.numberOfConnectedPhase = filteredChargePoint.numberOfConnectedPhase,
            chargePoint.cannotChargeInParallel = filteredChargePoint.cannotChargeInParallel,
            chargePoint.sharePowerToAllConnectors = filteredChargePoint.sharePowerToAllConnectors,
            chargePoint.excludeFromPowerLimitation = filteredChargePoint.excludeFromPowerLimitation;
            chargePoint.ocppParamForPowerLimitation = filteredChargePoint.ocppParamForPowerLimitation,
            chargePoint.power = filteredChargePoint.power,
            chargePoint.efficiency = filteredChargePoint.efficiency;
            chargePoint.connectorIDs = filteredChargePoint.connectorIDs;
            UtilsService.checkIfChargePointValid(chargingStation, chargePoint, req);
          } else {
            // If charging station does not have charge points, but request contains charge points, add it to the station
            if (chargingStation.chargePoints) {
              chargingStation.chargePoints.push(filteredChargePoint);
            } else {
              chargingStation.chargePoints = [filteredChargePoint];
            }
            UtilsService.checkIfChargePointValid(chargingStation, filteredChargePoint, req);
          }
        }
      // If charging station contains charge points, but request does not contain charge points, delete them
      } else if (!Utils.isEmptyArray(chargingStation.chargePoints)) {
        delete chargingStation.chargePoints;
      }
    }
    // Update Site Area
    if (siteArea) {
      // OCPI Site Area
      if (!siteArea.issuer) {
        throw new AppError({
          errorCode: HTTPError.GENERAL_ERROR,
          message: `Site Area '${siteArea.name}' with ID '${siteArea.id}' not issued by the organization`,
          module: MODULE_NAME, method: 'handleUpdateChargingStationParams',
          user: req.user,
          action
        });
      }
      chargingStation.companyID = siteArea.site?.companyID;
      chargingStation.siteID = siteArea.siteID;
      chargingStation.siteAreaID = siteArea.id;
      // Check if number of phases corresponds to the site area one
      for (const connector of chargingStation.connectors) {
        const numberOfConnectedPhase = Utils.getNumberOfConnectedPhases(chargingStation, null, connector.connectorId);
        if (numberOfConnectedPhase !== 1 && siteArea?.numberOfPhases === 1) {
          throw new AppError({
            action,
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
      chargingStation.companyID = null;
      chargingStation.siteID = null;
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
    await ChargingStationStorage.saveChargingStation(req.tenant, chargingStation);
    // Reboot the Charging Station to reapply the templates
    if (resetAndApplyTemplate) {
      try {
        // Use the reset to apply the template again
        await OCPPCommon.triggerChargingStationReset(req.tenant, chargingStation, true);
      } catch (error) {
        throw new AppError({
          action,
          errorCode: HTTPError.GENERAL_ERROR,
          message: 'Error occurred while restarting the charging station',
          module: MODULE_NAME, method: 'handleUpdateChargingStationParams',
          user: req.user, actionOnUser: req.user,
          detailedMessages: { error: error.stack }
        });
      }
    }
    await Logging.logInfo({
      tenantID: req.user.tenantID,
      action,
      user: req.user, module: MODULE_NAME,
      method: 'handleUpdateChargingStationParams',
      message: 'Parameters have been updated successfully',
      detailedMessages: {
        'chargingStationURL': chargingStation.chargingStationURL
      }
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }


  public static async handleChargingStationLimitPower(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationValidator.getInstance().validateChargingStationLimitPowerReq(req.body);
    if (!filteredRequest.chargePointID) {
      throw new AppError({
        chargingStationID: filteredRequest.chargingStationID,
        action,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'You must provide a Charge Point ID',
        module: MODULE_NAME, method: 'handleChargingStationLimitPower',
        user: req.user
      });
    }
    // Charging Station
    const chargingStation = await ChargingStationStorage.getChargingStation(req.tenant, filteredRequest.chargingStationID);
    UtilsService.assertObjectExists(action, chargingStation, `Charging Station ID '${filteredRequest.chargingStationID}' does not exist.`,
      MODULE_NAME, 'handleChargingStationLimitPower', req.user);
    // Charge Point
    const chargePoint = Utils.getChargePointFromID(chargingStation, filteredRequest.chargePointID);
    UtilsService.assertObjectExists(action, chargePoint, `Charge Point ID '${filteredRequest.chargePointID}' does not exist.`,
      MODULE_NAME, 'handleChargingStationLimitPower', req.user);
    // Min Current
    const numberOfPhases = Utils.getNumberOfConnectedPhases(chargingStation, chargePoint, 0);
    if (filteredRequest.ampLimitValue < (StaticLimitAmps.MIN_LIMIT_PER_PHASE * numberOfPhases * chargePoint.connectorIDs.length)) {
      throw new AppError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Limitation to ${filteredRequest.ampLimitValue}A is too low, min required is ${StaticLimitAmps.MIN_LIMIT_PER_PHASE * numberOfPhases * chargePoint.connectorIDs.length}A`,
        module: MODULE_NAME, method: 'handleChargingStationLimitPower',
        user: req.user
      });
    }
    let siteID = null;
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.ORGANIZATION)) {
      // Get the Site Area
      const siteArea = await SiteAreaStorage.getSiteArea(req.tenant, chargingStation.siteAreaID);
      siteID = siteArea ? siteArea.siteID : null;
    }
    // Check Auth
    if (!await Authorizations.canUpdateChargingStation(req.user, siteID)) {
      throw new AppAuthError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.UPDATE, entity: Entity.CHARGING_STATION,
        module: MODULE_NAME, method: 'handleChargingStationLimitPower',
        value: chargingStation.id,
      });
    }
    // Get the Vendor instance
    const chargingStationVendor = ChargingStationVendorFactory.getChargingStationVendorImpl(chargingStation);
    if (!chargingStationVendor) {
      throw new AppError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action,
        errorCode: HTTPError.FEATURE_NOT_SUPPORTED_ERROR,
        message: `No vendor implementation is available (${chargingStation.chargePointVendor}) for limiting the charge`,
        module: MODULE_NAME, method: 'handleChargingStationLimitPower',
        user: req.user
      });
    }
    // Check if static limitation is supported
    if (!chargingStationVendor.hasStaticLimitationSupport(chargingStation)) {
      throw new AppError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action,
        errorCode: HTTPError.FEATURE_NOT_SUPPORTED_ERROR,
        message: 'Charging Station does not support power limitation',
        module: MODULE_NAME, method: 'handleChargingStationLimitPower',
        user: req.user
      });
    }
    // Check Charging Profile
    const chargingProfiles = await ChargingStationStorage.getChargingProfiles(req.tenant,
      { chargingStationIDs: [chargingStation.id], connectorID: 0 },
      Constants.DB_PARAMS_MAX_LIMIT);
    const updatedChargingProfiles: ChargingProfile[] = Utils.cloneObject(chargingProfiles.result);
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
            ...LoggingHelper.getChargingStationProperties(chargingStation),
            action,
            user: req.user,
            errorCode: HTTPError.GENERAL_ERROR,
            message: `Cannot change the current limitation to ${filteredRequest.ampLimitValue}A because of an existing charging plan!`,
            module: MODULE_NAME, method: 'handleChargingStationLimitPower',
            detailedMessages: { result: chargingProfiles.result[index] }
          });
        }
        // Log
        await Logging.logWarning({
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          tenantID: req.user.tenantID,
          action,
          user: req.user,
          module: MODULE_NAME, method: 'handleChargingStationLimitPower',
          message: `Adjust the Charging Plan power limit to ${filteredRequest.ampLimitValue}A`,
          detailedMessages: { chargingProfile: chargingProfiles.result[index] }
        });
        // Apply & Save charging plan
        await OCPPUtils.setAndSaveChargingProfile(req.tenant, updatedChargingProfile);
        break;
      }
    }
    // Call the limitation
    const result = await chargingStationVendor.setStaticPowerLimitation(req.tenant, chargingStation,
      chargePoint, filteredRequest.ampLimitValue);
    if (result.status !== OCPPConfigurationStatus.ACCEPTED && result.status !== OCPPConfigurationStatus.REBOOT_REQUIRED) {
      throw new AppError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action,
        errorCode: HTTPError.LIMIT_POWER_ERROR,
        module: MODULE_NAME, method: 'handleChargingStationLimitPower',
        message: `Cannot limit the charger's power to ${filteredRequest.ampLimitValue}A: '${result.status}'`,
        detailedMessages: { result },
        user: req.user
      });
    }
    await Logging.logInfo({
      ...LoggingHelper.getChargingStationProperties(chargingStation),
      tenantID: req.user.tenantID,
      action,
      user: req.user,
      module: MODULE_NAME, method: 'handleChargingStationLimitPower',
      message: `The charger's power limit has been successfully set to ${filteredRequest.ampLimitValue}A`,
      detailedMessages: { result }
    });
    res.json({ status: result.status });
    next();
  }

  public static async handleGetChargingProfiles(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationValidator.getInstance().validateChargingProfilesGetReq(req.query);
    // Check auth
    if (!await Authorizations.canListChargingProfiles(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.LIST, entity: Entity.CHARGING_PROFILE,
        module: MODULE_NAME, method: 'handleGetChargingProfiles'
      });
    }
    // Profiles of the charging station?
    let projectFields: string[] = [
      'profile.chargingProfileKind', 'profile.chargingProfilePurpose', 'profile.stackLevel'
    ];
    if (filteredRequest.ChargingStationID) {
      // Enhanced the projection
      projectFields = [
        'profile'
      ];
    }
    projectFields = [
      'id', 'chargingStationID', 'chargePointID', 'connectorID', 'chargingStation.id',
      'chargingStation.siteArea.id', 'chargingStation.siteArea.name', 'chargingStation.siteArea.maximumPower','chargingStation.siteArea.siteID',
      ...projectFields
    ];
    // Check projection
    const httpProjectFields = UtilsService.httpFilterProjectToArray(filteredRequest.ProjectFields);
    if (!Utils.isEmptyArray(httpProjectFields)) {
      projectFields = projectFields.filter((projectField) => httpProjectFields.includes(projectField));
    }
    // Get the profiles
    const chargingProfiles = await ChargingStationStorage.getChargingProfiles(req.tenant,
      {
        search: filteredRequest.Search,
        chargingStationIDs: filteredRequest.ChargingStationID ? filteredRequest.ChargingStationID.split('|') : null,
        connectorID: filteredRequest.ConnectorID,
        withChargingStation: filteredRequest.WithChargingStation,
        withSiteArea: filteredRequest.WithSiteArea,
        siteIDs: await Authorizations.getAuthorizedSiteIDs(req.tenant, req.user, filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : null),
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields),
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      projectFields
    );
    // Build the result
    res.json(chargingProfiles);
    next();
  }

  public static async handleTriggerSmartCharging(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if Component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.SMART_CHARGING,
      Action.UPDATE, Entity.SITE_AREA, MODULE_NAME, 'handleTriggerSmartCharging');
    // Filter
    const filteredRequest = ChargingStationValidator.getInstance().validateSmartChargingTriggerReq(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.SiteAreaID, MODULE_NAME, 'handleTriggerSmartCharging', req.user);
    // Get Site Area
    const siteArea = await SiteAreaStorage.getSiteArea(req.tenant, filteredRequest.SiteAreaID);
    UtilsService.assertObjectExists(action, siteArea, `Site Area ID '${filteredRequest.SiteAreaID}' does not exist`,
      MODULE_NAME, 'handleTriggerSmartCharging', req.user);
    // Check auth
    if (!(await Authorizations.canUpdateSiteArea(req.user)).authorized) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.UPDATE, entity: Entity.SITE_AREA,
        module: MODULE_NAME, method: 'handleTriggerSmartCharging',
        value: filteredRequest.SiteAreaID,
        companyID: siteArea.site?.companyID,
        siteAreaID: siteArea.id,
        siteID: siteArea.siteID,
      });
    }
    // Call Smart Charging
    const smartCharging = await SmartChargingFactory.getSmartChargingImpl(req.tenant);
    if (!smartCharging) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Smart Charging service is not configured',
        module: MODULE_NAME, method: 'handleTriggerSmartCharging',
        action,
        user: req.user
      });
    }
    const siteAreaLock = await LockingHelper.acquireSiteAreaSmartChargingLock(req.user.tenantID, siteArea);
    if (siteAreaLock) {
      try {
        // Call
        const actionsResponse = await smartCharging.computeAndApplyChargingProfiles(siteArea);
        if (actionsResponse && actionsResponse.inError > 0) {
          throw new AppError({
            action,
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
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGenerateQrCodeForConnector(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationValidator.getInstance().validateChargingStationQRCodeGenerateReq(req.query);
    // Check auth
    if (!await Authorizations.canReadChargingStation(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.READ, entity: Entity.CHARGING_STATION,
        module: MODULE_NAME, method: 'handleGenerateQrCodeForConnector',
        value: filteredRequest.ChargingStationID,
        chargingStationID: filteredRequest.ChargingStationID,
      });
    }
    // Check ChargeBoxID
    UtilsService.assertIdIsProvided(action, filteredRequest.ChargingStationID, MODULE_NAME, 'handleGenerateQrCodeForConnector', req.user);
    // Check ConnectorID
    UtilsService.assertIdIsProvided(action, filteredRequest.ConnectorID, MODULE_NAME, 'handleGenerateQrCodeForConnector', req.user);
    // Get the Charging Station`
    const chargingStation = await ChargingStationStorage.getChargingStation(req.tenant, filteredRequest.ChargingStationID);
    // Found ChargingStation ?
    UtilsService.assertObjectExists(action, chargingStation, `Charging Station ID '${filteredRequest.ChargingStationID}' does not exist`,
      MODULE_NAME, 'handleGetChargingStationOcppParameters', req.user);
    // Found Connector ?
    UtilsService.assertObjectExists(action, Utils.getConnectorFromID(chargingStation, filteredRequest.ConnectorID),
      `Connector ID '${filteredRequest.ConnectorID}' does not exist`,
      MODULE_NAME, 'handleGetChargingStationOcppParameters', req.user);
    const chargingStationQRCode: ChargingStationQRCode = {
      chargingStationID: filteredRequest.ChargingStationID,
      connectorID: filteredRequest.ConnectorID,
      endpoint: Utils.getChargingStationEndpoint(),
      tenantName: req.user.tenantName,
      tenantSubDomain: req.user.tenantSubdomain
    };
    // Generate
    const generatedQR = await Utils.generateQrCode(Buffer.from(JSON.stringify(chargingStationQRCode)).toString('base64'));
    res.json({ image: generatedQR });
    next();
  }

  public static async handleCreateChargingProfile(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationValidator.getInstance().validateChargingProfileCreateReq(req.body);
    const chargingProfileID = await ChargingStationService.setAndSaveChargingProfile(filteredRequest, action, req);
    res.status(StatusCodes.CREATED).send(Object.assign({ id: chargingProfileID }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleUpdateChargingProfile(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationValidator.getInstance().validateChargingProfileUpdateReq({ ...req.params, ...req.body });
    // Check for existing charging profile
    const chargingProfile = await ChargingStationStorage.getChargingProfile(req.tenant, filteredRequest.id);
    UtilsService.assertObjectExists(action, chargingProfile, `Charging Profile ID '${filteredRequest.id}' does not exist.`,
      MODULE_NAME, 'handleUpdateChargingProfile', req.user);
    const chargingProfileID = await ChargingStationService.setAndSaveChargingProfile(filteredRequest, action, req);
    res.send(Object.assign({ id: chargingProfileID }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleDeleteChargingProfile(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check existence
    const chargingProfileID = ChargingStationValidator.getInstance().validateChargingProfileDeleteReq(req.query).ID;
    // Get Profile
    const chargingProfile = await ChargingStationStorage.getChargingProfile(req.tenant, chargingProfileID);
    UtilsService.assertObjectExists(action, chargingProfile, `Charging Profile ID '${chargingProfileID}' does not exist.`,
      MODULE_NAME, 'handleDeleteChargingProfile', req.user);
    // Get Charging Station
    const chargingStation = await ChargingStationStorage.getChargingStation(req.tenant, chargingProfile.chargingStationID);
    UtilsService.assertObjectExists(action, chargingStation, `Charging Station ID '${chargingProfile.chargingStationID}' does not exist.`,
      MODULE_NAME, 'handleDeleteChargingProfile', req.user);
    // OCPI Charging Station
    if (!chargingStation.issuer) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Charging Station '${chargingStation.id}' not issued by the organization`,
        module: MODULE_NAME, method: 'handleDeleteChargingProfile',
        user: req.user,
        action
      });
    }
    // Check Component
    let siteID = null;
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.ORGANIZATION)) {
      // Get the Site Area
      const siteArea = await SiteAreaStorage.getSiteArea(req.tenant, chargingStation.siteAreaID);
      siteID = siteArea ? siteArea.siteID : null;
    }
    // Check Auth
    if (!await Authorizations.canUpdateChargingStation(req.user, siteID)) {
      throw new AppAuthError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.UPDATE, entity: Entity.CHARGING_STATION,
        module: MODULE_NAME, method: 'handleDeleteChargingProfile',
        value: chargingStation.id,
      });
    }
    try {
      // Delete
      await OCPPUtils.clearAndDeleteChargingProfile(req.tenant, chargingProfile);
    } catch (error) {
      throw new AppError({
        action,
        errorCode: HTTPError.CLEAR_CHARGING_PROFILE_NOT_SUCCESSFUL,
        message: 'Error occurred while clearing Charging Profile',
        module: MODULE_NAME, method: 'handleDeleteChargingProfile',
        user: req.user, actionOnUser: req.user,
        detailedMessages: { error: error.stack }
      });
    }
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetChargingStationOcppParameters(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Backward compatibility for the mobile application
    req.query.ChargeBoxID && (req.query.ChargingStationID = req.query.ChargeBoxID);
    // Filter
    const filteredRequest = ChargingStationValidator.getInstance().validateChargingStationOcppParametersGetReq(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.ChargingStationID, MODULE_NAME, 'handleGetChargingStationOcppParameters', req.user);
    // Get the Charging Station`
    const chargingStation = await ChargingStationStorage.getChargingStation(req.tenant, filteredRequest.ChargingStationID);
    // Found?
    UtilsService.assertObjectExists(action, chargingStation, `Charging Station ID '${filteredRequest.ChargingStationID}' does not exist`,
      MODULE_NAME, 'handleGetChargingStationOcppParameters', req.user);
    // Check auth
    if (!await Authorizations.canReadChargingStation(req.user)) {
      throw new AppAuthError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.READ, entity: Entity.CHARGING_STATION,
        module: MODULE_NAME, method: 'handleGetChargingStationOcppParameters',
        value: chargingStation.id,
      });
    }
    // Get the Parameters
    const parameters = await ChargingStationStorage.getOcppParameters(req.tenant, chargingStation.id);
    // Return the result
    res.json(parameters);
    next();
  }

  public static async handleRequestChargingStationOcppParameters(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationValidator.getInstance().validateChargingStationOcppParametersRequestReq(req.body);
    UtilsService.assertIdIsProvided(action, filteredRequest.chargingStationID, MODULE_NAME, 'handleRequestChargingStationOcppParameters', req.user);
    // Check auth
    if (!await Authorizations.canReadChargingStation(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.READ, entity: Entity.CHARGING_STATION,
        module: MODULE_NAME, method: 'handleRequestChargingStationOcppParameters',
        value: filteredRequest.chargingStationID,
        chargingStationID: filteredRequest.chargingStationID,
      });
    }
    // Get the Charging Station
    const chargingStation = await ChargingStationStorage.getChargingStation(req.tenant, filteredRequest.chargingStationID);
    // Found?
    UtilsService.assertObjectExists(action, chargingStation, `Charging Station ID '${filteredRequest.chargingStationID}' does not exist`,
      MODULE_NAME, 'handleRequestChargingStationOcppParameters', req.user);
    // Get the configuration
    let result = await OCPPCommon.requestAndSaveChargingStationOcppParameters(req.tenant, chargingStation);
    if (filteredRequest.forceUpdateOCPPParamsFromTemplate) {
      result = await OCPPUtils.updateChargingStationOcppParametersWithTemplate(req.tenant, chargingStation);
    }
    res.json(result);
    next();
  }

  public static async handleDeleteChargingStation(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const chargingStationID = ChargingStationValidator.getInstance().validateChargingStationDeleteReq(req.query).ID;
    // Check Mandatory fields
    UtilsService.assertIdIsProvided(action, chargingStationID, MODULE_NAME,
      'handleDeleteChargingStation', req.user);
    // Get
    const chargingStation = await ChargingStationStorage.getChargingStation(req.tenant, chargingStationID);
    UtilsService.assertObjectExists(action, chargingStation, `Charging Station ID '${chargingStationID}' does not exist`,
      MODULE_NAME, 'handleDeleteChargingStation', req.user);
    // OCPI Charging Station
    if (!chargingStation.issuer) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Charging Station '${chargingStation.id}' not issued by the organization`,
        module: MODULE_NAME, method: 'handleDeleteChargingStation',
        user: req.user,
        action
      });
    }
    let siteID = null;
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.ORGANIZATION)) {
      // Get the Site Area
      const siteArea = await SiteAreaStorage.getSiteArea(req.tenant, chargingStation.siteAreaID);
      siteID = siteArea ? siteArea.siteID : null;
    }
    // Check auth
    if (!await Authorizations.canDeleteChargingStation(req.user, siteID)) {
      throw new AppAuthError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.DELETE, entity: Entity.CHARGING_STATION,
        module: MODULE_NAME, method: 'handleDeleteChargingStation',
        value: chargingStationID,
      });
    }
    // Deleted
    if (chargingStation.deleted) {
      throw new AppError({
        action,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: `Charging Station with ID '${chargingStationID}' is already deleted`,
        module: MODULE_NAME,
        method: 'handleDeleteChargingStation',
        user: req.user
      });
    }
    for (const connector of chargingStation.connectors) {
      if (connector && connector.currentTransactionID) {
        const transaction = await TransactionStorage.getTransaction(req.tenant, connector.currentTransactionID);
        if (transaction && !transaction.stop) {
          throw new AppError({
            action,
            errorCode: HTTPError.EXISTING_TRANSACTION_ERROR,
            message: `Charging Station '${chargingStation.id}' can't be deleted due to existing active transactions`,
            module: MODULE_NAME,
            method: 'handleDeleteChargingStation',
            user: req.user
          });
        } else {
          OCPPUtils.clearChargingStationConnectorRuntimeData(chargingStation, connector.connectorId);
        }
      }
    }
    // Remove charging station from HBS
    if (chargingStation.public) {
      if (Utils.isComponentActiveFromToken(req.user, TenantComponents.OICP)) {
        try {
          const oicpClient: CpoOICPClient = await OICPClientFactory.getAvailableOicpClient(req.tenant, OCPIRole.CPO) as CpoOICPClient;
          if (oicpClient) {
            // Define get option
            const options = {
              addChargeBoxID: true,
              countryID: oicpClient.getLocalCountryCode(ServerAction.OICP_PUSH_EVSE_DATA),
              partyID: oicpClient.getLocalPartyID(ServerAction.OICP_PUSH_EVSE_DATA)
            };
            // Get Site
            const site = await SiteStorage.getSite(req.tenant, chargingStation.siteID);
            // Push EVSE to OICP platform
            await oicpClient.pushEvseData(OICPUtils.convertChargingStation2MultipleEvses(
              site, chargingStation.siteArea, chargingStation, options), OICPActionType.DELETE);
          }
        } catch (error) {
          await Logging.logError({
            tenantID: req.user.tenantID,
            module: MODULE_NAME, method: 'handleDeleteChargingStation',
            action,
            user: req.user,
            message: `Unable to remove charging station ${chargingStation.id} from HBS`,
            detailedMessages: { error: error.stack }
          });
        }
      }
    }
    // Remove Org
    chargingStation.companyID = null;
    chargingStation.siteID = null;
    chargingStation.siteAreaID = null;
    // Set as deleted
    chargingStation.deleted = true;
    // Check if charging station has had transactions
    const transactions = await TransactionStorage.getTransactions(req.tenant,
      { chargeBoxIDs: [chargingStation.id] }, Constants.DB_PARAMS_SINGLE_RECORD, ['id']);
    if (!Utils.isEmptyArray(transactions.result)) {
      // Delete logically
      await ChargingStationStorage.saveChargingStation(req.tenant, chargingStation);
      // Delete Charging Profiles
      await ChargingStationStorage.deleteChargingProfiles(req.tenant, chargingStation.id);
    } else {
      // Delete physically
      await ChargingStationStorage.deleteChargingStation(req.tenant, chargingStation.id);
    }
    await Logging.logInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleDeleteChargingStation',
      message: `Charging Station '${chargingStation.id}' has been deleted successfully`,
      action,
      detailedMessages: { chargingStation }
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetChargingStation(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationValidator.getInstance().validateChargingStationGetReq({ ...req.params, ...req.query });
    // Check ID is provided
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleGetChargingStation', req.user);
    // Check auth
    if (!await Authorizations.canReadChargingStation(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.READ, entity: Entity.CHARGING_STATION,
        module: MODULE_NAME, method: 'handleGetChargingStation',
        value: filteredRequest.ID
      });
    }
    // Check and Get Charging Station
    // To uncomment when the mobile app will be released with the handling of these params
    // const chargingStation = await UtilsService.checkAndGetChargingStationAuthorization(
    //   req.tenant, req.user, filteredRequest.ID, action, null, {
    //     withSite: filteredRequest.WithSite,
    //     withSiteArea: filteredRequest.WithSiteArea,
    //   }, true);
    const chargingStation = await UtilsService.checkAndGetChargingStationAuthorization(
      req.tenant, req.user, filteredRequest.ID, Action.READ, action, null, {
        withSite: true,
        withSiteArea: true,
      }, true);
    res.json(chargingStation);
    next();
  }

  public static async handleGetChargingStations(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationValidator.getInstance().validateChargingStationsGetReq(req.query);
    // Get Charging Stations
    res.json(await ChargingStationService.getChargingStations(req, filteredRequest));
    next();
  }

  public static async handleExportChargingStationsOCPPParams(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Always with site
    req.query.WithSite = 'true';
    req.query.WithSiteArea = 'true';
    // Filter
    const filteredRequest = ChargingStationValidator.getInstance().validateChargingStationsGetReq(req.query);
    // Get Charging Stations
    const chargingStations = await ChargingStationService.getChargingStations(req, filteredRequest);
    for (const chargingStation of chargingStations.result) {
      // Check all chargers
      if (!await Authorizations.canExportParams(req.user, chargingStation.siteArea.siteID)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.FORBIDDEN,
          user: req.user,
          action: Action.EXPORT,
          entity: Entity.CHARGING_STATION,
          module: MODULE_NAME,
          method: 'handleExportChargingStationsOCPPParams',
        });
      }
    }
    // Set the attachment name
    res.attachment('exported-ocpp-params.csv');
    let writeHeader = true;
    for (const chargingStation of chargingStations.result) {
      const ocppParameters = await ChargingStationStorage.getOcppParameters(req.tenant, chargingStation.id);
      // Get OCPP Params
      const dataToExport = ChargingStationService.convertOCPPParamsToCSV({
        params: ocppParameters.result,
        siteName: chargingStation.site.name,
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
    // Force params
    req.query.Limit = Constants.EXPORT_PAGE_SIZE.toString();
    // Filter
    const filteredRequest = ChargingStationValidator.getInstance().validateChargingStationsGetReq(req.query);
    // Export
    await UtilsService.exportToCSV(req, res, 'exported-charging-stations.csv', filteredRequest,
      ChargingStationService.getChargingStations.bind(this),
      ChargingStationService.convertToCSV.bind(this));
  }

  public static async handleDownloadQrCodesPdf(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationValidator.getInstance().validateChargingStationQRCodeDownloadReq(req.query);
    if (!filteredRequest.SiteID && !filteredRequest.SiteAreaID && !filteredRequest.ChargingStationID) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Site ID or Site Area ID or Charging Station ID must be provided',
        module: MODULE_NAME, method: 'handleDownloadQrCodesPdf',
        user: req.user
      });
    }
    // Export
    await UtilsService.exportToPDF(req, res, 'exported-charging-stations-qr-code.pdf',
      ChargingStationService.getChargingStationsForQrCode.bind(this),
      ChargingStationService.convertQrCodeToPDF.bind(this));
  }


  public static async handleGetChargingStationsInError(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!await Authorizations.canListChargingStationsInError(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.IN_ERROR, entity: Entity.CHARGING_STATION,
        module: MODULE_NAME, method: 'handleGetChargingStations'
      });
    }
    // Filter
    const filteredRequest = ChargingStationValidator.getInstance().validateChargingStationInErrorReq(req.query);
    // Check component
    if (filteredRequest.SiteID) {
      UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
        Action.READ, Entity.CHARGING_STATION, MODULE_NAME, 'handleGetChargingStations');
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
    let projectFields = [
      'id', 'inactive', 'connectorsStatus', 'connectorsConsumption', 'public', 'errorCodeDetails', 'errorCode', 'lastSeen',
      'connectors.connectorId', 'connectors.status', 'connectors.type', 'connectors.power', 'connectors.errorCode',
    ];
    // Check projection
    const projectHttpFields = UtilsService.httpFilterProjectToArray(filteredRequest.ProjectFields);
    if (!Utils.isEmptyArray(projectHttpFields)) {
      projectFields = projectFields.filter((projectField) => projectHttpFields.includes(projectField));
    }
    // Get Charging Stations
    const chargingStations = await ChargingStationStorage.getChargingStationsInError(req.tenant,
      {
        search: filteredRequest.Search,
        siteIDs: await Authorizations.getAuthorizedSiteIDs(req.tenant, req.user, filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : null),
        siteAreaIDs: (filteredRequest.SiteAreaID ? filteredRequest.SiteAreaID.split('|') : null),
        errorType
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields),
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      projectFields
    );
    res.json(chargingStations);
  }

  public static async handleGetStatusNotifications(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!await Authorizations.canListChargingStations(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.LIST, entity: Entity.CHARGING_STATION,
        module: MODULE_NAME, method: 'handleGetStatusNotifications'
      });
    }
    // Filter
    const filteredRequest = ChargingStationValidator.getInstance().validateChargingStationNotificationsGetReq(req.query);
    // Get all Status Notifications
    const statusNotifications = await OCPPStorage.getStatusNotifications(req.tenant, {},
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields) });
    res.json(statusNotifications);
    next();
  }

  public static async handleReserveNow(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!await Authorizations.canListChargingStations(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.LIST, entity: Entity.CHARGING_STATION,
        module: MODULE_NAME, method: 'handleReserveNow'
      });
    }
    // Request assembly
    req.body.chargingStationID = req.params.id;
    // Filter
    const filteredRequest = ChargingStationValidator.getInstance().validateChargingStationActionReserveNowReq(req.body);
    // Get the Charging station
    const chargingStation = await UtilsService.checkAndGetChargingStationAuthorization(
      req.tenant, req.user, filteredRequest.chargingStationID, Action.READ, action, null, { withSite: true, withSiteArea: true });
    // Get the OCPP Client
    const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(req.tenant, chargingStation);
    if (!chargingStationClient) {
      throw new BackendError({
        action,
        module: MODULE_NAME, method: 'handleReserveNow',
        message: 'Charging Station is not connected to the backend',
      });
    }
    res.json(await chargingStationClient.reserveNow(filteredRequest.args));
    next();
  }

  public static async handleCancelReservation(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Request assembly
    req.body.chargingStationID = req.params.id;
    // Filter
    const filteredRequest = ChargingStationValidator.getInstance().validateChargingStationActionReservationCancelReq(req.body);
    // Get the Charging station
    const chargingStation = await UtilsService.checkAndGetChargingStationAuthorization(
      req.tenant, req.user, filteredRequest.chargingStationID, Action.READ, action, null, { withSite: true, withSiteArea: true });
    // Get the OCPP Client
    const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(req.tenant, chargingStation);
    if (!chargingStationClient) {
      throw new BackendError({
        action,
        module: MODULE_NAME, method: 'handleCancelReservation',
        message: 'Charging Station is not connected to the backend',
      });
    }
    const result = await chargingStationClient.cancelReservation(filteredRequest.args);
    res.json(result);
    next();
  }

  public static async handleGetBootNotifications(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!await Authorizations.canListChargingStations(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user, action: Action.LIST,
        entity: Entity.CHARGING_STATION,
        module: MODULE_NAME, method: 'handleGetBootNotifications'
      });
    }
    // Filter
    const filteredRequest = ChargingStationValidator.getInstance().validateChargingStationNotificationsGetReq(req.query);
    // Get all Status Notifications
    const bootNotifications = await OCPPStorage.getBootNotifications(req.tenant, {},
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields) });
    res.json(bootNotifications);
    next();
  }

  public static async handleGetFirmware(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationValidator.getInstance().validateChargingStationFirmwareDownloadReq(req.query);
    if (!filteredRequest.FileName) {
      throw new AppError({
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
      void Logging.logError({
        tenantID: Constants.DEFAULT_TENANT,
        action,
        message: `Firmware '${filteredRequest.FileName}' has not been found!`,
        module: MODULE_NAME, method: 'handleGetFirmware',
        detailedMessages: { error: error.stack },
      });
      // Remove file related headers
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', '');
      res.sendStatus(StatusCodes.NOT_FOUND);
    });
    // End of download
    await new Promise((resolve) => {
      bucketStream.on('end', () => {
        void Logging.logInfo({
          tenantID: Constants.DEFAULT_TENANT,
          action,
          message: `Firmware '${filteredRequest.FileName}' has been downloaded with success`,
          module: MODULE_NAME, method: 'handleGetFirmware',
        });
        res.end();
        resolve();
      });
    });
  }

  public static async handleOcpiAction(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OCPI,
      Action.UPDATE, Entity.CHARGING_STATION, MODULE_NAME, 'handleOcpiAction');
    // Get the Charging station
    const chargingStation = await UtilsService.checkAndGetChargingStationAuthorization(
      req.tenant, req.user, req.body.chargingStationID, Action.READ, action, null, { withSite: true, withSiteArea: true });
    // Check
    if (chargingStation.issuer) {
      throw new AppError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        user: req.user,
        errorCode: HTTPError.GENERAL_ERROR,
        module: MODULE_NAME, method: 'handleOcpiAction', action,
        message: 'This Charging Station is not a Roaming Charging Station',
        detailedMessages: { chargingStation },
      });
    }
    try {
      let filteredRequest: any;
      let result: OCPICommandResponse;
      // Start Transaction
      if (action === ServerAction.OCPI_EMSP_START_SESSION) {
        const remoteStartRequest = ChargingStationValidator.getInstance().validateChargingStationActionTransactionStartReq(req.body);
        filteredRequest = remoteStartRequest;
        // Get the Tag
        let tagID = remoteStartRequest.args.tagID;
        if (!tagID && remoteStartRequest.args.visualTagID) {
          // Check and Get Tag
          const tag = await UtilsService.checkAndGetTagByVisualIDAuthorization(
            req.tenant, req.user, remoteStartRequest.args.visualTagID, Action.READ, action, null, {}, true);
          if (!tag) {
            throw new AppError({
              ...LoggingHelper.getChargingStationProperties(chargingStation),
              user: req.user,
              errorCode: HTTPError.GENERAL_ERROR,
              module: MODULE_NAME, method: 'handleOcpiAction', action,
              message: `Tag with Visual ID '${remoteStartRequest.args.visualTagID}' does not exist`,
              detailedMessages: { remoteStartRequest, chargingStation },
            });
          }
          tagID = tag.id;
        }
        // Get OCPI client
        const ocpiClient = await OCPIClientFactory.getAvailableOcpiClient(req.tenant, OCPIRole.EMSP) as EmspOCPIClient;
        if (!ocpiClient) {
          throw new BackendError({
            ...LoggingHelper.getChargingStationProperties(chargingStation),
            action, module: MODULE_NAME, method: 'handleOcpiAction',
            message: `${Utils.buildConnectorInfo(remoteStartRequest.args.connectorId)} OCPI component requires at least one eMSP endpoint to stop a Transaction`
          });
        }
        // Start the Transaction
        result = await ocpiClient.remoteStartSession(chargingStation, remoteStartRequest.args.connectorId, tagID);
      }
      // Stop Transaction
      if (action === ServerAction.OCPI_EMSP_STOP_SESSION) {
        const remoteStopRequest = ChargingStationValidator.getInstance().validateChargingStationActionTransactionStopReq(req.body);
        filteredRequest = remoteStopRequest;
        // Get Transaction
        const transaction = await TransactionStorage.getTransaction(
          req.tenant, remoteStopRequest.args.transactionId, { withUser: true });
        UtilsService.assertObjectExists(action, transaction, `Transaction ID '${remoteStopRequest.args.transactionId}' does not exist`,
          MODULE_NAME, 'handleOcpiAction', req.user);
        // Get OCPI client
        const ocpiClient = await OCPIClientFactory.getAvailableOcpiClient(req.tenant, OCPIRole.EMSP) as EmspOCPIClient;
        if (!ocpiClient) {
          throw new BackendError({
            ...LoggingHelper.getChargingStationProperties(chargingStation),
            action, module: MODULE_NAME, method: 'handleOcpiAction',
            message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} OCPI component requires at least one eMSP endpoint to start a Transaction`
          });
        }
        // Stop the Transaction
        result = await ocpiClient.remoteStopSession(transaction.id);
      }
      // Action not found
      if (!filteredRequest) {
        throw new AppError({
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          errorCode: HTTPError.GENERAL_ERROR,
          module: MODULE_NAME, method: 'handleOcpiAction', action,
          message: `Unknown OCPI Action '${action}'`,
          user: req.user,
        });
      }
      if (result.result === OCPICommandResponseType.ACCEPTED) {
        res.json(Constants.REST_CHARGING_STATION_COMMAND_RESPONSE_SUCCESS);
      } else {
        res.json({ status: result.result });
      }
      next();
    } catch (error) {
      throw new AppError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        errorCode: error instanceof AppError ? error.params.errorCode : HTTPError.GENERAL_ERROR,
        module: MODULE_NAME, method: 'handleOcppAction', action,
        message: `OCPI Action '${action}' has failed: ${error.message as string}`,
        user: req.user,
        detailedMessages: { error: error.stack }
      });
    }
  }

  public static async handleOcppAction(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Backward compatibility for the mobile application
    if (req.body.chargeBoxID) {
      req.body.chargingStationID = req.body.chargeBoxID;
    }
    // Filter - Type is hacked because code below is. Would need approval to change code structure.
    const command = action.slice('Ocpp'.length) as Command;
    UtilsService.assertIdIsProvided(action, req.body.chargingStationID, MODULE_NAME, 'handleOCPPAction', req.user);
    // Get the Charging station
    const chargingStation = await UtilsService.checkAndGetChargingStationAuthorization(
      req.tenant, req.user, req.body.chargingStationID, Action.READ, action, null, { withSite: true, withSiteArea: true });
    // Check auth
    if (!await Authorizations.canPerformActionOnChargingStation(req.user, command as unknown as Action, chargingStation)) {
      throw new AppAuthError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: command as unknown as Action,
        entity: Entity.CHARGING_STATION,
        module: MODULE_NAME, method: 'handleOcppAction',
        value: chargingStation.id,
      });
    }
    // Get the OCPP Client
    const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(req.tenant, chargingStation);
    if (!chargingStationClient) {
      throw new BackendError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        module: MODULE_NAME, method: 'handleOcppAction', action,
        message: 'Charging Station is not connected to the backend',
      });
    }
    try {
      let filteredRequest: any;
      let result: any;
      // Clear Cache
      if (command === Command.CLEAR_CACHE) {
        const clearCacheRequest = ChargingStationValidator.getInstance().validateChargingStationActionCacheClearReq(req.body);
        filteredRequest = clearCacheRequest;
        result = await chargingStationClient.clearCache();
      }
      // Change Availability
      if (command === Command.CHANGE_AVAILABILITY) {
        const changeAvailabilityRequest = ChargingStationValidator.getInstance().validateChargingStationActionAvailabilityChangeReq(req.body);
        filteredRequest = changeAvailabilityRequest;
        result = await chargingStationClient.changeAvailability({
          connectorId: changeAvailabilityRequest.args.connectorId,
          type: changeAvailabilityRequest.args.type
        });
      }
      // Get Configuration
      if (command === Command.GET_CONFIGURATION) {
        const getConfigurationRequest = ChargingStationValidator.getInstance().validateChargingStationActionConfigurationGetReq(req.body);
        filteredRequest = getConfigurationRequest;
        result = await chargingStationClient.getConfiguration({ key: getConfigurationRequest.args.key });
      }
      // Change Configuration
      if (command === Command.CHANGE_CONFIGURATION) {
        const changeConfigurationRequest = ChargingStationValidator.getInstance().validateChargingStationActionConfigurationChangeReq(req.body);
        filteredRequest = changeConfigurationRequest;
        result = await ChargingStationService.executeChargingStationChangeConfiguration(
          action, chargingStation, command, changeConfigurationRequest, req, res, next, chargingStationClient);
      }
      // Data Transfer
      if (command === Command.DATA_TRANSFER) {
        const dataTransferRequest = ChargingStationValidator.getInstance().validateChargingStationActionDataTransferReq(req.body);
        filteredRequest = dataTransferRequest;
        result = await chargingStationClient.dataTransfer(dataTransferRequest.args);
      }
      // Remote Stop Transaction
      if (command === Command.REMOTE_STOP_TRANSACTION) {
        const remoteStopRequest = ChargingStationValidator.getInstance().validateChargingStationActionTransactionStopReq(req.body);
        filteredRequest = remoteStopRequest;
        result = await ChargingStationService.executeChargingStationStopTransaction(
          action, chargingStation, command, remoteStopRequest, req, res, next, chargingStationClient);
      }
      // Remote Start Transaction
      if (command === Command.REMOTE_START_TRANSACTION) {
        const remoteStartRequest = ChargingStationValidator.getInstance().validateChargingStationActionTransactionStartReq(req.body);
        filteredRequest = remoteStartRequest;
        result = await ChargingStationService.executeChargingStationStartTransaction(
          action, chargingStation, command, remoteStartRequest, req, res, next, chargingStationClient);
      }
      // Get the Charging Plans
      if (command === Command.GET_COMPOSITE_SCHEDULE) {
        const compositeScheduleRequest = ChargingStationValidator.getInstance().validateChargingStationActionCompositeScheduleGetReq(req.body);
        filteredRequest = compositeScheduleRequest;
        result = await ChargingStationService.executeChargingStationGetCompositeSchedule(
          action, chargingStation, command, compositeScheduleRequest, req, res, next);
      }
      // Get Diagnostic
      if (command === Command.GET_DIAGNOSTICS) {
        const diagnosticsRequest = ChargingStationValidator.getInstance().validateChargingStationDiagnosticsGetReq(req.body);
        filteredRequest = diagnosticsRequest;
        result = await chargingStationClient.getDiagnostics({
          location: diagnosticsRequest.args.location,
          retries: diagnosticsRequest.args.retries,
          retryInterval: diagnosticsRequest.args.retryInterval,
          startTime: diagnosticsRequest.args.startTime,
          stopTime: diagnosticsRequest.args.stopTime
        });
      }
      // Unlock Connector
      if (command === Command.UNLOCK_CONNECTOR) {
        const unlockConnectorRequest = ChargingStationValidator.getInstance().validateChargingStationActionConnectorUnlockReq(req.body);
        filteredRequest = unlockConnectorRequest;
        result = await chargingStationClient.unlockConnector({ connectorId: unlockConnectorRequest.args.connectorId });
      }
      // Update Firmware
      if (command === Command.UPDATE_FIRMWARE) {
        const updateFirmwareRequest = ChargingStationValidator.getInstance().validateChargingStationActionFirmwareUpdateReq(req.body);
        filteredRequest = updateFirmwareRequest;
        result = await chargingStationClient.updateFirmware({
          location: updateFirmwareRequest.args.location,
          retries: updateFirmwareRequest.args.retries,
          retrieveDate: updateFirmwareRequest.args.retrieveDate,
          retryInterval: updateFirmwareRequest.args.retryInterval
        });
      }
      // Reset
      if (command === Command.RESET) {
        const resetRequest = ChargingStationValidator.getInstance().validateChargingStationActionResetReq(req.body);
        filteredRequest = resetRequest;
        result = await chargingStationClient.reset({ type: resetRequest.args.type });
      }
      // Command not found
      if (!filteredRequest) {
        throw new AppError({
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          errorCode: HTTPError.GENERAL_ERROR,
          module: MODULE_NAME, method: 'handleOcppAction', action,
          message: `Unknown OCPP command '${command}'`,
          user: req.user,
        });
      }
      // Expect result
      if (!result) {
        throw new AppError({
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          errorCode: HTTPError.GENERAL_ERROR,
          module: MODULE_NAME, method: 'handleOcppAction', action,
          message: `Received an empty response from OCPP command '${command}'`,
          user: req.user,
        });
      }
      // OCPP Command with status
      if (Utils.objectHasProperty(result, 'status') && ![OCPPStatus.ACCEPTED, OCPPUnlockStatus.UNLOCKED].includes(result.status)) {
        await Logging.logError({
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          tenantID: req.tenant.id,
          user: req.user,
          module: MODULE_NAME, method: 'handleOcppAction', action,
          message: `OCPP Command '${command}' has failed`,
          detailedMessages: { filteredRequest, result }
        });
      } else {
        // OCPP Command with no status
        await Logging.logInfo({
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          tenantID: req.tenant.id,
          user: req.user,
          module: MODULE_NAME, method: 'handleOcppAction', action,
          message: `OCPP Command '${command}' has been executed successfully`,
          detailedMessages: { filteredRequest, result }
        });
      }
      res.json(result);
      next();
    } catch (error) {
      throw new AppError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        errorCode: error instanceof AppError ? error.params.errorCode : HTTPError.GENERAL_ERROR,
        module: MODULE_NAME, method: 'handleOcppAction', action,
        message: `OCPP Command '${command}' has failed: ${error.message as string}`,
        user: req.user,
        detailedMessages: { error: error.stack }
      });
    }
  }

  public static async handleCheckSmartChargingConnection(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if Component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.SMART_CHARGING,
      Action.CHECK_CONNECTION, Entity.CHARGING_STATION, MODULE_NAME, 'handleCheckSmartChargingConnection');
    // Check auth
    if (!await Authorizations.canReadSetting(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        entity: Entity.SETTING,
        action: Action.UPDATE,
        module: MODULE_NAME,
        method: 'handleCheckSmartChargingConnection'
      });
    }
    // Get implementation
    const smartCharging = await SmartChargingFactory.getSmartChargingImpl(req.tenant);
    if (!smartCharging) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Smart Charging service is not configured',
        module: MODULE_NAME, method: 'handleCheckSmartChargingConnection',
        action,
        user: req.user
      });
    }
    await smartCharging.checkConnection();
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  private static async getChargingStations(req: Request, filteredRequest: HttpChargingStationsRequest, projectFields?: string[]): Promise<DataResult<ChargingStation>> {
    // Check auth
    if (!await Authorizations.canListChargingStations(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.LIST, entity: Entity.CHARGING_STATION,
        module: MODULE_NAME, method: 'getChargingStations',
      });
    }
    // Create GPS Coordinates
    if (filteredRequest.LocLongitude && filteredRequest.LocLatitude) {
      filteredRequest.LocCoordinates = [
        Utils.convertToFloat(filteredRequest.LocLongitude),
        Utils.convertToFloat(filteredRequest.LocLatitude)
      ];
    }
    // Check Users
    let userProject: string[] = [];
    if ((await Authorizations.canListUsers(req.user)).authorized) {
      userProject = ['connectors.user.id', 'connectors.user.name', 'connectors.user.firstName', 'connectors.user.email'];
    }
    // Project fields
    if (!projectFields) {
      projectFields = [
        'id', 'inactive', 'connectorsStatus', 'connectorsConsumption', 'public', 'firmwareVersion', 'chargePointVendor', 'chargePointModel',
        'ocppVersion', 'ocppProtocol', 'lastSeen', 'firmwareUpdateStatus', 'coordinates', 'issuer', 'voltage', 'distanceMeters',
        'siteAreaID', 'siteArea.id', 'siteArea.name', 'siteArea.siteID', 'site.name', 'siteArea.address', 'siteID', 'maximumPower', 'powerLimitUnit',
        'chargePointModel', 'chargePointSerialNumber', 'chargeBoxSerialNumber', 'connectors.connectorId', 'connectors.status', 'connectors.type', 'connectors.power', 'connectors.errorCode',
        'connectors.currentTotalConsumptionWh', 'connectors.currentInstantWatts', 'connectors.currentStateOfCharge', 'connectors.info', 'connectors.vendorErrorCode',
        'connectors.currentTransactionID', 'connectors.currentTotalInactivitySecs', 'connectors.currentTagID', 'chargePoints', 'lastReboot', 'createdOn',
        ...userProject
      ];
    } else {
      projectFields = [
        ...projectFields,
        ...userProject
      ];
    }
    // Check projection
    const httpProjectFields = UtilsService.httpFilterProjectToArray(filteredRequest.ProjectFields);
    if (!Utils.isEmptyArray(httpProjectFields)) {
      projectFields = projectFields.filter((projectField) => httpProjectFields.includes(projectField));
    }
    const siteIDs = await Authorizations.getAuthorizedSiteIDs(req.tenant, req.user, filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : null);
    // todo: write this in a nicer way when refactoring the whole auth concept for ChargingStation
    if (Utils.isEmptyArray(siteIDs) && !Authorizations.isAdmin(req.user)) {
      return { count: 0, result: [] };
    }
    // Get Charging Stations
    return ChargingStationStorage.getChargingStations(req.tenant,
      {
        search: filteredRequest.Search,
        withNoSiteArea: filteredRequest.WithNoSiteArea,
        withSite: filteredRequest.WithSite,
        withSiteArea: filteredRequest.WithSiteArea,
        withUser: filteredRequest.WithUser,
        chargingStationIDs: filteredRequest.ChargingStationID ? filteredRequest.ChargingStationID.split('|') : null,
        connectorStatuses: filteredRequest.ConnectorStatus ? filteredRequest.ConnectorStatus.split('|') : null,
        connectorTypes: filteredRequest.ConnectorType ? filteredRequest.ConnectorType.split('|') : null,
        issuer: filteredRequest.Issuer,
        siteIDs: siteIDs,
        siteAreaIDs: filteredRequest.SiteAreaID ? filteredRequest.SiteAreaID.split('|') : null,
        companyIDs: filteredRequest.CompanyID ? filteredRequest.CompanyID.split('|') : null,
        includeDeleted: filteredRequest.IncludeDeleted,
        locCoordinates: filteredRequest.LocCoordinates,
        locMaxDistanceMeters: filteredRequest.LocMaxDistanceMeters,
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields),
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      projectFields
    );
  }

  private static convertOCPPParamsToCSV(ocppParams: OCPPParams, writeHeader = true): string {
    let headers = null;
    // Header
    if (writeHeader) {
      headers = [
        'chargingStation',
        'name',
        'value',
        'siteArea',
        'site'
      ].join(Constants.CSV_SEPARATOR);
    }
    // Content
    const rows = ocppParams.params.map((param) => {
      const row = [
        ocppParams.chargingStationName,
        param.key,
        Utils.replaceSpecialCharsInCSVValueParam(param.value),
        ocppParams.siteAreaName,
        ocppParams.siteName,
      ].map((value) => Utils.escapeCsvValue(value));
      return row;
    }).join(Constants.CR_LF);
    return Utils.isNullOrUndefined(headers) ? Constants.CR_LF + rows : [headers, rows].join(Constants.CR_LF);
  }

  private static convertToCSV(req: Request, chargingStations: ChargingStation[], writeHeader = true): string {
    // Build createdOn cell
    const getCreatedOnCell = (chargingStation: ChargingStation, i18nManager: I18nManager) => {
      if (chargingStation.createdOn) {
        return [i18nManager.formatDateTime(chargingStation.createdOn, 'L') + ' ' + i18nManager.formatDateTime(chargingStation.createdOn, 'LT')];
      }
      return [i18nManager.translate('general.invalidDate') + ' ' + i18nManager.translate('general.invalidTime')];
    };
    // Build coordinates cell
    const getCoordinatesCell = (chargingStation: ChargingStation) => {
      if (chargingStation.coordinates && chargingStation.coordinates.length === 2) {
        return [chargingStation.coordinates[1], chargingStation.coordinates[0]];
      }
      return ['', ''];
    };
    let headers = null;
    const i18nManager = I18nManager.getInstanceForLocale(req.user.locale);
    // Header
    if (writeHeader) {
      headers = [
        'name',
        'createdOn',
        'numberOfConnectors',
        'siteArea',
        'latitude',
        'longitude',
        'chargePointSerialNumber',
        'model',
        'chargeBoxSerialNumber',
        'vendor',
        'firmwareVersion',
        'ocppVersion',
        'ocppProtocol',
        'lastSeen',
        'lastReboot',
        'maxPower',
        'powerLimitUnit'
      ].join(Constants.CSV_SEPARATOR);
    }
    // Content
    const rows = chargingStations.map((chargingStation) => {
      const row = [
        chargingStation.id,
        getCreatedOnCell(chargingStation, i18nManager),
        chargingStation.connectors ? chargingStation.connectors.length : '0',
        chargingStation?.siteArea?.name ? chargingStation.siteArea.name : '',
        getCoordinatesCell(chargingStation),
        chargingStation.chargePointSerialNumber,
        chargingStation.chargePointModel,
        chargingStation.chargeBoxSerialNumber,
        chargingStation.chargePointVendor,
        chargingStation.firmwareVersion,
        chargingStation.ocppVersion,
        chargingStation.ocppProtocol,
        i18nManager.formatDateTime(chargingStation.lastSeen, 'L') + ' ' + i18nManager.formatDateTime(chargingStation.lastSeen, 'LT'),
        i18nManager.formatDateTime(chargingStation.lastReboot, 'L') + ' ' + i18nManager.formatDateTime(chargingStation.lastReboot, 'LT'),
        chargingStation.maximumPower,
        chargingStation.powerLimitUnit
      ].map((value) => Utils.escapeCsvValue(value));
      return row;
    }).join(Constants.CR_LF);
    return Utils.isNullOrUndefined(headers) ? Constants.CR_LF + rows : [headers, rows].join(Constants.CR_LF);
  }

  private static async getChargingStationsForQrCode(req: Request): Promise<DataResult<ChargingStation>> {
    // Filter
    const filteredRequest = ChargingStationValidator.getInstance().validateChargingStationsGetReq(req.query);
    // Get Charging Stations
    return ChargingStationService.getChargingStations(req, filteredRequest, ['id', 'connectors.connectorId', 'siteArea.name']);
  }

  private static async convertQrCodeToPDF(req: Request, pdfDocument: PDFKit.PDFDocument, chargingStations: ChargingStation[]): Promise<void> {
    const i18nManager = I18nManager.getInstanceForLocale(req.user.locale);
    // Check for Connector ID
    let connectorID = null;
    if (req.query.ConnectorID) {
      connectorID = Utils.convertToInt(req.query.ConnectorID);
    }
    // Content
    for (const chargingStation of chargingStations) {
      if (!Utils.isEmptyArray(chargingStation.connectors)) {
        for (const connector of chargingStation.connectors) {
          // Filter on connector ID?
          if (connectorID > 0 && connector.connectorId !== connectorID) {
            continue;
          }
          // Create data
          const chargingStationQRCode: ChargingStationQRCode = {
            chargingStationID: chargingStation.id,
            connectorID: connector.connectorId,
            endpoint: Utils.getChargingStationEndpoint(),
            tenantName: req.user.tenantName,
            tenantSubDomain: req.user.tenantSubdomain
          };
          // Generated QR-Code
          const qrCodeImage = await Utils.generateQrCode(
            Buffer.from(JSON.stringify(chargingStationQRCode)).toString('base64'));
          // Build title
          const qrCodeTitle = `${chargingStation.id} / ${i18nManager.translate('chargers.connector')} ${Utils.getConnectorLetterFromConnectorID(connector.connectorId)}`;
          // Add the QR Codes
          ChargingStationService.build3SizesPDFQrCode(pdfDocument, qrCodeImage, qrCodeTitle);
          // Add page (expect the last one)
          if (!connectorID && (chargingStations[chargingStations.length - 1] !== chargingStation ||
              chargingStation.connectors[chargingStation.connectors.length - 1] !== connector)) {
            pdfDocument.addPage();
          }
        }
      }
    }
  }

  private static build3SizesPDFQrCode(pdfDocument: PDFKit.PDFDocument, qrCodeImage: string, qrCodeTitle: string): void {
    const bigSquareSide = 300;
    const mediumSquareSide = 150;
    const smallSquareSide = 75;
    const marginHeight = 50;
    // Add big QR-Code
    pdfDocument.image(qrCodeImage, (pdfDocument.page.width / 2) - (bigSquareSide / 2), marginHeight, {
      width: bigSquareSide, height: bigSquareSide,
    });
    pdfDocument.fontSize(18);
    pdfDocument.text(qrCodeTitle, 65, bigSquareSide + marginHeight, { align: 'center' });
    // Add medium QR-Code
    pdfDocument.image(qrCodeImage, (pdfDocument.page.width / 2) - (mediumSquareSide / 2), (bigSquareSide + (marginHeight * 2)), {
      width: mediumSquareSide, height: mediumSquareSide,
    });
    pdfDocument.fontSize(12);
    pdfDocument.text(qrCodeTitle, 65, bigSquareSide + mediumSquareSide + (marginHeight * 2) + 10, { align: 'center' });
    // Add small QR-Code
    pdfDocument.image(qrCodeImage, (pdfDocument.page.width / 2) - (smallSquareSide / 2), (bigSquareSide + mediumSquareSide + (marginHeight * 3)), {
      width: smallSquareSide, height: smallSquareSide,
    });
    pdfDocument.fontSize(8);
    pdfDocument.text(qrCodeTitle, 65, bigSquareSide + mediumSquareSide + smallSquareSide + (marginHeight * 3) + 10, { align: 'center' });
  }

  private static async setAndSaveChargingProfile(filteredRequest: ChargingProfile, action: ServerAction, req: Request): Promise<string> {
    // Check existence
    const chargingStation = await ChargingStationStorage.getChargingStation(req.tenant, filteredRequest.chargingStationID);
    UtilsService.assertObjectExists(action, chargingStation, `Charging Station ID '${filteredRequest.chargingStationID}' does not exist.`,
      MODULE_NAME, 'setAndSaveChargingProfile', req.user);
    // OCPI Charging Station
    if (!chargingStation.issuer) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Charging Station '${chargingStation.id}' not issued by the organization`,
        module: MODULE_NAME, method: 'setAndSaveChargingProfile',
        user: req.user,
        action
      });
    }
    const chargePoint = Utils.getChargePointFromID(chargingStation, filteredRequest.chargePointID);
    UtilsService.assertObjectExists(action, chargePoint, `Charge Point ID '${filteredRequest.chargePointID}' does not exist.`,
      MODULE_NAME, 'setAndSaveChargingProfile', req.user);
    // Check Mandatory fields
    UtilsService.checkIfChargingProfileIsValid(chargingStation, chargePoint, filteredRequest, req);
    let siteID = null;
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.ORGANIZATION)) {
      // Get the Site Area
      const siteArea = await SiteAreaStorage.getSiteArea(req.tenant, chargingStation.siteAreaID);
      siteID = siteArea ? siteArea.siteID : null;
    }
    // Check Auth
    if (!await Authorizations.canUpdateChargingStation(req.user, siteID)) {
      throw new AppAuthError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.UPDATE, entity: Entity.CHARGING_STATION,
        module: MODULE_NAME, method: 'setAndSaveChargingProfile',
        value: chargingStation.id,
      });
    }
    // Check if Charging Profile is supported
    if (!chargingStation.capabilities?.supportChargingProfiles) {
      throw new AppError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action,
        errorCode: HTTPError.FEATURE_NOT_SUPPORTED_ERROR,
        user: req.user,
        module: MODULE_NAME, method: 'setAndSaveChargingProfile',
        message: `Charging Station '${chargingStation.id}' does not support Charging Profiles`,
      });
    }
    // Apply & Save charging plan
    return OCPPUtils.setAndSaveChargingProfile(req.tenant, filteredRequest);
  }

  private static async executeChargingStationGetCompositeSchedule(action: ServerAction, chargingStation: ChargingStation, command: Command,
      filteredRequest: HttpChargingStationGetCompositeScheduleRequest, req: Request, res: Response, next: NextFunction): Promise<any> {
    // Get the Vendor instance
    const chargingStationVendor = ChargingStationVendorFactory.getChargingStationVendorImpl(chargingStation);
    if (!chargingStationVendor) {
      throw new AppError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action,
        errorCode: HTTPError.FEATURE_NOT_SUPPORTED_ERROR,
        message: `No vendor implementation is available (${chargingStation.chargePointVendor}) for limiting the charge`,
        module: MODULE_NAME, method: 'handleAction',
        user: req.user
      });
    }
    // Get composite schedule
    let result: any;
    if (filteredRequest.args.connectorId === 0) {
      result = [] as OCPPGetCompositeScheduleResponse[];
      for (const connector of chargingStation.connectors) {
        // Connector ID > 0
        const chargePoint = Utils.getChargePointFromID(chargingStation, connector.chargePointID);
        result.push(await chargingStationVendor.getCompositeSchedule(
          req.tenant, chargingStation, chargePoint, connector.connectorId, filteredRequest.args.duration, filteredRequest.args.chargingRateUnit));
      }
    } else {
      // Connector ID > 0
      const connector = Utils.getConnectorFromID(chargingStation, filteredRequest.args.connectorId);
      const chargePoint = Utils.getChargePointFromID(chargingStation, connector?.chargePointID);
      result = await chargingStationVendor.getCompositeSchedule(
        req.tenant, chargingStation, chargePoint, filteredRequest.args.connectorId, filteredRequest.args.duration, filteredRequest.args.chargingRateUnit);
    }
    return result;
  }

  private static async executeChargingStationStartTransaction(action: ServerAction, chargingStation: ChargingStation, command: Command,
      filteredRequest: HttpChargingStationStartTransactionRequest, req: Request, res: Response, next: NextFunction, chargingStationClient: ChargingStationClient): Promise<any> {
    // Check Tag ID
    if (!filteredRequest.args || (!filteredRequest.args.visualTagID && !filteredRequest.args.tagID)) {
      throw new AppError({
        errorCode: HTTPError.USER_NO_BADGE_ERROR,
        message: 'The user does not have any badge',
        module: MODULE_NAME, method: 'handleAction',
        user: req.user, action,
      });
    }
    // Check Departure Time
    if (filteredRequest.departureTime && filteredRequest.departureTime.getTime() < Date.now()) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The departure time must be set in the future',
        module: MODULE_NAME, method: 'handleAction',
        user: req.user, action,
      });
    }
    // Check Car
    if (filteredRequest.carID) {
      await UtilsService.checkAndGetCarAuthorization(
        req.tenant, req.user, filteredRequest.carID, Action.READ, ServerAction.CHARGING_STATION_REMOTE_START_TRANSACTION);
    }
    let tag: Tag;
    if (filteredRequest.args.tagID) {
      tag = await UtilsService.checkAndGetTagAuthorization(
        req.tenant, req.user, filteredRequest.args.tagID, Action.READ, ServerAction.CHARGING_STATION_REMOTE_START_TRANSACTION);
    } else {
      tag = await UtilsService.checkAndGetTagByVisualIDAuthorization(
        req.tenant, req.user, filteredRequest.args.visualTagID, Action.READ, ServerAction.CHARGING_STATION_REMOTE_START_TRANSACTION);
    }
    // Inactive Tag
    if (!tag.active) {
      throw new BackendError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action,
        message: `Tag ID '${tag.id}' is not active`,
        module: MODULE_NAME, method: 'handleAction',
        user: req.user,
        actionOnUser: tag.user,
        detailedMessages: { tag }
      });
    }
    // Set the logged user
    if (!filteredRequest.userID) {
      filteredRequest.userID = req.user.id;
    }
    // Check and Get User
    let user: User;
    if (filteredRequest.userID === req.user.id) {
      user = req.user.user;
    } else {
      user = await UtilsService.checkAndGetUserAuthorization(
        req.tenant, req.user, filteredRequest.userID, Action.READ, action, null, { tagIDs: [tag.id] });
    }
    // Check Tag/User
    if (tag.userID !== user.id) {
      throw new BackendError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action,
        message: `Tag ID '${tag.id}' is not linked to User ID '${user.id}'`,
        module: MODULE_NAME, method: 'handleAction',
        user: req.user,
        actionOnUser: tag.user,
        detailedMessages: { tag }
      });
    }
    // Check Charging Station
    Authorizations.isChargingStationValidInOrganization(action, req.tenant, chargingStation);
    // Save Car selection
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.CAR)) {
      await UserStorage.saveStartTransactionData(req.tenant, user.id, {
        lastChangedOn: new Date(),
        lastSelectedCarID: filteredRequest.carID,
        lastSelectedCar: true,
        lastCarStateOfCharge: filteredRequest.carStateOfCharge,
        lastCarOdometer: filteredRequest.carOdometer,
        lastDepartureTime: filteredRequest.departureTime
      });
    }
    // Execute it
    return chargingStationClient.remoteStartTransaction({
      connectorId: filteredRequest.args.connectorId,
      idTag: tag.id
    });
  }

  private static async executeChargingStationStopTransaction(action: ServerAction, chargingStation: ChargingStation, command: Command,
      filteredRequest: HttpChargingStationStopTransactionRequest, req: Request, res: Response, next: NextFunction, chargingStationClient: ChargingStationClient): Promise<any> {
    // Get Transaction
    const transaction = await TransactionStorage.getTransaction(
      req.tenant, filteredRequest.args.transactionId, { withUser: true });
    UtilsService.assertObjectExists(action, transaction, `Transaction ID '${filteredRequest.args.transactionId}' does not exist`,
      MODULE_NAME, 'handleAction', req.user);
    // Get default Tag
    const tags = await TagStorage.getTags(req.tenant, { userIDs: [req.user.id], active: true }, Constants.DB_PARAMS_SINGLE_RECORD, ['id']);
    if (Utils.isEmptyArray(tags.result)) {
      throw new AppError({
        errorCode: HTTPError.USER_NO_BADGE_ERROR,
        message: 'The user does not have any active badge',
        module: MODULE_NAME,
        method: 'handleAction',
        user: req.user,
        actionOnUser: transaction.userID,
        action,
      });
    }
    const tag = tags.result[0];
    // Check if user is authorized
    await Authorizations.isAuthorizedToStopTransaction(req.tenant, chargingStation, transaction, tag.id,
      ServerAction.OCPP_STOP_TRANSACTION, Action.REMOTE_STOP_TRANSACTION);
    // Set the tag ID to handle the Stop Transaction afterwards
    transaction.remotestop = {
      timestamp: new Date(),
      tagID: tag.id,
      userID: req.user.id
    };
    // Save Transaction
    await TransactionStorage.saveTransaction(req.tenant, transaction);
    // Ok: Execute it
    return chargingStationClient.remoteStopTransaction({
      transactionId: filteredRequest.args.transactionId
    });
  }

  private static async executeChargingStationChangeConfiguration(action: ServerAction, chargingStation: ChargingStation, command: Command,
      filteredRequest: HttpChargingStationChangeConfigurationRequest, req: Request, res: Response, next: NextFunction,
      chargingStationClient: ChargingStationClient): Promise<OCPPChangeConfigurationResponse> {
    // Change the config
    const result = await chargingStationClient.changeConfiguration({
      key: filteredRequest.args.key,
      value: filteredRequest.args.value
    });
    if (result.status === OCPPConfigurationStatus.ACCEPTED ||
        result.status === OCPPConfigurationStatus.REBOOT_REQUIRED) {
      // Reboot?
      if (result.status === OCPPConfigurationStatus.REBOOT_REQUIRED) {
        await Logging.logWarning({
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          tenantID: req.tenant.id,
          user: req.user,
          action,
          module: MODULE_NAME, method: 'handleChargingStationCommand',
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          message: `Reboot is required due to change of OCPP Parameter '${filteredRequest.args.key}' to '${filteredRequest.args.value}'`,
          detailedMessages: { result }
        });
      }
      // Custom param?
      if (filteredRequest.args.custom) {
        // Get OCPP Parameters from DB
        const ocppParametersFromDB = await ChargingStationStorage.getOcppParameters(req.tenant, chargingStation.id);
        // Set new structure
        const chargingStationOcppParameters: ChargingStationOcppParameters = {
          id: chargingStation.id,
          configuration: ocppParametersFromDB.result,
          timestamp: new Date()
        };
        // Search for existing Custom param
        const foundOcppParam = chargingStationOcppParameters.configuration.find((ocppParam) => ocppParam.key === filteredRequest.args.key);
        if (foundOcppParam) {
          // Update param
          foundOcppParam.value = filteredRequest.args.value;
          // Save config
          if (foundOcppParam.custom) {
            // Save
            await ChargingStationStorage.saveOcppParameters(req.tenant, chargingStationOcppParameters);
          } else {
            // Not a custom param: refresh the whole OCPP Parameters
            await OCPPCommon.requestAndSaveChargingStationOcppParameters(req.tenant, chargingStation);
          }
        } else {
          // Add custom param
          chargingStationOcppParameters.configuration.push(filteredRequest.args as OcppParameter);
          // Save
          await ChargingStationStorage.saveOcppParameters(req.tenant, chargingStationOcppParameters);
        }
      } else {
        // Refresh the whole OCPP Parameters
        await OCPPCommon.requestAndSaveChargingStationOcppParameters(req.tenant, chargingStation);
      }
      // Check update with Vendor
      const chargingStationVendor = ChargingStationVendorFactory.getChargingStationVendorImpl(chargingStation);
      if (chargingStationVendor) {
        await chargingStationVendor.checkUpdateOfOCPPParams(req.tenant, chargingStation, filteredRequest.args.key, filteredRequest.args.value);
      }
    }
    return result;
  }

  private static async updateChargingStationRoaming(tenant: Tenant, loggedUser: UserToken,
      chargingStation: ChargingStation, action: ServerAction) {
    // OCPI handling
    if (Utils.isComponentActiveFromToken(loggedUser, TenantComponents.OCPI)) {
      // Remove charging station from ocpi
      try {
        const ocpiClient = await OCPIClientFactory.getAvailableOcpiClient(tenant, OCPIRole.CPO) as CpoOCPIClient;
        let status: OCPIEvseStatus;
        // Force remove
        if (!chargingStation.public) {
          status = OCPIEvseStatus.REMOVED;
        }
        if (ocpiClient) {
          await ocpiClient.updateChargingStationStatus(chargingStation, status);
        }
      } catch (error) {
        await Logging.logError({
          tenantID: tenant.id,
          module: MODULE_NAME, method: 'handleUpdateChargingStationParams',
          action,
          user: loggedUser,
          message: `Unable to remove charging station ${chargingStation.id} from IOP`,
          detailedMessages: { error: error.stack }
        });
      }
    }
    // OICP handling
    if (Utils.isComponentActiveFromToken(loggedUser, TenantComponents.OICP)) {
      let actionType = OICPActionType.INSERT;
      if (!chargingStation.public) {
        actionType = OICPActionType.DELETE;
      }
      try {
        const oicpClient = await OICPClientFactory.getAvailableOicpClient(tenant, OCPIRole.CPO) as CpoOICPClient;
        if (oicpClient) {
          // Define get option
          const options = {
            addChargeBoxID: true,
            countryID: oicpClient.getLocalCountryCode(ServerAction.OICP_PUSH_EVSE_DATA),
            partyID: oicpClient.getLocalPartyID(ServerAction.OICP_PUSH_EVSE_DATA)
          };
          // Get Site
          const site = await SiteStorage.getSite(tenant, chargingStation.siteID);
          // Push EVSE to OICP platform
          await oicpClient.pushEvseData(OICPUtils.convertChargingStation2MultipleEvses(
            site, chargingStation.siteArea, chargingStation, options), actionType);
        }
      } catch (error) {
        await Logging.logError({
          tenantID: tenant.id,
          module: MODULE_NAME, method: 'handleUpdateChargingStationParams',
          action,
          user: loggedUser,
          message: `Unable to insert or remove charging station ${chargingStation.id} from HBS`,
          detailedMessages: { error: error.stack }
        });
      }
    }
  }
}
