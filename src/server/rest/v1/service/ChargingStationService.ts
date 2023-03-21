import { Action, Entity } from '../../../../types/Authorization';
import ChargingStation, { ChargingStationOcppParameters, ChargingStationQRCode, Command, ConnectorType, OCPPParams, OcppParameter, StaticLimitAmps } from '../../../../types/ChargingStation';
import { HTTPAuthError, HTTPError } from '../../../../types/HTTPError';
import { HttpChargingStationCompositeScheduleGetRequest, HttpChargingStationConfigurationChangeRequest, HttpChargingStationLimitPowerRequest, HttpChargingStationParamsUpdateRequest, HttpChargingStationTransactionStartRequest, HttpChargingStationTransactionStopRequest, HttpChargingStationsGetRequest } from '../../../../types/requests/HttpChargingStationRequest';
import { NextFunction, Request, Response } from 'express';
import { OCPICommandResponse, OCPICommandResponseType } from '../../../../types/ocpi/OCPICommandResponse';
import { OCPPChangeConfigurationResponse, OCPPConfigurationStatus, OCPPGetCompositeScheduleResponse, OCPPStatus, OCPPUnlockStatus } from '../../../../types/ocpp/OCPPClient';
import Tenant, { TenantComponents } from '../../../../types/Tenant';

