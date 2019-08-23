import { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import Authorizations from '../../../authorization/Authorizations';
import ChargingStation from '../../../types/ChargingStation';
import ChargingStationSecurity from './security/ChargingStationSecurity';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import Constants from '../../../utils/Constants';
import { HttpChargingStationCommandRequest, HttpIsAuthorizedRequest } from '../../../types/requests/HttpChargingStationRequest';
import Logging from '../../../utils/Logging';
import OCPPStorage from '../../../storage/mongodb/OCPPStorage';
import OCPPUtils from '../../ocpp/utils/OCPPUtils';
import SiteAreaStorage from '../../../storage/mongodb/SiteAreaStorage';
import SiteStorage from '../../../storage/mongodb/SiteStorage';
import Transaction from '../../../types/Transaction';
import TransactionStorage from '../../../storage/mongodb/TransactionStorage';
import User from '../../../types/User';
import UserStorage from '../../../storage/mongodb/UserStorage';
import UserToken from '../../../types/UserToken';
import Utils from '../../../utils/Utils';
import UtilsService from './UtilsService';

export default class ChargingStationService {

  public static async handleAssignChargingStationsToSiteArea(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(
      req.user, Constants.COMPONENTS.ORGANIZATION,
      Constants.ACTION_UPDATE, Constants.ENTITY_CHARGING_STATION, 'ChargingStationService', 'handleAssignChargingStationsToSiteArea');
    // Filter
    const filteredRequest = ChargingStationSecurity.filterAssignChargingStationsToSiteAreaRequest(req.body);
    // Check mandatory fields
    UtilsService.assertIdIsProvided(filteredRequest.siteAreaID, 'ChargingStationService', 'handleAssignChargingSTationsToSiteArea', req.user);
    if (!filteredRequest.chargingStationIDs || (filteredRequest.chargingStationIDs && filteredRequest.chargingStationIDs.length <= 0)) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'The Charging Station\'s IDs must be provided', Constants.HTTP_GENERAL_ERROR,
        'ChargingStationService', 'handleAssignChargingStationsToSiteArea', req.user);
    }
    // Get the Site Area (before auth to get siteID)
    const siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, filteredRequest.siteAreaID);
    UtilsService.assertObjectExists(siteArea, `SiteArea '${filteredRequest.siteAreaID}' doesn't exist anymore.`,
      'ChargingStationService', 'handleAssignChargingStationsToSiteArea', req.user);
    // Check auth
    if (!Authorizations.canUpdateSiteArea(req.user, siteArea.siteID)) {
      throw new AppAuthError(
        Constants.ACTION_UPDATE,
        Constants.ENTITY_SITE_AREA,
        filteredRequest.siteAreaID,
        Constants.HTTP_AUTH_ERROR,
        'ChargingStationService', 'handleAssignChargingStationsToSiteArea',
        req.user);
    }
    // Get Charging Stations
    for (const chargingStationID of filteredRequest.chargingStationIDs) {
      // Check the charging station
      const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, chargingStationID);
      UtilsService.assertObjectExists(chargingStation, `ChargingStation '${chargingStationID}' doesn't exist anymore.`,
        'ChargingStationService', 'handleAssignChargingStationsToSiteArea', req.user);
      // Check auth
      if (!Authorizations.canUpdateChargingStation(req.user, siteArea.siteID)) {
        throw new AppAuthError(
          Constants.ACTION_UPDATE,
          Constants.ENTITY_CHARGING_STATION,
          chargingStationID,
          Constants.HTTP_AUTH_ERROR,
          'ChargingStationService', 'handleAssignChargingStationsToSiteArea',
          req.user);
      }
    }
    // Save
    if (action === 'AddChargingStationsToSiteArea') {
      await ChargingStationStorage.addChargingStationsToSiteArea(req.user.tenantID, filteredRequest.siteAreaID, filteredRequest.chargingStationIDs);
    } else {
      await ChargingStationStorage.removeChargingStationsFromSiteArea(req.user.tenantID, filteredRequest.siteAreaID, filteredRequest.chargingStationIDs);
    }
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user,
      module: 'ChargingStationService',
      method: 'handleAssignChargingStationsToSiteArea',
      message: 'Site Area\'s Charging Stations have been assigned successfully',
      action: action
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleUpdateChargingStationParams(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationSecurity.filterChargingStationParamsUpdateRequest(req.body, req.user);
    // Check existence
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, filteredRequest.id);
    // Check
    UtilsService.assertObjectExists(chargingStation, `ChargingStation '${filteredRequest.id}' doesn't exist.`,
      'ChargingStationService', 'handleAssignChargingStationsToSiteArea', req.user);

    let siteID = null;
    if (Utils.isComponentActiveFromToken(req.user, Constants.COMPONENTS.ORGANIZATION)) {
      // Get the Site Area
      const siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, chargingStation.siteAreaID);
      siteID = siteArea ? siteArea.siteID : null;
    }

    // Check Auth
    if (!Authorizations.canUpdateChargingStation(req.user, siteID)) {
      throw new AppAuthError(
        Constants.ACTION_UPDATE, Constants.ENTITY_CHARGING_STATION,
        chargingStation.id, Constants.HTTP_AUTH_ERROR,
        'ChargingStationService', 'handleUpdateChargingStationParams',
        req.user);
    }
    // Update URL
    if (filteredRequest.chargingStationURL) {
      chargingStation.chargingStationURL = filteredRequest.chargingStationURL;
    }
    // Update Nb Phase
    if (filteredRequest.hasOwnProperty('numberOfConnectedPhase')) {
      chargingStation.numberOfConnectedPhase = filteredRequest.numberOfConnectedPhase;
    }
    // Update Power Max
    if (filteredRequest.hasOwnProperty('maximumPower')) {
      chargingStation.maximumPower = filteredRequest.maximumPower;
    }
    // Update Cannot Charge in Parallel
    if (filteredRequest.hasOwnProperty('cannotChargeInParallel')) {
      chargingStation.cannotChargeInParallel = filteredRequest.cannotChargeInParallel;
    }
    // Update Site Area
    if (filteredRequest.siteArea) {
      chargingStation.siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, filteredRequest.siteArea.id);
      chargingStation.siteAreaID = chargingStation.siteArea.id;
    } else {
      chargingStation.siteAreaID = null;
    }
    // Update Site Area
    if (filteredRequest.hasOwnProperty('powerLimitUnit')) {
      chargingStation.powerLimitUnit = filteredRequest.powerLimitUnit;
    }
    // Update Latitude
    if (filteredRequest.hasOwnProperty('latitude')) {
      chargingStation.latitude = filteredRequest.latitude;
    }
    // Update Longitude
    if (filteredRequest.hasOwnProperty('longitude')) {
      chargingStation.longitude = filteredRequest.longitude;
    }
    // Update Connectors
    if (filteredRequest.connectors) {
      const chargerConnectors = chargingStation.connectors;
      // Assign to Charger's connector
      for (const connector of filteredRequest.connectors) {
        // Set
        chargerConnectors[connector.connectorId - 1].power = connector.power;
        chargerConnectors[connector.connectorId - 1].type = connector.type;
        chargerConnectors[connector.connectorId - 1].voltage = connector.voltage;
        chargerConnectors[connector.connectorId - 1].amperage = connector.amperage;
      }
    }
    // Update timestamp
    chargingStation.lastChangedBy = { 'id': req.user.id };
    chargingStation.lastChangedOn = new Date();
    // Update
    await ChargingStationStorage.saveChargingStation(req.user.tenantID, chargingStation);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      source: chargingStation.id,
      user: req.user, module: 'ChargingStationService',
      method: 'handleUpdateChargingStationParams',
      message: 'Parameters have been updated successfully',
      action: action, detailedMessages: {
        'numberOfConnectedPhase': chargingStation.numberOfConnectedPhase,
        'chargingStationURL': chargingStation.chargingStationURL
      }
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetChargingStationConfiguration(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationSecurity.filterChargingStationConfigurationRequest(req.query);
    // Check
    UtilsService.assertIdIsProvided(filteredRequest.ChargeBoxID, 'ChargingStationService', 'handleGetChargingStationConfiguration', req.user);
    // Get the Charging Station`
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, filteredRequest.ChargeBoxID);
    // Found?
    UtilsService.assertObjectExists(chargingStation, `ChargingStation '${filteredRequest.ChargeBoxID}' doesn't exist anymore.`,
      'ChargingStationService', 'handleAssignChargingStationsToSiteArea', req.user);
    // Check auth
    if (!Authorizations.canReadChargingStation(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_READ, Constants.ENTITY_CHARGING_STATION,
        chargingStation.id, Constants.HTTP_AUTH_ERROR,
        'ChargingStationService', 'handleGetChargingStationConfiguration',
        req.user);
    }
    // Get the Config
    const configuration = await ChargingStationStorage.getConfiguration(req.user.tenantID, chargingStation.id);
    // Return the result
    res.json(configuration);
    next();
  }

  public static async handleRequestChargingStationConfiguration(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationSecurity.filterChargingStationConfigurationRequest(req.query);
    UtilsService.assertIdIsProvided(filteredRequest.ChargeBoxID, 'ChargingStationService', 'handleGetChargingStationConfiguration', req.user);
    // Check auth
    if (!Authorizations.canReadChargingStation(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_READ,
        Constants.ENTITY_CHARGING_STATION,
        filteredRequest.ChargeBoxID, Constants.HTTP_AUTH_ERROR,
        'ChargingStationService', 'handleGetChargingStationConfiguration',
        req.user);
    }
    // Get the Charging Station
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, filteredRequest.ChargeBoxID);
    // Found?
    UtilsService.assertObjectExists(chargingStation, `ChargingStation '${filteredRequest.ChargeBoxID}' doesn't exist anymore.`,
      'ChargingStationService', 'handleAssignChargingStationsToSiteArea', req.user);
    // Get the Config
    const result = await OCPPUtils.requestAndSaveChargingStationConfiguration(req.user.tenantID, chargingStation);
    // Ok
    res.json(result);
    next();
  }

  public static async handleDeleteChargingStation(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const chargingStationID = ChargingStationSecurity.filterChargingStationRequestByID(req.query);
    // Check Mandatory fields
    UtilsService.assertIdIsProvided(chargingStationID, 'ChargingStationService',
      'handleDeleteChargingStation', req.user);
    // Get
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, chargingStationID);
    // Check
    UtilsService.assertObjectExists(chargingStation, `Charging Station with ID '${chargingStationID}' does not exist`,
      'ChargingStationService', 'handleDeleteChargingStation', req.user);

    let siteID = null;
    if (Utils.isComponentActiveFromToken(req.user, Constants.COMPONENTS.ORGANIZATION)) {
      // Get the Site Area
      const siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, chargingStation.siteAreaID);
      siteID = siteArea ? siteArea.siteID : null;
    }
    // Check auth
    if (!Authorizations.canDeleteChargingStation(req.user, siteID)) {
      throw new AppAuthError(
        Constants.ACTION_DELETE,
        Constants.ENTITY_CHARGING_STATION,
        chargingStationID, Constants.HTTP_AUTH_ERROR,
        'ChargingStationService', 'handleDeleteChargingStation',
        req.user);
    }

    // Deleted
    if (chargingStation.deleted) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `ChargingStation with ID '${chargingStationID}' is already deleted`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'ChargingStationService', 'handleDeleteChargingStation', req.user);
    }
    // Check no active transaction
    const foundIndex = chargingStation.connectors.findIndex(
      (connector) => connector ? connector.activeTransactionID > 0 : false);
    if (foundIndex >= 0) {
      // Can' t be deleted
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Charging station '${chargingStation.id}' can't be deleted due to existing active transactions`,
        Constants.HTTP_EXISTING_TRANSACTION_ERROR,
        'ChargingStationService', 'handleDeleteChargingStation', req.user);
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
      user: req.user, module: 'ChargingStationService', method: 'handleDeleteChargingStation',
      message: `Charging Station '${chargingStation.id}' has been deleted successfully`,
      action: action, detailedMessages: chargingStation
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetChargingStation(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationSecurity.filterChargingStationRequest(req.query);
    // Check
    UtilsService.assertIdIsProvided(filteredRequest.ID, 'ChargingStationService', 'handleGetChargingStation', req.user);
    // Check auth
    if (!Authorizations.canReadChargingStation(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_READ,
        Constants.ENTITY_CHARGING_STATION,
        filteredRequest.ID, Constants.HTTP_AUTH_ERROR, 'ChargingStationService',
        'handleGetChargingStation', req.user);
    }
    // Query charging station
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, filteredRequest.ID);
    // Check
    UtilsService.assertObjectExists(chargingStation, `Charging Station '${filteredRequest.ID}' does not exist`,
      'ChargingStationService', 'handleGetChargingStation', req.user);
    // Deleted?
    if (chargingStation.deleted) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `ChargingStation with ID '${filteredRequest.ID}' is logically deleted`,
        Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'ChargingStationService', 'handleGetChargingStation', req.user);
    }
    // Ok
    res.json(
      // Filter
      ChargingStationSecurity.filterChargingStationResponse(
        chargingStation, req.user, req.user.activeComponents.includes(Constants.COMPONENTS.ORGANIZATION))
    );
    next();
  }

  public static async handleGetChargingStations(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Return
    res.json(await ChargingStationService._getChargingStations(req));
    next();
  }

  public static async handleGetChargingStationsExport(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Get Charging Stations
    const chargingStations = await ChargingStationService._getChargingStations(req);
    // Build export
    const filename = 'chargingStations_export.csv';
    fs.writeFile(filename, ChargingStationService._convertToCSV(chargingStations.result), (err) => {
      if (err) {
        throw err;
      }
      res.download(filename, (err2) => {
        if (err2) {
          throw err2;
        }
        fs.unlink(filename, (err3) => {
          if (err3) {
            throw err3;
          }
        });
      });
    });
  }

  public static async handleGetChargingStationsInError(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!req.query.ErrorType) {
      req.query.ErrorType = ['all'];
    } else {
      req.query.ErrorType = req.query.ErrorType.split('|');
    }
    return await ChargingStationService.handleGetChargingStations(action, req, res, next);
  }

  public static async handleGetStatusNotifications(action: string, req: Request, res: Response, next: NextFunction) {
    // Check auth
    if (!Authorizations.canListChargingStations(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_LIST,
        Constants.ENTITY_CHARGING_STATIONS,
        null, Constants.HTTP_AUTH_ERROR,
        'ChargingStationService', 'handleGetStatusNotifications',
        req.user);
    }
    // Filter
    const filteredRequest = ChargingStationSecurity.filterNotificationsRequest(req.query, req.user);
    // Get all Status Notifications
    const statusNotifications = await OCPPStorage.getStatusNotifications(req.user.tenantID, {},
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort });
    // Set
    statusNotifications.result = ChargingStationSecurity.filterStatusNotificationsResponse(statusNotifications.result, req.user);
    // Return
    res.json(statusNotifications);
    next();
  }

  public static async handleGetBootNotifications(action: string, req: Request, res: Response, next: NextFunction) {
    // Check auth
    if (!Authorizations.canListChargingStations(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_LIST,
        Constants.ENTITY_CHARGING_STATIONS,
        null, Constants.HTTP_AUTH_ERROR,
        'ChargingStationService', 'handleGetBootNotifications',
        req.user);
    }
    // Filter
    const filteredRequest = ChargingStationSecurity.filterNotificationsRequest(req.query, req.user);
    // Get all Status Notifications
    const bootNotifications = await OCPPStorage.getBootNotifications(req.user.tenantID, {},
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort });
    // Set
    bootNotifications.result = ChargingStationSecurity.filterBootNotificationsResponse(bootNotifications.result, req.user);
    // Return
    res.json(bootNotifications);
    next();
  }

  public static async handleAction(action: string, req: Request, res: Response, next: NextFunction) {
    // Filter - Type is hacked because code below is. Would need approval to change code structure.
    const filteredRequest: HttpChargingStationCommandRequest & { loadAllConnectors?: boolean } = ChargingStationSecurity.filterChargingStationActionRequest(req.body, action, req.user);
    UtilsService.assertIdIsProvided(filteredRequest.chargeBoxID, 'ChargingSTationService', 'handleAction', req.user);
    // Get the Charging station
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, filteredRequest.chargeBoxID);
    UtilsService.assertObjectExists(chargingStation, `Charging Station with ID '${filteredRequest.chargeBoxID}' does not exist`,
      'ChargingStationService', 'handleAction', req.user);
    let result;
    // Remote Stop Transaction / Unlock Connector
    if (action === 'RemoteStopTransaction' || action === 'UnlockConnector') {
      // Check Transaction ID
      if (!filteredRequest.args || !filteredRequest.args.transactionId) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          'Transaction ID is mandatory', Constants.HTTP_AUTH_ERROR,
          'ChargingStationService', 'handleAction', req.user, null, action);
      }
      // Get Transaction
      const transaction = await TransactionStorage.getTransaction(req.user.tenantID, filteredRequest.args.transactionId);
      UtilsService.assertObjectExists(transaction, `Transaction ID '${filteredRequest.args.transactionId}' does not exist`,
        'ChargingStationService', 'handleAction', req.user);
      // Add connector ID
      filteredRequest.args.connectorId = transaction.connectorId;
      // Check Tag ID
      if (!req.user.tagIDs || req.user.tagIDs.length === 0) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          'The user does not have any badge',
          Constants.HTTP_USER_NO_BADGE_ERROR,
          'ChargingStationService', 'handleAction', req.user, null, action);
      }
      // Check if user is authorized
      await Authorizations.isAuthorizedToStopTransaction(req.user.tenantID, chargingStation, transaction, req.user.tagIDs[0]);
      // Set the tag ID to handle the Stop Transaction afterwards
      transaction.remotestop = {
        timestamp: new Date(),
        tagID: req.user.tagIDs[0]
      };
      // Save Transaction
      await TransactionStorage.saveTransaction(req.user.tenantID, transaction);
      // Ok: Execute it
      result = await ChargingStationService._handleAction(req.user.tenantID, chargingStation, action, filteredRequest.args);
      // Remote Start Transaction
    } else if (action === 'RemoteStartTransaction') {
      // Check Tag ID
      if (!filteredRequest.args || !filteredRequest.args.tagID) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          'The user does not have any badge',
          Constants.HTTP_USER_NO_BADGE_ERROR,
          'ChargingStationService', 'handleAction', req.user, null, action);
      }
      // Check if user is authorized
      await Authorizations.isAuthorizedToStartTransaction(req.user.tenantID, chargingStation, filteredRequest.args.tagID);
      // Ok: Execute it
      result = await ChargingStationService._handleAction(req.user.tenantID, chargingStation, action, filteredRequest.args);
    } else if (action === 'GetCompositeSchedule') {
      // Check auth
      if (!Authorizations.canPerformActionOnChargingStation(req.user, action)) {
        throw new AppAuthError(action,
          Constants.ENTITY_CHARGING_STATION,
          chargingStation.id,
          Constants.HTTP_AUTH_ERROR, 'ChargingStationService', 'handleAction',
          req.user);
      }
      // Check if we have to load all connectors in case connector 0 fails
      if (req.body.hasOwnProperty('loadAllConnectors')) {
        filteredRequest.loadAllConnectors = req.body.loadAllConnectors;
      }
      if (filteredRequest.loadAllConnectors && filteredRequest.args.connectorId === 0) {
        // Call for connector 0
        result = await ChargingStationService._handleAction(req.user.tenantID, chargingStation, action, filteredRequest.args);
        if (result.status !== Constants.OCPP_RESPONSE_ACCEPTED) {
          result = [];
          // Call each connectors
          for (const connector of chargingStation.connectors) {
            filteredRequest.args.connectorId = connector.connectorId;
            // Execute request
            const simpleResult = await ChargingStationService._handleAction(req.user.tenantID, chargingStation, action, filteredRequest.args);
            // Fix central reference date
            const centralTime = new Date();
            simpleResult.centralSystemTime = centralTime;
            result.push(simpleResult);
          }
        }
      } else {
        // Execute it
        result = await ChargingStationService._handleAction(req.user.tenantID, chargingStation, action, filteredRequest.args);
        // Fix central reference date
        const centralTime = new Date();
        result.centralSystemTime = centralTime;
      }
    } else {
      // Check auth
      if (!Authorizations.canPerformActionOnChargingStation(req.user, action)) {
        throw new AppAuthError(action,
          Constants.ENTITY_CHARGING_STATION,
          chargingStation.id,
          Constants.HTTP_AUTH_ERROR, 'ChargingStationService', 'handleAction',
          req.user);
      }
      // Execute it
      result = await ChargingStationService._handleAction(req.user.tenantID, chargingStation, action, filteredRequest.args);
    }
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      source: chargingStation.id, user: req.user, action: action,
      module: 'ChargingStationService', method: 'handleAction',
      message: `'${action}' has been executed successfully`,
      detailedMessages: result
    });
    // Return
    res.json(result);
    next();
  }

  public static async handleActionSetMaxIntensitySocket(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationSecurity.filterChargingStationSetMaxIntensitySocketRequest(req.body);
    // Charge Box is mandatory
    UtilsService.assertIdIsProvided(filteredRequest.chargeBoxID, 'ChargingStationService', 'handleActionSetMaxIntensitySocket', req.user);
    // Check auth
    if (!Authorizations.canPerformActionOnChargingStation(req.user, 'ChangeConfiguration')) {
      throw new AppAuthError(action,
        Constants.ENTITY_CHARGING_STATION,
        filteredRequest.chargeBoxID,
        Constants.HTTP_AUTH_ERROR, 'ChargingStationService', 'handleActionSetMaxIntensitySocket',
        req.user);
    }
    // Get the Charging station
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, filteredRequest.chargeBoxID);
    UtilsService.assertObjectExists(chargingStation, `Charging Station with ID '${filteredRequest.chargeBoxID}' does not exist`,
      'ChargingStationService', 'handleActionSetMaxIntensitySocket', req.user);
    // Get the Config
    const chargerConfiguration = await ChargingStationStorage.getConfiguration(req.user.tenantID, chargingStation.id);
    UtilsService.assertObjectExists(chargerConfiguration, 'Cannot retrieve the configuration',
      'ChargingStationService', 'handleActionSetMaxIntensitySocket', req.user);
    let maxIntensitySocketMax = null;
    // Fill current params
    for (let i = 0; i < chargerConfiguration.configuration.length; i++) {
      // Max Intensity?
      if (chargerConfiguration.configuration[i].key.startsWith('currentpb')) {
        maxIntensitySocketMax = Number(chargerConfiguration.configuration[i].value);
      }
    }
    UtilsService.assertObjectExists(maxIntensitySocketMax, 'Cannot retrieve the max intensity socket from the configuration',
      'ChargingStationService', 'handleActionSetMaxIntensitySocket', req.user);
    // Check
    let result;
    if (filteredRequest.maxIntensity && filteredRequest.maxIntensity >= 0 && filteredRequest.maxIntensity <= maxIntensitySocketMax) {
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user,
        module: 'ChargingStationService',
        method: 'handleActionSetMaxIntensitySocket',
        action: action,
        source: chargingStation.id,
        message: `Max Instensity Socket has been set to '${filteredRequest.maxIntensity}'`
      });
      // Change the config
      result = await OCPPUtils.requestChangeChargingStationConfiguration(req.user.tenantID, chargingStation,
        { key: 'maxintensitysocket', value: filteredRequest.maxIntensity });
    } else {
      // Invalid value
      throw new AppError(
        chargingStation.id,
        `Invalid value for Max Intensity Socket: '${filteredRequest.maxIntensity}'`, Constants.HTTP_GENERAL_ERROR,
        'ChargingStationService', 'handleActionSetMaxIntensitySocket', req.user);
    }
    // Return the result
    res.json(result);
    next();
  }

  public static async handleIsAuthorized(action: string, req: Request, res: Response, next: NextFunction) {
    let user: User;
    // Default
    let result = [{ 'IsAuthorized': false }];
    // Filter
    const filteredRequest = ChargingStationSecurity.filterIsAuthorizedRequest(req.query);
    // Check
    if (!filteredRequest.Action) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'The Action is mandatory',
        Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR, 'ChargingStationService', 'handleIsAuthorized');
    }
    let chargingStation: ChargingStation = null;
    // Action
    switch (filteredRequest.Action) {
      // Hack for mobile app not sending the RemoteStopTransaction yet
      case 'StopTransaction':
      case 'RemoteStopTransaction':
        // Check
        if (!filteredRequest.Arg1) {
          throw new AppError(
            Constants.CENTRAL_SERVER,
            'The Charging Station ID is mandatory',
            Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR, 'ChargingStationService', 'handleIsAuthorized');
        }
        // Get the Charging station
        chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, filteredRequest.Arg1);
        // Found?
        if (!chargingStation) {
          // Not Found!
          throw new AppError(
            Constants.CENTRAL_SERVER,
            `Charging Station with ID '${filteredRequest.Arg1}' does not exist`,
            Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR, 'ChargingStationService', 'handleIsAuthorized');
        }
        // Check
        if (!filteredRequest.Arg2) {
          const results = [];
          // Check authorization for each connectors
          for (let index = 0; index < chargingStation.connectors.length; index++) {
            const foundConnector = chargingStation.connectors.find((connector) => connector.connectorId === index + 1);
            const tempResult = { 'IsAuthorized': false };
            if (foundConnector && foundConnector.activeTransactionID) {
              tempResult.IsAuthorized = await ChargingStationService.isStopTransactionAuthorized(
                filteredRequest, chargingStation, foundConnector.activeTransactionID, req.user);
            }
            results.push(tempResult);
          }
          // Return table of result (will be in the connector order)
          result = results;
        } else {
          result[0].IsAuthorized = await ChargingStationService.isStopTransactionAuthorized(
            filteredRequest, chargingStation, filteredRequest.Arg2, req.user);
        }
        break;
      // Action on connectors of a charger
      case 'ConnectorsAction':
        // Arg1 contains the charger ID
        // Check
        if (!filteredRequest.Arg1) {
          throw new AppError(
            Constants.CENTRAL_SERVER,
            'The Charging Station ID is mandatory',
            Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR, 'ChargingStationService', 'handleIsAuthorized');
        }
        // Get the Charging station
        chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, filteredRequest.Arg1);
        // Found?
        if (!chargingStation) {
          // Not Found!
          throw new AppError(
            Constants.CENTRAL_SERVER,
            `Charging Station with ID '${filteredRequest.Arg1}' does not exist`,
            Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR, 'ChargingStationService', 'handleIsAuthorized');
        }

        user = await UserStorage.getUser(req.user.tenantID, req.user.id);
        // Found?
        if (!user) {
          // Not Found!
          throw new AppError(
            Constants.CENTRAL_SERVER,
            `User with ID '${filteredRequest.Arg1}' does not exist`,
            Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR, 'ChargingStationService', 'handleIsAuthorized');
        }
        result = await ChargingStationService.checkConnectorsActionAuthorizations(req.user.tenantID, req.user, chargingStation);
        break;
    }
    // Return the result
    res.json(result.length === 1 ? result[0] : result);
    next();
  }

  private static async checkConnectorsActionAuthorizations(tenantID: string, user: UserToken, chargingStation: ChargingStation) {
    const results = [];
    if (Utils.isComponentActiveFromToken(user, Constants.COMPONENTS.ORGANIZATION)) {
      try {
        // Site is mandatory
        if (!chargingStation.siteArea) {
          throw new AppError(
            chargingStation.id,
            `Charging Station '${chargingStation.id}' is not assigned to a Site Area!`,
            Constants.HTTP_AUTH_CHARGER_WITH_NO_SITE_AREA_ERROR,
            'AuthService', 'checkConnectorsActionAuthorizations');
        }

        // Site -----------------------------------------------------
        chargingStation.siteArea.site = await SiteStorage.getSite(tenantID, chargingStation.siteArea.siteID);
        if (!chargingStation.siteArea.site) {
          throw new AppError(
            chargingStation.id,
            `Site Area '${chargingStation.siteArea.name}' is not assigned to a Site!`,
            Constants.HTTP_AUTH_SITE_AREA_WITH_NO_SITE_ERROR,
            'AuthService', 'checkConnectorsActionAuthorizations',
            user);
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
      if (foundConnector.activeTransactionID > 0) {
        const transaction = await TransactionStorage.getTransaction(user.tenantID, foundConnector.activeTransactionID);
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

  private static async isStopTransactionAuthorized(filteredRequest: HttpIsAuthorizedRequest, chargingStation: ChargingStation, transactionId: number, user: UserToken) {
    // Get Transaction
    const transaction = await TransactionStorage.getTransaction(user.tenantID, transactionId);
    if (!transaction) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Transaction ID '${filteredRequest.Arg2}' does not exist`,
        Constants.HTTP_AUTH_ERROR, 'AuthService', 'isStopTransactionAuthorized');
    }
    // Check Charging Station
    if (transaction.chargeBoxID !== chargingStation.id) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Transaction ID '${filteredRequest.Arg2}' has a Charging Station '${transaction.chargeBoxID}' that differs from '${chargingStation.id}'`,
        565, 'AuthService', 'isStopTransactionAuthorized');
    }
    return Authorizations.canStopTransaction(user, transaction);
  }

  private static async _getChargingStations(req: Request): Promise<{count: number; result: ChargingStation[]}> {
    // Check auth
    if (!Authorizations.canListChargingStations(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_LIST,
        Constants.ENTITY_CHARGING_STATIONS,
        null, Constants.HTTP_AUTH_ERROR,
        'ChargingStationService', 'handleGetChargingStations',
        req.user);
    }
    // Filter
    const filteredRequest = ChargingStationSecurity.filterChargingStationsRequest(req.query);
    // Check component
    if (filteredRequest.SiteID || filteredRequest.WithSite || filteredRequest.SiteAreaID || !filteredRequest.WithNoSiteArea) {
      UtilsService.assertComponentIsActiveFromToken(req.user,
        Constants.COMPONENTS.ORGANIZATION, Constants.ACTION_READ, Constants.ENTITY_CHARGING_STATIONS, 'ChargingStationService', 'handleGetChargingStations');
    }
    // Get Charging Stations
    const chargingStations = await ChargingStationStorage.getChargingStations(req.user.tenantID,
      {
        search: filteredRequest.Search,
        withNoSiteArea: filteredRequest.WithNoSiteArea,
        withSite: filteredRequest.WithSite,
        siteIDs: (filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : Authorizations.getAuthorizedSiteIDs(req.user)),
        siteAreaID: filteredRequest.SiteAreaID,
        includeDeleted: filteredRequest.IncludeDeleted,
        errorType: filteredRequest.ErrorType
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.Sort,
        onlyRecordCount: filteredRequest.OnlyRecordCount
      }
    );
    chargingStations.result.forEach((chargingStation) => {
      chargingStation.inactive = OCPPUtils.getIfChargingStationIsInactive(chargingStation);
    });
    // Build the result
    if (chargingStations.result && chargingStations.result.length > 0) {
      // Filter
      ChargingStationSecurity.filterChargingStationsResponse(
        chargingStations, req.user, req.user.activeComponents.includes(Constants.COMPONENTS.ORGANIZATION));
    }
    return chargingStations;
  }

  private static _convertToCSV(chargingStations: ChargingStation[]): string {
    let csv = 'id,createdOn,connectors,siteAreaID,latitude,longitude,chargePointSerialNumber,chargePointModel,chargeBoxSerialNumber,chargePointVendor,firmwareVersion,endpoint,ocppVersion,ocppProtocol,lastHeartBeat,deleted,inactive,lastReboot,numberOfConnectedPhase,maximumPower,cannotChargeInParallel,powerLimitUnit\r\n';
    for (const chargingStation of chargingStations) {
      csv += `${chargingStation.id},`;
      csv += `${chargingStation.createdOn},`;
      csv += `${chargingStation.connectors ? chargingStation.connectors.length : ''},`;
      csv += `${chargingStation.siteAreaID},`;
      csv += `${chargingStation.latitude ? chargingStation.latitude : ''},`;
      csv += `${chargingStation.longitude ? chargingStation.longitude : ''},`;
      csv += `${chargingStation.chargePointSerialNumber},`;
      csv += `${chargingStation.chargePointModel},`;
      csv += `${chargingStation.chargeBoxSerialNumber},`;
      csv += `${chargingStation.chargePointVendor},`;
      csv += `${chargingStation.firmwareVersion},`;
      csv += `${chargingStation.endpoint},`;
      csv += `${chargingStation.ocppVersion},`;
      csv += `${chargingStation.ocppProtocol},`;
      csv += `${chargingStation.lastHeartBeat},`;
      csv += `${chargingStation.deleted},`;
      csv += `${chargingStation.inactive},`;
      csv += `${chargingStation.lastReboot},`;
      csv += `${chargingStation.numberOfConnectedPhase},`;
      csv += `${chargingStation.maximumPower},`;
      csv += `${chargingStation.cannotChargeInParallel},`;
      csv += `${chargingStation.powerLimitUnit}\r\n`;
    }
    return csv;
  }

  private static async _handleAction(tenantID: string, chargingStation: ChargingStation, action: string, args: any) {
    switch (action) {
      case 'ClearCache':
        return await OCPPUtils.requestExecuteChargingStationCommand(tenantID, chargingStation, 'clearCache');
      case 'GetConfiguration':
        return await OCPPUtils.requestExecuteChargingStationCommand(tenantID, chargingStation, 'getConfiguration', args);
      case 'ChangeConfiguration':
        return await OCPPUtils.requestChangeChargingStationConfiguration(tenantID, chargingStation, args);
      case 'RemoteStopTransaction':
        return await OCPPUtils.requestExecuteChargingStationCommand(tenantID, chargingStation, 'remoteStopTransaction', args);
      case 'RemoteStartTransaction':
        return await OCPPUtils.requestExecuteChargingStationCommand(tenantID, chargingStation, 'remoteStartTransaction', args);
      case 'UnlockConnector':
        return await OCPPUtils.requestExecuteChargingStationCommand(tenantID, chargingStation, 'unlockConnector', args);
      case 'Reset':
        return await OCPPUtils.requestExecuteChargingStationCommand(tenantID, chargingStation, 'reset', args);
      case 'SetChargingProfile':
        return await OCPPUtils.requestExecuteChargingStationCommand(tenantID, chargingStation, 'setChargingProfile', args);
      case 'GetCompositeSchedule':
        return await OCPPUtils.requestExecuteChargingStationCommand(tenantID, chargingStation, 'getCompositeSchedule', args);
      case 'ClearChargingProfile':
        return await OCPPUtils.requestExecuteChargingStationCommand(tenantID, chargingStation, 'clearChargingProfile', args);
      case 'GetDiagnostics':
        return await OCPPUtils.requestExecuteChargingStationCommand(tenantID, chargingStation, 'getDiagnostics', args);
      case 'ChangeAvailability':
        return await OCPPUtils.requestExecuteChargingStationCommand(tenantID, chargingStation, 'changeAvailability', args);
      case 'UpdateFirmware':
        return await OCPPUtils.requestExecuteChargingStationCommand(tenantID, chargingStation, 'updateFirmware', args);
    }
  }
}