import AppAuthError from '../../../../exception/AppAuthError';
import AppError from '../../../../exception/AppError';
import AuthorizationService from './AuthorizationService';
import Authorizations from '../../../../authorization/Authorizations';
import BackendError from '../../../../exception/BackendError';
import { ChargePointStatus } from '../../../../types/ocpp/OCPPServer';
import { ChargingProfile } from '../../../../types/ChargingProfile';
import ChargingStationClient from '../../../../client/ocpp/ChargingStationClient';
import ChargingStationClientFactory from '../../../../client/ocpp/ChargingStationClientFactory';
import { ChargingStationInErrorType } from '../../../../types/InError';
import ChargingStationStorage from '../../../../storage/mongodb/ChargingStationStorage';
import ChargingStationValidatorRest from '../validator/ChargingStationValidatorRest';
import ChargingStationVendorFactory from '../../../../integration/charging-station-vendor/ChargingStationVendorFactory';
import { CommonUtilsService } from '../../../CommonUtilsService';
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
import SiteStorage from '../../../../storage/mongodb/SiteStorage';
import SmartChargingFactory from '../../../../integration/smart-charging/SmartChargingFactory';
import { StatusCodes } from 'http-status-codes';
import Tag from '../../../../types/Tag';
import TagStorage from '../../../../storage/mongodb/TagStorage';
import { TransactionStatus } from '../../../../types/Transaction';
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
    const filteredRequest = ChargingStationValidatorRest.getInstance().validateChargingStationParametersUpdateReq({ ...req.params, ...req.body });
    // Check the Charging Station
    const chargingStation = await UtilsService.checkAndGetChargingStationAuthorization(
      req.tenant, req.user, filteredRequest.id, Action.UPDATE, action, null, { withSiteArea: true });
    // Check and get site area authorizations
    let siteArea: SiteArea = null;
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.ORGANIZATION) && filteredRequest.siteAreaID) {
      siteArea = await UtilsService.checkAndGetSiteAreaAuthorization(
        req.tenant, req.user, filteredRequest.siteAreaID, Action.READ, action, null, { withSite: true });
    }
    // Update props
    ChargingStationService.updateChargingStationCommonProperties(action, req.tenant, chargingStation, siteArea, req.user, filteredRequest);
    // Handle Manual Configuration
    const resetAndApplyTemplate = await ChargingStationService.updateChargingStationManualConfiguration(
      action, chargingStation, req.user, filteredRequest);
    // Existing Connectors
    ChargingStationService.updateChargingStationConnectors(chargingStation, req.user, filteredRequest);
    // Handle Manual Config
    ChargingStationService.updateChargingStationManualAutoConfig(chargingStation, req.user, filteredRequest);
    // Update Site Area
    ChargingStationService.updateChargingStationSiteArea(action, chargingStation, req.user, siteArea);
    // Update
    await ChargingStationStorage.saveChargingStation(req.tenant, chargingStation);
    // Check and Apply Charging Station templates
    await ChargingStationService.checkAndApplyChargingStationTemplate(
      action, req.tenant, chargingStation, req.user, resetAndApplyTemplate);
    await Logging.logInfo({
      tenantID: req.tenant.id,
      action, user: req.user,
      module: MODULE_NAME, method: 'handleUpdateChargingStationParams',
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
    const filteredRequest = ChargingStationValidatorRest.getInstance().validateChargingStationLimitPowerReq(req.body);
    // Check dynamic auth
    const chargingStation = await UtilsService.checkAndGetChargingStationAuthorization(
      req.tenant, req.user, filteredRequest.chargingStationID, Action.LIMIT_POWER, action, null, { withSiteArea: true });
    // Charge Point
    const chargePoint = Utils.getChargePointFromID(chargingStation, filteredRequest.chargePointID);
    UtilsService.assertObjectExists(action, chargePoint, `Charge Point ID '${filteredRequest.chargePointID}' does not exist.`,
      MODULE_NAME, 'handleChargingStationLimitPower', req.user);
    // Min Current
    const numberOfPhases = Utils.getNumberOfConnectedPhases(chargingStation, chargePoint, 0);
    if (filteredRequest.ampLimitValue < (StaticLimitAmps.MIN_LIMIT_PER_PHASE * numberOfPhases * chargePoint.connectorIDs.length)) {
      throw new AppError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action, user: req.user,
        errorCode: HTTPError.GENERAL_ERROR,
        module: MODULE_NAME, method: 'handleChargingStationLimitPower',
        message: `Limitation to ${filteredRequest.ampLimitValue}A is too low, min required is ${StaticLimitAmps.MIN_LIMIT_PER_PHASE * numberOfPhases * chargePoint.connectorIDs.length}A`,
      });
    }
    // Get the Vendor instance
    const chargingStationVendor = ChargingStationVendorFactory.getChargingStationVendorImpl(chargingStation);
    if (!chargingStationVendor) {
      throw new AppError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action, user: req.user,
        errorCode: HTTPError.FEATURE_NOT_SUPPORTED_ERROR,
        module: MODULE_NAME, method: 'handleChargingStationLimitPower',
        message: `No vendor implementation is available (${chargingStation.chargePointVendor}) for limiting the charge`,
      });
    }
    // Check if static limitation is supported
    if (!chargingStationVendor.hasStaticLimitationSupport(chargingStation)) {
      throw new AppError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action, user: req.user,
        errorCode: HTTPError.FEATURE_NOT_SUPPORTED_ERROR,
        module: MODULE_NAME, method: 'handleChargingStationLimitPower',
        message: 'Charging Station does not support power limitation',
      });
    }
    // Check Charging Profile
    const chargingProfiles = await ChargingStationStorage.getChargingProfiles(req.tenant,
      { chargingStationIDs: [chargingStation.id], connectorID: 0 },
      Constants.DB_PARAMS_MAX_LIMIT);
    const updatedChargingProfiles: ChargingProfile[] = Utils.cloneObject(chargingProfiles.result);
    // Update the Charging Profiles
    await ChargingStationService.updateChargingStationProfiles(action, req.tenant, chargingStation,
      req.user, chargingProfiles.result, updatedChargingProfiles, filteredRequest);
    // Call the limitation
    const result = await chargingStationVendor.setStaticPowerLimitation(req.tenant, chargingStation,
      chargePoint, filteredRequest.ampLimitValue);
    if (result.status !== OCPPConfigurationStatus.ACCEPTED &&
        result.status !== OCPPConfigurationStatus.REBOOT_REQUIRED) {
      throw new AppError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action, user: req.user,
        errorCode: HTTPError.LIMIT_POWER_ERROR,
        module: MODULE_NAME, method: 'handleChargingStationLimitPower',
        message: `Cannot limit the charger's power to ${filteredRequest.ampLimitValue}A: '${result.status}'`,
        detailedMessages: { result },
      });
    }
    await Logging.logInfo({
      ...LoggingHelper.getChargingStationProperties(chargingStation),
      tenantID: req.tenant.id,
      action, user: req.user,
      module: MODULE_NAME, method: 'handleChargingStationLimitPower',
      message: `The charger's power limit has been successfully set to ${filteredRequest.ampLimitValue}A`,
      detailedMessages: { result }
    });
    res.json({ status: result.status });
    next();
  }

  public static async handleGetChargingProfiles(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationValidatorRest.getInstance().validateChargingProfilesGetReq(req.query);
    // Check dynamic auth
    const authorizations = await AuthorizationService.checkAndGetChargingProfilesAuthorizations(
      req.tenant, req.user, Action.LIST, filteredRequest, false);
    if (!authorizations.authorized) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
    }
    // Get the profiles
    const chargingProfiles = await ChargingStationStorage.getChargingProfiles(req.tenant,
      {
        search: filteredRequest.Search,
        chargingStationIDs: filteredRequest.ChargingStationID ? filteredRequest.ChargingStationID.split('|') : null,
        connectorID: filteredRequest.ConnectorID,
        withSiteArea: filteredRequest.WithSiteArea,
        siteIDs: filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : null,
        ...authorizations.filters
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields),
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      authorizations.projectFields
    );
    // Assign projected fields
    if (authorizations.projectFields) {
      chargingProfiles.projectFields = authorizations.projectFields;
    }
    // Add Auth flags
    if (filteredRequest.WithAuth) {
      await AuthorizationService.addChargingProfilesAuthorizations(req.tenant, req.user, chargingProfiles, authorizations);
    }
    // Build the result
    res.json(chargingProfiles);
    next();
  }

  public static async handleTriggerSmartCharging(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if Component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.SMART_CHARGING,
      Action.UPDATE, Entity.SITE_AREA, MODULE_NAME, 'handleTriggerSmartCharging');
    // Filter
    const filteredRequest = ChargingStationValidatorRest.getInstance().validateSmartChargingTriggerReq(req.query);
    // Get Site Area
    const siteArea = await UtilsService.checkAndGetSiteAreaAuthorization(
      req.tenant, req.user, filteredRequest.SiteAreaID, Action.UPDATE, action);
    // Call Smart Charging
    const smartCharging = await SmartChargingFactory.getSmartChargingImpl(req.tenant);
    if (!smartCharging) {
      throw new AppError({
        action, user: req.user,
        errorCode: HTTPError.GENERAL_ERROR,
        module: MODULE_NAME, method: 'handleTriggerSmartCharging',
        message: 'Smart Charging service is not configured',
      });
    }
    const siteAreaLock = await LockingHelper.acquireSiteAreaSmartChargingLock(req.tenant.id, siteArea);
    if (siteAreaLock) {
      try {
        // Call
        const actionsResponse = await smartCharging.computeAndApplyChargingProfiles(siteArea);
        if (actionsResponse && actionsResponse.inError > 0) {
          throw new AppError({
            action, user: req.user,
            errorCode: HTTPError.GENERAL_ERROR,
            module: MODULE_NAME, method: 'handleTriggerSmartCharging',
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
    const filteredRequest = ChargingStationValidatorRest.getInstance().validateChargingStationQRCodeGenerateReq(req.query);
    // Check dynamic auth
    const chargingStation = await UtilsService.checkAndGetChargingStationAuthorization(req.tenant, req.user,
      filteredRequest.ChargingStationID, Action.GET_CONNECTOR_QR_CODE, action);
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
    const generatedQR = await Utils.generateQrCode(
      Buffer.from(JSON.stringify(chargingStationQRCode)).toString('base64'));
    res.json({ image: generatedQR });
    next();
  }

  public static async handleCreateChargingProfile(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationValidatorRest.getInstance().validateChargingProfileCreateReq(req.body);
    // Check dynamic auth
    await AuthorizationService.checkAndGetChargingProfileAuthorizations(req.tenant, req.user, {}, Action.CREATE);
    // Create
    const chargingProfileID = await ChargingStationService.setAndSaveChargingProfile(filteredRequest, action, req);
    res.status(StatusCodes.CREATED).send(Object.assign({ id: chargingProfileID }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleUpdateChargingProfile(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationValidatorRest.getInstance().validateChargingProfileUpdateReq({ ...req.params, ...req.body });
    // Check dynamic auth
    await UtilsService.checkAndGetChargingProfileAuthorization(req.tenant, req.user, filteredRequest.id, Action.UPDATE, action, filteredRequest);
    // Update
    const chargingProfileID = await ChargingStationService.setAndSaveChargingProfile(filteredRequest, action, req);
    res.send(Object.assign({ id: chargingProfileID }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleDeleteChargingProfile(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check existence
    const chargingProfileID = ChargingStationValidatorRest.getInstance().validateChargingProfileDeleteReq(req.query).ID;
    // Check dynamic auth
    const chargingProfile = await UtilsService.checkAndGetChargingProfileAuthorization(req.tenant, req.user,
      chargingProfileID, Action.DELETE, action);
    // Get charging station dynmic auth
    await UtilsService.checkAndGetChargingStationAuthorization(
      req.tenant, req.user, chargingProfile.chargingStationID, Action.DELETE_CHARGING_PROFILE, action, null, { withSiteArea: true });
    try {
      // Delete
      await OCPPUtils.clearAndDeleteChargingProfile(req.tenant, chargingProfile);
    } catch (error) {
      throw new AppError({
        action, user: req.user, actionOnUser: req.user,
        errorCode: HTTPError.CLEAR_CHARGING_PROFILE_NOT_SUCCESSFUL,
        module: MODULE_NAME, method: 'handleDeleteChargingProfile',
        message: 'Error occurred while clearing Charging Profile',
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
    const filteredRequest = ChargingStationValidatorRest.getInstance().validateChargingStationOcppParametersGetReq(req.query);
    // Check dynamic auth
    const chargingStation = await UtilsService.checkAndGetChargingStationAuthorization(
      req.tenant, req.user, filteredRequest.ChargingStationID, Action.GET_OCPP_PARAMS, action, null, { withSiteArea: true });
    // Get the Parameters
    const parameters = await ChargingStationStorage.getOcppParameters(req.tenant, chargingStation.id);
    // Return the result
    res.json(parameters);
    next();
  }

  public static async handleRequestChargingStationOcppParameters(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationValidatorRest.getInstance().validateChargingStationOcppParametersRequestReq(req.body);
    // Check dynamic auth
    const chargingStation = await UtilsService.checkAndGetChargingStationAuthorization(
      req.tenant, req.user, filteredRequest.chargingStationID, Action.UPDATE_OCPP_PARAMS, action, null, { withSiteArea: true });
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
    const chargingStationID = ChargingStationValidatorRest.getInstance().validateChargingStationDeleteReq(req.query).ID;
    // Check dynamic auth
    const chargingStation = await UtilsService.checkAndGetChargingStationAuthorization(
      req.tenant, req.user, chargingStationID, Action.DELETE, action, null, { withSiteArea: true });
    // Check ongoing Transactions
    const ongoingTransactions = await TransactionStorage.getTransactions(req.tenant,
      { chargingStationIDs: [chargingStationID], status: TransactionStatus.ACTIVE }, Constants.DB_PARAMS_SINGLE_RECORD, ['id']);
    if (ongoingTransactions.count > 0) {
      throw new AppError({
        action, user: req.user,
        errorCode: HTTPError.EXISTING_TRANSACTION_ERROR,
        module: MODULE_NAME, method: 'handleDeleteChargingStation',
        message: `Charging Station '${chargingStation.id}' can't be deleted due to existing active transactions`,
      });
    }
    // Handle Roaming
    await ChargingStationService.deactivateChargingStationRoaming(
      action, req.tenant, req.user, chargingStation, chargingStation.siteArea);
    // Remove Org
    chargingStation.companyID = null;
    chargingStation.siteID = null;
    chargingStation.siteAreaID = null;
    // Set as deleted
    chargingStation.deleted = true;
    // Check if charging station has had transactions
    const transactions = await TransactionStorage.getTransactions(req.tenant,
      { chargingStationIDs: [chargingStation.id] }, Constants.DB_PARAMS_SINGLE_RECORD, ['id']);
    if (transactions.count > 0) {
      // Delete logically
      await ChargingStationStorage.saveChargingStation(req.tenant, chargingStation);
      // Delete Tx Charging Profiles
      await ChargingStationStorage.deleteChargingProfiles(req.tenant, chargingStation.id);
    } else {
      // Delete physically
      await ChargingStationStorage.deleteChargingStation(req.tenant, chargingStation.id);
    }
    await Logging.logInfo({
      tenantID: req.tenant.id,
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
    const filteredRequest = ChargingStationValidatorRest.getInstance().validateChargingStationGetReq({ ...req.params, ...req.query });
    // Check dynamic auth
    let chargingStation = await UtilsService.checkAndGetChargingStationAuthorization(
      req.tenant, req.user, filteredRequest.ID, Action.READ, action, null, {
        // TODO: Put back the filters below when the Mobile App would have migrated to new Authorization checks
        // withSite: filteredRequest.WithSite,
        // withSiteArea: filteredRequest.WithSiteArea
        withSite: true,
        withSiteArea: true,
      }, true);
    // Return additional fields if user can update charging station
    if (chargingStation.canUpdate) {
      chargingStation = await UtilsService.checkAndGetChargingStationAuthorization(
        req.tenant, req.user, filteredRequest.ID, Action.UPDATE, action, null, {
          // TODO: Put back the filters below when the Mobile App would have migrated to new Authorization checks
          // withSite: filteredRequest.WithSite,
          // withSiteArea: filteredRequest.WithSiteArea
          withSite: true,
          withSiteArea: true,
        }, true);
    } else if (chargingStation.canUpdateChargingProfile) {
      chargingStation = await UtilsService.checkAndGetChargingStationAuthorization(
        req.tenant, req.user, filteredRequest.ID, Action.UPDATE_CHARGING_PROFILE, action, null, {
          // TODO: Put back the filters below when the Mobile App would have migrated to new Authorization checks
          // withSite: filteredRequest.WithSite,
          // withSiteArea: filteredRequest.WithSiteArea
          withSite: true,
          withSiteArea: true,
        }, true);
    }
    res.json(chargingStation);
    next();
  }

  public static async handleGetChargingStations(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationValidatorRest.getInstance().validateChargingStationsGetReq(req.query);
    // Get Charging Stations
    res.json(await ChargingStationService.getChargingStations(req, filteredRequest));
    next();
  }

  public static async handleExportChargingStationsOCPPParams(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationValidatorRest.getInstance().validateChargingStationsGetReq(req.query);
    // Check and get charging stations: site and siteArea are mandatory
    const chargingStations = await ChargingStationService.getChargingStations(req, filteredRequest, Action.EXPORT,
      { withSite: true, withSiteArea: true });
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
    const filteredRequest = ChargingStationValidatorRest.getInstance().validateChargingStationsGetReq(req.query);
    // Export
    await UtilsService.exportToCSV(req, res, 'exported-charging-stations.csv', filteredRequest,
      ChargingStationService.getChargingStations.bind(this, req, filteredRequest, Action.EXPORT),
      ChargingStationService.convertToCSV.bind(this));
  }

  public static async handleDownloadQrCodesPdf(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationValidatorRest.getInstance().validateChargingStationQRCodeDownloadReq(req.query);
    // Export
    await UtilsService.exportToPDF(req, res, 'exported-charging-stations-qr-code.pdf',
      ChargingStationService.getChargingStations.bind(this, req, filteredRequest, Action.GENERATE_QR),
      ChargingStationService.convertQrCodeToPDF.bind(this));
  }

  public static async handleGetChargingStationsInError(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationValidatorRest.getInstance().validateChargingStationInErrorReq(req.query);
    // Check dynamic auth
    const authorizations = await AuthorizationService.checkAndGetChargingStationsAuthorizations(
      req.tenant, req.user, Action.IN_ERROR, filteredRequest, false);
    if (!authorizations.authorized) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
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
    const chargingStations = await ChargingStationStorage.getChargingStationsInError(req.tenant,
      {
        search: filteredRequest.Search,
        siteIDs: (filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : null),
        siteAreaIDs: (filteredRequest.SiteAreaID ? filteredRequest.SiteAreaID.split('|') : null),
        errorType,
        ...authorizations.filters
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields),
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      authorizations.projectFields
    );
    // Assign projected fields
    if (authorizations.projectFields) {
      chargingStations.projectFields = authorizations.projectFields;
    }
    // Add Auth flags
    if (filteredRequest.WithAuth) {
      await AuthorizationService.addChargingStationsAuthorizations(req.tenant, req.user, chargingStations, authorizations);
    }
    res.json(chargingStations);
  }

  public static async handleGetStatusNotifications(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationValidatorRest.getInstance().validateChargingStationNotificationsGetReq(req.query);
    // Check dynamic auth
    const authorizations = await AuthorizationService.checkAndGetChargingStationsAuthorizations(
      req.tenant, req.user, Action.GET_BOOT_NOTIFICATION, filteredRequest, false);
    if (!authorizations.authorized) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
    }
    // Get all Status Notifications
    const statusNotifications = await OCPPStorage.getStatusNotifications(req.tenant,
      authorizations.filters,
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields)
      },
      authorizations.projectFields
    );
    res.json(statusNotifications);
    next();
  }

  public static async handleReserveNow(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Request assembly
    req.body.chargingStationID = req.params.id;
    // Filter
    const filteredRequest = ChargingStationValidatorRest.getInstance().validateChargingStationActionReserveNowReq(req.body);
    // Check and get dynamic auth
    const chargingStation = await UtilsService.checkAndGetChargingStationAuthorization(
      req.tenant, req.user, filteredRequest.chargingStationID, Action.RESERVE_NOW, action, null, { withSiteArea: true });
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
    const filteredRequest = ChargingStationValidatorRest.getInstance().validateChargingStationActionReservationCancelReq(req.body);
    // Check and get dynamic auth
    const chargingStation = await UtilsService.checkAndGetChargingStationAuthorization(
      req.tenant, req.user, filteredRequest.chargingStationID, Action.RESERVE_NOW, action, null, { withSiteArea: true });
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
    // Filter
    const filteredRequest = ChargingStationValidatorRest.getInstance().validateChargingStationNotificationsGetReq(req.query);
    // Check dynamic auth
    const authorizations = await AuthorizationService.checkAndGetChargingStationsAuthorizations(
      req.tenant, req.user, Action.GET_BOOT_NOTIFICATION, filteredRequest, false);
    if (!authorizations.authorized) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
    }
    // Get all Status Notifications
    const bootNotifications = await OCPPStorage.getBootNotifications(req.tenant,
      authorizations.filters,
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields)
      },
      authorizations.projectFields
    );
    res.json(bootNotifications);
    next();
  }

  // This endpoint is not subject to auth check
  public static async handleGetFirmware(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationValidatorRest.getInstance().validateChargingStationFirmwareDownloadReq(req.query);
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
        tenantID: Constants.DEFAULT_TENANT_ID,
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
          tenantID: Constants.DEFAULT_TENANT_ID,
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
      Action.READ, Entity.CHARGING_STATION, MODULE_NAME, 'handleOcpiAction');
    // Check and get dynamic auth
    const chargingStation = await UtilsService.checkAndGetChargingStationAuthorization(
      req.tenant, req.user, req.body.chargingStationID, Action.READ, action, null, { withSiteArea: true });
    try {
      let actionFound = false;
      let result: OCPICommandResponse;
      // Start Transaction
      if (action === ServerAction.OCPI_EMSP_START_SESSION) {
        // Filter
        const remoteStartRequest = ChargingStationValidatorRest.getInstance().validateChargingStationActionTransactionStartReq(req.body);
        actionFound = true;
        // Start Transaction
        result = await ChargingStationService.handleOcpiStartTransaction(
          action, req.tenant, chargingStation, req.user, remoteStartRequest);
      }
      // Stop Transaction
      if (action === ServerAction.OCPI_EMSP_STOP_SESSION) {
        // Filter
        const remoteStopRequest = ChargingStationValidatorRest.getInstance().validateChargingStationActionTransactionStopReq(req.body);
        actionFound = true;
        // Stop Transaction
        result = await ChargingStationService.handleOcpiStopTransaction(
          action, req.tenant, chargingStation, req.user, remoteStopRequest);
      }
      // Action not found
      if (!actionFound) {
        throw new AppError({
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          action, user: req.user,
          errorCode: HTTPError.GENERAL_ERROR,
          module: MODULE_NAME, method: 'handleOcpiAction',
          message: `Unknown OCPI Action '${action}'`,
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
        action, user: req.user,
        errorCode: error instanceof AppError ? error.params.errorCode : HTTPError.GENERAL_ERROR,
        module: MODULE_NAME, method: 'handleOcppAction',
        message: `OCPI Action '${action}' has failed: ${error.message as string}`,
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
    // Convert command to authorization action
    const authAction = UtilsService.getAuthActionFromOCPPCommand(action, command);
    // Get the Charging station
    const chargingStation = await UtilsService.checkAndGetChargingStationAuthorization(
      req.tenant, req.user, req.body.chargingStationID, authAction, action, null, { withSite: true, withSiteArea: true });
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
      let commandFound = false;
      let result: any;
      // Clear Cache
      if (command === Command.CLEAR_CACHE) {
        ChargingStationValidatorRest.getInstance().validateChargingStationActionCacheClearReq(req.body);
        commandFound = true;
        result = await chargingStationClient.clearCache();
      }
      // Change Availability
      if (command === Command.CHANGE_AVAILABILITY) {
        const changeAvailabilityRequest = ChargingStationValidatorRest.getInstance().validateChargingStationActionAvailabilityChangeReq(req.body);
        commandFound = true;
        result = await chargingStationClient.changeAvailability({
          connectorId: changeAvailabilityRequest.args.connectorId,
          type: changeAvailabilityRequest.args.type
        });
      }
      // Get Configuration
      if (command === Command.GET_CONFIGURATION) {
        const getConfigurationRequest = ChargingStationValidatorRest.getInstance().validateChargingStationActionConfigurationGetReq(req.body);
        commandFound = true;
        result = await chargingStationClient.getConfiguration({ key: getConfigurationRequest.args.key });
      }
      // Change Configuration
      if (command === Command.CHANGE_CONFIGURATION) {
        const changeConfigurationRequest = ChargingStationValidatorRest.getInstance().validateChargingStationActionConfigurationChangeReq(req.body);
        commandFound = true;
        result = await ChargingStationService.executeChargingStationChangeConfiguration(
          action, chargingStation, command, changeConfigurationRequest, req, res, next, chargingStationClient);
      }
      // Data Transfer
      if (command === Command.DATA_TRANSFER) {
        const dataTransferRequest = ChargingStationValidatorRest.getInstance().validateChargingStationActionDataTransferReq(req.body);
        commandFound = true;
        result = await chargingStationClient.dataTransfer(dataTransferRequest.args);
      }
      // Remote Stop Transaction
      if (command === Command.REMOTE_STOP_TRANSACTION) {
        const remoteStopRequest = ChargingStationValidatorRest.getInstance().validateChargingStationActionTransactionStopReq(req.body);
        commandFound = true;
        result = await ChargingStationService.executeChargingStationStopTransaction(
          action, chargingStation, command, remoteStopRequest, req, res, next, chargingStationClient);
      }
      // Remote Start Transaction
      if (command === Command.REMOTE_START_TRANSACTION) {
        const remoteStartRequest = ChargingStationValidatorRest.getInstance().validateChargingStationActionTransactionStartReq(req.body);
        commandFound = true;
        result = await ChargingStationService.executeChargingStationStartTransaction(
          action, chargingStation, command, remoteStartRequest, req, res, next, chargingStationClient);
      }
      // Get the Charging Plans
      if (command === Command.GET_COMPOSITE_SCHEDULE) {
        const compositeScheduleRequest = ChargingStationValidatorRest.getInstance().validateChargingStationActionCompositeScheduleGetReq(req.body);
        commandFound = true;
        result = await ChargingStationService.executeChargingStationGetCompositeSchedule(
          action, chargingStation, command, compositeScheduleRequest, req, res, next);
      }
      // Get Diagnostic
      if (command === Command.GET_DIAGNOSTICS) {
        const diagnosticsRequest = ChargingStationValidatorRest.getInstance().validateChargingStationDiagnosticsGetReq(req.body);
        commandFound = true;
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
        const unlockConnectorRequest = ChargingStationValidatorRest.getInstance().validateChargingStationActionConnectorUnlockReq(req.body);
        commandFound = true;
        result = await chargingStationClient.unlockConnector({ connectorId: unlockConnectorRequest.args.connectorId });
      }
      // Update Firmware
      if (command === Command.UPDATE_FIRMWARE) {
        const updateFirmwareRequest = ChargingStationValidatorRest.getInstance().validateChargingStationActionFirmwareUpdateReq(req.body);
        commandFound = true;
        result = await chargingStationClient.updateFirmware({
          location: updateFirmwareRequest.args.location,
          retries: updateFirmwareRequest.args.retries,
          retrieveDate: updateFirmwareRequest.args.retrieveDate,
          retryInterval: updateFirmwareRequest.args.retryInterval
        });
      }
      // Reset
      if (command === Command.RESET) {
        const resetRequest = ChargingStationValidatorRest.getInstance().validateChargingStationActionResetReq(req.body);
        commandFound = true;
        result = await chargingStationClient.reset({ type: resetRequest.args.type });
      }
      // Command not found
      if (!commandFound) {
        throw new AppError({
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          action, user: req.user,
          errorCode: HTTPError.GENERAL_ERROR,
          module: MODULE_NAME, method: 'handleOcppAction',
          message: `Unknown OCPP command '${command}'`,
        });
      }
      // Expect result
      if (!result) {
        throw new AppError({
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          action, user: req.user,
          errorCode: HTTPError.GENERAL_ERROR,
          module: MODULE_NAME, method: 'handleOcppAction',
          message: `Received an empty response from OCPP command '${command}'`,
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
          detailedMessages: { filteredRequest: commandFound, result }
        });
      } else {
        // OCPP Command with no status
        await Logging.logInfo({
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          tenantID: req.tenant.id,
          user: req.user,
          module: MODULE_NAME, method: 'handleOcppAction', action,
          message: `OCPP Command '${command}' has been executed successfully`,
          detailedMessages: { filteredRequest: commandFound, result }
        });
      }
      res.json(result);
      next();
    } catch (error) {
      throw new AppError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action, user: req.user,
        errorCode: error instanceof AppError ? error.params.errorCode : HTTPError.GENERAL_ERROR,
        module: MODULE_NAME, method: 'handleOcppAction',
        message: `OCPP Command '${command}' has failed: ${error.message as string}`,
        detailedMessages: { error: error.stack }
      });
    }
  }

  public static async handleCheckSmartChargingConnection(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if Component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.SMART_CHARGING,
      Action.CHECK_CONNECTION, Entity.CHARGING_STATION, MODULE_NAME, 'handleCheckSmartChargingConnection');
    // Check auth
    await AuthorizationService.checkAndGetSmartChargingAuthorizations(req.tenant, req.user, Action.CHECK_CONNECTION);
    // Get implementation
    const smartCharging = await SmartChargingFactory.getSmartChargingImpl(req.tenant);
    if (!smartCharging) {
      throw new AppError({
        action, user: req.user,
        errorCode: HTTPError.GENERAL_ERROR,
        module: MODULE_NAME, method: 'handleCheckSmartChargingConnection',
        message: 'Smart Charging service is not configured',
      });
    }
    await smartCharging.checkConnection();
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  private static async getChargingStations(req: Request, filteredRequest: HttpChargingStationsGetRequest,
      authAction: Action = Action.LIST, additionalFilters: Record<string, any> = {}): Promise<DataResult<ChargingStation>> {
    // Get authorization filters
    const authorizations = await AuthorizationService.checkAndGetChargingStationsAuthorizations(
      req.tenant, req.user, authAction, filteredRequest, false);
    if (!authorizations.authorized) {
      return Constants.DB_EMPTY_DATA_RESULT;
    }
    // Create GPS Coordinates
    if (filteredRequest.LocLongitude && filteredRequest.LocLatitude) {
      filteredRequest.LocCoordinates = [
        Utils.convertToFloat(filteredRequest.LocLongitude),
        Utils.convertToFloat(filteredRequest.LocLatitude)
      ];
    }
    // Get Charging Stations
    const chargingStations = await ChargingStationStorage.getChargingStations(req.tenant,
      {
        search: filteredRequest.Search,
        withNoSiteArea: filteredRequest.WithNoSiteArea,
        withSite: filteredRequest.WithSite,
        withSiteArea: filteredRequest.WithSiteArea,
        withUser: filteredRequest.WithUser,
        chargingStationIDs: filteredRequest.ChargingStationID ? filteredRequest.ChargingStationID.split('|') : null,
        connectorStatuses: (filteredRequest.ConnectorStatus ? filteredRequest.ConnectorStatus.split('|') : null) as ChargePointStatus[],
        connectorTypes: (filteredRequest.ConnectorType ? filteredRequest.ConnectorType.split('|') : null) as ConnectorType[],
        issuer: filteredRequest.Issuer,
        siteIDs: (filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : null),
        siteAreaIDs: filteredRequest.SiteAreaID ? filteredRequest.SiteAreaID.split('|') : null,
        companyIDs: filteredRequest.CompanyID ? filteredRequest.CompanyID.split('|') : null,
        includeDeleted: filteredRequest.IncludeDeleted,
        locCoordinates: filteredRequest.LocCoordinates,
        locMaxDistanceMeters: filteredRequest.LocMaxDistanceMeters,
        public: filteredRequest.Public,
        ...additionalFilters,
        ...authorizations.filters
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields),
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      authorizations.projectFields
    );
    // Assign projected fields
    if (authorizations.projectFields) {
      chargingStations.projectFields = authorizations.projectFields;
    }
    // Add Auth flags
    if (filteredRequest.WithAuth) {
      await AuthorizationService.addChargingStationsAuthorizations(req.tenant, req.user, chargingStations, authorizations);
    }
    return chargingStations;
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
    // Check dynamic auth
    const chargingStation = await UtilsService.checkAndGetChargingStationAuthorization(
      req.tenant, req.user, filteredRequest.chargingStationID, Action.UPDATE_CHARGING_PROFILE, action, null, { withSiteArea: true });
    const chargePoint = Utils.getChargePointFromID(chargingStation, filteredRequest.chargePointID);
    UtilsService.assertObjectExists(action, chargePoint, `Charge Point ID '${filteredRequest.chargePointID}' does not exist.`,
      MODULE_NAME, 'setAndSaveChargingProfile', req.user);
    // Check Mandatory fields
    UtilsService.checkIfChargingProfileIsValid(chargingStation, chargePoint, filteredRequest, req);
    // Check if Charging Profile is supported
    if (!chargingStation.capabilities?.supportChargingProfiles) {
      throw new AppError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action, user: req.user,
        errorCode: HTTPError.FEATURE_NOT_SUPPORTED_ERROR,
        module: MODULE_NAME, method: 'setAndSaveChargingProfile',
        message: `Charging Station '${chargingStation.id}' does not support Charging Profiles`,
      });
    }
    // Apply & Save charging plan
    return OCPPUtils.setAndSaveChargingProfile(req.tenant, filteredRequest);
  }

  private static async executeChargingStationGetCompositeSchedule(action: ServerAction, chargingStation: ChargingStation, command: Command,
      filteredRequest: HttpChargingStationCompositeScheduleGetRequest, req: Request, res: Response, next: NextFunction): Promise<any> {
    // Get the Vendor instance
    const chargingStationVendor = ChargingStationVendorFactory.getChargingStationVendorImpl(chargingStation);
    if (!chargingStationVendor) {
      throw new AppError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action, user: req.user,
        errorCode: HTTPError.FEATURE_NOT_SUPPORTED_ERROR,
        module: MODULE_NAME, method: 'executeChargingStationGetCompositeSchedule',
        message: `No vendor implementation is available (${chargingStation.chargePointVendor}) for limiting the charge`,
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
      filteredRequest: HttpChargingStationTransactionStartRequest, req: Request, res: Response, next: NextFunction, chargingStationClient: ChargingStationClient): Promise<any> {
    // Check Tag ID
    if (!filteredRequest.args || (!filteredRequest.args.visualTagID && !filteredRequest.args.tagID)) {
      throw new AppError({
        action, user: req.user,
        errorCode: HTTPError.USER_NO_BADGE_ERROR,
        module: MODULE_NAME, method: 'executeChargingStationStartTransaction',
        message: 'The user does not have any badge',
      });
    }
    // Check Departure Time
    if (filteredRequest.departureTime && filteredRequest.departureTime.getTime() < Date.now()) {
      throw new AppError({
        action, user: req.user,
        errorCode: HTTPError.GENERAL_ERROR,
        module: MODULE_NAME, method: 'executeChargingStationStartTransaction',
        message: 'The departure time must be set in the future',
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
        module: MODULE_NAME, method: 'executeChargingStationStartTransaction',
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
        module: MODULE_NAME, method: 'executeChargingStationStartTransaction',
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
        lastDepartureTime: filteredRequest.departureTime,
        lastTargetStateOfCharge: filteredRequest.targetStateOfCharge,
      });
    }
    // Execute it
    return chargingStationClient.remoteStartTransaction({
      connectorId: filteredRequest.args.connectorId,
      idTag: tag.id
    });
  }

  private static async executeChargingStationStopTransaction(action: ServerAction, chargingStation: ChargingStation, command: Command,
      filteredRequest: HttpChargingStationTransactionStopRequest, req: Request, res: Response, next: NextFunction, chargingStationClient: ChargingStationClient): Promise<any> {
    // Get Transaction
    const transaction = await TransactionStorage.getTransaction(
      req.tenant, filteredRequest.args.transactionId, { withUser: true });
    UtilsService.assertObjectExists(action, transaction, `Transaction ID '${filteredRequest.args.transactionId}' does not exist`,
      MODULE_NAME, 'handleAction', req.user);
    // Get default Tag
    const tags = await TagStorage.getTags(req.tenant, { userIDs: [req.user.id], active: true }, Constants.DB_PARAMS_SINGLE_RECORD, ['id']);
    if (Utils.isEmptyArray(tags.result)) {
      throw new AppError({
        action, user: req.user, actionOnUser: transaction.userID,
        errorCode: HTTPError.USER_NO_BADGE_ERROR,
        module: MODULE_NAME, method: 'executeChargingStationStopTransaction',
        message: 'The user does not have any active badge',
      });
    }
    const tag = tags.result[0];
    // Check if user is authorized
    await CommonUtilsService.isAuthorizedToStopTransaction(req.tenant, chargingStation, transaction, tag.id,
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
      filteredRequest: HttpChargingStationConfigurationChangeRequest, req: Request, res: Response, next: NextFunction,
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
          action, user: req.user,
          module: MODULE_NAME, method: 'executeChargingStationChangeConfiguration',
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
          await ocpiClient.patchChargingStationStatus(chargingStation, status);
        }
      } catch (error) {
        await Logging.logError({
          tenantID: tenant.id,
          module: MODULE_NAME, method: 'updateChargingStationRoaming',
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
          module: MODULE_NAME, method: 'updateChargingStationRoaming',
          action,
          user: loggedUser,
          message: `Unable to insert or remove charging station ${chargingStation.id} from HBS`,
          detailedMessages: { error: error.stack }
        });
      }
    }
  }

  private static async deactivateChargingStationRoaming(action: ServerAction, tenant: Tenant, user: UserToken,
      chargingStation: ChargingStation, siteArea: SiteArea) {
    if (chargingStation.public) {
      if (Utils.isComponentActiveFromToken(user, TenantComponents.OICP)) {
        try {
          const oicpClient: CpoOICPClient = await OICPClientFactory.getAvailableOicpClient(tenant, OCPIRole.CPO) as CpoOICPClient;
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
              site, siteArea, chargingStation, options), OICPActionType.DELETE);
          }
        } catch (error) {
          await Logging.logError({
            tenantID: tenant.id,
            module: MODULE_NAME, method: 'deactivateChargingStationRoaming',
            action,
            user: user,
            message: `Unable to remove charging station ${chargingStation.id} from HBS`,
            detailedMessages: { error: error.stack }
          });
        }
      }
    }
  }

  private static updateChargingStationCommonProperties(action: ServerAction, tenant: Tenant, chargingStation: ChargingStation,
      siteArea: SiteArea, user: UserToken, filteredRequest: HttpChargingStationParamsUpdateRequest): void {
    if (filteredRequest.chargingStationURL) {
      chargingStation.chargingStationURL = filteredRequest.chargingStationURL;
    }
    if (Utils.objectHasProperty(filteredRequest, 'maximumPower')) {
      chargingStation.maximumPower = filteredRequest.maximumPower;
    }
    if (Utils.objectHasProperty(filteredRequest, 'public')) {
      // Charging Station is public but cannot belong to a non public Site
      if (Utils.isComponentActiveFromToken(user, TenantComponents.ORGANIZATION) &&
          filteredRequest.public && !siteArea.site?.public) {
        throw new AppError({
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          action, user,
          errorCode: HTTPError.FEATURE_NOT_SUPPORTED_ERROR,
          message: `Cannot set charging station ${chargingStation.id} attached to the non public site ${siteArea.site.name} public`,
          module: MODULE_NAME, method: 'updateChargingStationCommonProperties',
        });
      }
      chargingStation.public = filteredRequest.public;
      // Handle update in Roaming
      void ChargingStationService.updateChargingStationRoaming(tenant, user, chargingStation, action);
    }
    if (Utils.isComponentActiveFromToken(user, TenantComponents.OCPI)) {
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
    if (filteredRequest.coordinates && filteredRequest.coordinates.length === 2) {
      chargingStation.coordinates = [
        filteredRequest.coordinates[0],
        filteredRequest.coordinates[1]
      ];
    }
    // Update timestamp
    chargingStation.lastChangedBy = { 'id': user.id };
    chargingStation.lastChangedOn = new Date();
  }

  private static async updateChargingStationManualConfiguration(action: ServerAction,
      chargingStation: ChargingStation, user: UserToken, filteredRequest: HttpChargingStationParamsUpdateRequest): Promise<boolean> {
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
            action, user,
            errorCode: HTTPError.GENERAL_ERROR,
            module: MODULE_NAME, method: 'updateChargingStationManualConfiguration',
            message: `Error occurred while updating chargingStation: '${chargingStation.id}'. No template found`,
          });
        }
        resetAndApplyTemplate = true;
      }
    }
    return resetAndApplyTemplate;
  }

  private static updateChargingStationConnectors(chargingStation: ChargingStation, user: UserToken,
      filteredRequest: HttpChargingStationParamsUpdateRequest): void {
    if (!Utils.isEmptyArray(filteredRequest.connectors)) {
      for (const filteredConnector of filteredRequest.connectors) {
        const connector = Utils.getConnectorFromID(chargingStation, filteredConnector.connectorId);
        if (connector) {
          // Update Connectors only if no Charge Point is defined
          if (Utils.isEmptyArray(chargingStation.chargePoints) || chargingStation.manualConfiguration) {
            connector.type = filteredConnector.type;
            connector.power = filteredConnector.power;
            connector.amperage = filteredConnector.amperage;
            connector.voltage = filteredConnector.voltage;
            connector.currentType = filteredConnector.currentType;
            connector.numberOfConnectedPhase = filteredConnector.numberOfConnectedPhase;
          }
          connector.phaseAssignmentToGrid = filteredConnector.phaseAssignmentToGrid;
          if (Utils.isComponentActiveFromToken(user, TenantComponents.OCPI)) {
            if (Utils.objectHasProperty(filteredConnector, 'tariffID')) {
              connector.tariffID = filteredConnector.tariffID;
            }
          }
        }
      }
    }
  }

  private static updateChargingStationManualAutoConfig(chargingStation: ChargingStation,
      user: UserToken, filteredRequest: HttpChargingStationParamsUpdateRequest): void {
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
            UtilsService.checkIfChargePointValid(chargingStation, chargePoint, user);
          } else {
            // If charging station does not have charge points, but request contains charge points, add it to the station
            if (chargingStation.chargePoints) {
              chargingStation.chargePoints.push(filteredChargePoint);
            } else {
              chargingStation.chargePoints = [filteredChargePoint];
            }
            UtilsService.checkIfChargePointValid(chargingStation, filteredChargePoint, user);
          }
        }
      // If charging station contains charge points, but request does not contain charge points, delete them
      } else if (!Utils.isEmptyArray(chargingStation.chargePoints)) {
        delete chargingStation.chargePoints;
      }
    }
  }

  private static updateChargingStationSiteArea(action: ServerAction, chargingStation: ChargingStation,
      user: UserToken, siteArea: SiteArea): void {
    if (siteArea) {
      chargingStation.companyID = siteArea.site?.companyID;
      chargingStation.siteID = siteArea.siteID;
      chargingStation.siteAreaID = siteArea.id;
      // Check if number of phases corresponds to the site area one
      for (const connector of chargingStation.connectors) {
        const numberOfConnectedPhase = Utils.getNumberOfConnectedPhases(chargingStation, null, connector.connectorId);
        if (numberOfConnectedPhase !== 1 && siteArea?.numberOfPhases === 1) {
          throw new AppError({
            action, user,
            errorCode: HTTPError.THREE_PHASE_CHARGER_ON_SINGLE_PHASE_SITE_AREA,
            module: MODULE_NAME, method: 'updateChargingStationSiteArea',
            message: `Error occurred while updating chargingStation: '${chargingStation.id}'. Site area '${chargingStation.siteArea.name}' is single phased.`,
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
  }

  private static async checkAndApplyChargingStationTemplate(action: ServerAction, tenant: Tenant, chargingStation: ChargingStation,
      user: UserToken, resetAndApplyTemplate: boolean): Promise<void> {
    // Reboot the Charging Station to reapply the templates
    if (resetAndApplyTemplate) {
      try {
        // Use the reset to apply the template again
        await OCPPCommon.triggerChargingStationReset(tenant, chargingStation, true);
      } catch (error) {
        throw new AppError({
          action, user, actionOnUser: user,
          errorCode: HTTPError.GENERAL_ERROR,
          module: MODULE_NAME, method: 'checkAndApplyChargingStationTemplate',
          message: 'Error occurred while restarting the charging station',
          detailedMessages: { error: error.stack }
        });
      }
    }
  }

  private static async updateChargingStationProfiles(action: ServerAction, tenant: Tenant, chargingStation: ChargingStation,
      user: UserToken, chargingProfiles: ChargingProfile[], updatedChargingProfiles: ChargingProfile[],
      filteredRequest: HttpChargingStationLimitPowerRequest): Promise<void> {
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
            action, user,
            errorCode: HTTPError.GENERAL_ERROR,
            module: MODULE_NAME, method: 'updateChargingStationProfiles',
            message: `Cannot change the current limitation to ${filteredRequest.ampLimitValue}A because of an existing charging plan!`,
            detailedMessages: { result: chargingProfiles[index] }
          });
        }
        await Logging.logWarning({
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          tenantID: tenant.id,
          action, user,
          module: MODULE_NAME, method: 'updateChargingStationProfiles',
          message: `Adjust the Charging Plan power limit to ${filteredRequest.ampLimitValue}A`,
          detailedMessages: { chargingProfile: chargingProfiles[index] }
        });
        // Apply & Save charging plan
        await OCPPUtils.setAndSaveChargingProfile(tenant, updatedChargingProfile);
        break;
      }
    }
  }

  private static async handleOcpiStopTransaction(action: ServerAction, tenant: Tenant, chargingStation: ChargingStation,
      user: UserToken, remoteStopRequest: HttpChargingStationTransactionStopRequest): Promise<OCPICommandResponse> {
    // Get Transaction
    const transaction = await TransactionStorage.getTransaction(
      tenant, remoteStopRequest.args.transactionId, { withUser: true });
    UtilsService.assertObjectExists(action, transaction, `Transaction ID '${remoteStopRequest.args.transactionId}' does not exist`,
      MODULE_NAME, 'handleOcpiStopTransaction', user);
    // Get OCPI client
    const ocpiClient = await OCPIClientFactory.getAvailableOcpiClient(tenant, OCPIRole.EMSP) as EmspOCPIClient;
    if (!ocpiClient) {
      throw new BackendError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action, module: MODULE_NAME, method: 'handleOcpiStopTransaction',
        message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} OCPI component requires at least one eMSP endpoint to start a Transaction`
      });
    }
    // Stop the Transaction
    return ocpiClient.remoteStopSession(transaction.id);
  }

  private static async handleOcpiStartTransaction(action: ServerAction, tenant: Tenant, chargingStation: ChargingStation,
      user: UserToken, remoteStartRequest: HttpChargingStationTransactionStartRequest): Promise<OCPICommandResponse> {
    // Get the Tag
    let tagID = remoteStartRequest.args.tagID;
    if (!tagID && remoteStartRequest.args.visualTagID) {
      // Check and Get Tag
      const tag = await UtilsService.checkAndGetTagByVisualIDAuthorization(
        tenant, user, remoteStartRequest.args.visualTagID, Action.READ, action, null, {}, true);
      if (!tag) {
        throw new AppError({
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          action, user,
          errorCode: HTTPError.GENERAL_ERROR,
          module: MODULE_NAME, method: 'handleOcpiStartTransaction',
          message: `Tag with Visual ID '${remoteStartRequest.args.visualTagID}' does not exist`,
          detailedMessages: { remoteStartRequest, chargingStation },
        });
      }
      tagID = tag.id;
    }
    // Get OCPI client
    const ocpiClient = await OCPIClientFactory.getAvailableOcpiClient(tenant, OCPIRole.EMSP) as EmspOCPIClient;
    if (!ocpiClient) {
      throw new BackendError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action, module: MODULE_NAME, method: 'handleOcpiStartTransaction',
        message: `${Utils.buildConnectorInfo(remoteStartRequest.args.connectorId)} OCPI component requires at least one eMSP endpoint to stop a Transaction`
      });
    }
    // Start the Transaction
    return ocpiClient.remoteStartSession(chargingStation, remoteStartRequest.args.connectorId, tagID);
  }
}
