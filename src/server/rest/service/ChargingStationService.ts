import fs from 'fs';
import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import Authorizations from '../../../authorization/Authorizations';
import ChargingStation from '../../../types/ChargingStation';
import ChargingStationSecurity from './security/ChargingStationSecurity';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import OCPPStorage from '../../../storage/mongodb/OCPPStorage';
import SiteAreaStorage from '../../../storage/mongodb/SiteAreaStorage';
import TransactionStorage from '../../../storage/mongodb/TransactionStorage';
import { Request, Response, NextFunction } from 'express';
import UtilsService from './UtilsService';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import buildChargingStationClient from '../../../client/ocpp/ChargingStationClientFactory';
import ChargingStationClient from '../../../client/ocpp/ChargingStationClient';
import Utils from '../../../utils/Utils';
import BackendError from '../../../exception/BackendError';
import OCPPConstants from '../../ocpp/utils/OCPPConstants';
import OCPPUtils from '../../ocpp/utils/OCPPUtils';

export default class ChargingStationService {

  public static async handleAddChargingStationsToSiteArea(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationSecurity.filterAssignChargingStationsToSiteAreaRequest(req.body);
    // Check Mandatory fields
    if (!filteredRequest.siteAreaID) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'The Site Area\'s ID must be provided', Constants.HTTP_GENERAL_ERROR,
        'ChargingStationService', 'handleAddChargingStationsToSiteArea', req.user);
    }
    if (!filteredRequest.chargingStationIDs || (filteredRequest.chargingStationIDs && filteredRequest.chargingStationIDs.length <= 0)) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'The Charging Station\'s IDs must be provided', Constants.HTTP_GENERAL_ERROR,
        'ChargingStationService', 'handleAddChargingStationsToSiteArea', req.user);
    }
    // Check auth
    if (!Authorizations.canUpdateSiteArea(req.user, filteredRequest.siteID)) {
      throw new AppAuthError(
        Constants.ACTION_UPDATE,
        Constants.ENTITY_SITE_AREA,
        filteredRequest.siteAreaID,
        Constants.HTTP_AUTH_ERROR,
        'ChargingStationService', 'handleAddChargingStationsToSiteArea',
        req.user);
    }
    // Get the Site Area
    const siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, filteredRequest.siteAreaID);
    if (!siteArea) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The Site Area with ID '${filteredRequest.siteAreaID}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'ChargingStationService', 'handleAddChargingStationsToSiteArea', req.user);
    }
    // Get Charging Stations
    for (const chargingStationID of filteredRequest.chargingStationIDs) {
      // Check the charging station
      const chargingStation = await ChargingStation.getChargingStation(req.user.tenantID, chargingStationID);
      if (!chargingStation) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Charging Station with ID '${chargingStationID}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
          'ChargingStationService', 'handleAddChargingStationsToSiteArea', req.user);
      }
      // Check auth
      if (!Authorizations.canUpdateSiteArea(req.user, siteArea.siteID)) {
        throw new AppAuthError(
          Constants.ACTION_UPDATE,
          Constants.ENTITY_CHARGING_STATION,
          chargingStationID,
          Constants.HTTP_AUTH_ERROR,
          'ChargingStationService', 'handleAddChargingStationsToSiteArea',
          req.user);
      }
    }
    // Save
    await ChargingStation.addChargingStationsToSiteArea(req.user.tenantID, filteredRequest.siteAreaID, filteredRequest.chargingStationIDs);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: 'ChargingStationService', method: 'handleAddChargingStationsToSiteArea',
      message: 'Site Area\'s Charging Stations have been added successfully', action: action
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  static async handleRemoveChargingStationsFromSiteArea(action, req, res, next) {
    // Filter
    const filteredRequest = ChargingStationSecurity.filterRemoveChargingStationsFromSiteAreaRequest(req.body, req.user);
    // Check Mandatory fields
    if (!filteredRequest.siteAreaID) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'The Site Area\'s ID must be provided', Constants.HTTP_GENERAL_ERROR,
        'ChargingStationService', 'handleRemoveChargingStationsFromSiteArea', req.user);
    }
    if (!filteredRequest.chargingStationIDs || (filteredRequest.chargingStationIDs && filteredRequest.chargingStationIDs.length <= 0)) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'The Site Area\'s IDs must be provided', Constants.HTTP_GENERAL_ERROR,
        'ChargingStationService', 'handleRemoveChargingStationsFromSiteArea', req.user);
    }
    // Check auth
    if (!Authorizations.canUpdateSiteArea(req.user, filteredRequest.siteID)) {
      throw new AppAuthError(
        Constants.ACTION_UPDATE,
        Constants.ENTITY_SITE_AREA,
        filteredRequest.siteAreaID,
        Constants.HTTP_AUTH_ERROR,
        'ChargingStationService', 'handleRemoveChargingStationsFromSiteArea',
        req.user);
    }
    // Get the Site Area
    const siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, filteredRequest.siteAreaID);
    if (!siteArea) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The Site Area with ID '${filteredRequest.siteAreaID}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'ChargingStationService', 'handleRemoveChargingStationsFromSiteArea', req.user);
    }
    // Get Charging Stations
    for (const chargingStationID of filteredRequest.chargingStationIDs) {
      // Check the Charging Station
      const chargingStation = await ChargingStation.getChargingStation(req.user.tenantID, chargingStationID);
      if (!chargingStation) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Charging Station with ID '${chargingStationID}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
          'ChargingStationService', 'handleRemoveChargingStationsFromSiteArea', req.user);
      }
      // Check auth
      if (!Authorizations.canUpdateChargingStation(req.user, siteArea.siteID)) {
        throw new AppAuthError(
          Constants.ACTION_UPDATE,
          Constants.ENTITY_CHARGING_STATION,
          chargingStationID,
          Constants.HTTP_AUTH_ERROR,
          'ChargingStationService', 'handleRemoveChargingStationsFromSiteArea',
          req.user);
      }
    }
    // Save
    await ChargingStation.removeChargingStationsFromSiteArea(req.user.tenantID, filteredRequest.siteAreaID, filteredRequest.chargingStationIDs);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: 'ChargingStationService', method: 'handleRemoveChargingStationsFromSiteArea',
      message: 'Site Area\'s Charging Stations have been removed successfully', action: action
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  static async handleUpdateChargingStationParams(action, req, res, next) {
    // Filter
    const filteredRequest = ChargingStationSecurity.filterChargingStationParamsUpdateRequest(req.body, req.user);
    // Check email
    const chargingStation = await ChargingStation.getChargingStation(req.user.tenantID, filteredRequest.id);
    if (!chargingStation) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The Charging Station with ID '${filteredRequest.id}' does not exist`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'ChargingStationService', 'handleUpdateChargingStationParams', req.user);
    }

    const siteArea = await chargingStation.getSiteArea();
    // Check Auth
    if (!Authorizations.canUpdateChargingStation(req.user, siteArea ? siteArea.siteID : null)) {
      throw new AppAuthError(
        Constants.ACTION_UPDATE, Constants.ENTITY_CHARGING_STATION,
        chargingStation.id, Constants.HTTP_AUTH_ERROR,
        'ChargingStationService', 'handleUpdateChargingStationParams',
        req.user);
    }
    // Update URL
    if (filteredRequest.chargingStationURL) {
      chargingStation.setChargingStationURL(filteredRequest.chargingStationURL);
    }
    // Update Nb Phase
    if (filteredRequest.hasOwnProperty('numberOfConnectedPhase')) {
      chargingStation.setNumberOfConnectedPhase(filteredRequest.numberOfConnectedPhase);
    }
    // Update Power Max
    if (filteredRequest.hasOwnProperty('maximumPower')) {
      chargingStation.setMaximumPower(parseInt(filteredRequest.maximumPower));
    }
    // Update Cannot Charge in Parallel
    if (filteredRequest.hasOwnProperty('cannotChargeInParallel')) {
      chargingStation.setCannotChargeInParallel(filteredRequest.cannotChargeInParallel);
    }
    // Update Site Area
    if (filteredRequest.hasOwnProperty('siteArea')) {
      chargingStation.setSiteArea(await SiteAreaStorage.getSiteArea(req.user.tenantID, filteredRequest.siteArea.id));
    }
    // Update Site Area
    if (filteredRequest.hasOwnProperty('powerLimitUnit')) {
      chargingStation.setPowerLimitUnit(filteredRequest.powerLimitUnit);
    }
    // Update Latitude
    if (filteredRequest.hasOwnProperty('latitude')) {
      chargingStation.setLatitude(filteredRequest.latitude);
    }
    // Update Longitude
    if (filteredRequest.hasOwnProperty('longitude')) {
      chargingStation.setLongitude(filteredRequest.longitude);
    }
    // Update Connectors
    if (filteredRequest.connectors) {
      const chargerConnectors = chargingStation.getConnectors();
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
    chargingStation.setLastChangedBy({ 'id': req.user.id });
    chargingStation.setLastChangedOn(new Date());
    // Update
    const updatedChargingStation = await chargingStation.save();
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      source: updatedchargingStation.id,
      user: req.user, module: 'ChargingStationService',
      method: 'handleUpdateChargingStationParams',
      message: 'Parameters have been updated successfully',
      action: action, detailedMessages: {
        'numberOfConnectedPhase': updatedChargingStation.getNumberOfConnectedPhase(),
        'chargingStationURL': updatedChargingStation.getChargingStationURL()
      }
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  static async handleGetChargingStationConfiguration(action, req, res, next) {
    // Filter
    const filteredRequest = ChargingStationSecurity.filterChargingStationConfigurationRequest(req.query, req.user);
    // Charge Box is mandatory
    if (!filteredRequest.ChargeBoxID) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'The Charging Station ID is mandatory', Constants.HTTP_GENERAL_ERROR,
        'ChargingStationService', 'handleGetChargingStationConfiguration', req.user);
    }
    // Get the Charging Station`
    const chargingStation = await ChargingStation.getChargingStation(req.user.tenantID, filteredRequest.ChargeBoxID);
    // Found?
    if (!chargingStation) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Charging Station with ID '${filteredRequest.ChargeBoxID}' does not exist`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'ChargingStationService', 'handleGetChargingStationConfiguration', req.user);
    }
    // Check auth
    if (!Authorizations.canReadChargingStation(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_READ, Constants.ENTITY_CHARGING_STATION,
        chargingStation.id, Constants.HTTP_AUTH_ERROR,
        'ChargingStationService', 'handleGetChargingStationConfiguration',
        req.user);
    }
    // Get the Config
    const configuration = await chargingStation.getConfiguration();
    // Return the result
    res.json(configuration);
    next();
  }

  public static async handleRequestChargingStationConfiguration(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationSecurity.filterChargingStationConfigurationRequest(req.query);
    // Charge Box is mandatory
    if (!filteredRequest.ChargeBoxID) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'The Charging Station ID is mandatory', Constants.HTTP_GENERAL_ERROR,
        'ChargingStationService', 'handleRequestChargingStationConfiguration', req.user);
    }
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
    if (!chargingStation) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Charging Station with ID '${filteredRequest.ChargeBoxID}' does not exist`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'ChargingStationService', 'handleRequestChargingStationConfiguration', req.user);
    }
    // Get the Config
    const result = await chargingStation.requestAndSaveConfiguration();
    // Ok
    res.json(result);
    next();
  }

  public static async handleDeleteChargingStation(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationSecurity.filterChargingStationRequest(req.query);
    // Check Mandatory fields
    if (!filteredRequest.ID) {
      // Not Found!
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'The Charging Station ID is mandatory', Constants.HTTP_GENERAL_ERROR,
        'ChargingStationService', 'handleDeleteChargingStation', req.user);
    }
    // Check auth
    if (!Authorizations.canDeleteChargingStation(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_DELETE,
        Constants.ENTITY_CHARGING_STATION,
        filteredRequest.ID, Constants.HTTP_AUTH_ERROR,
        'ChargingStationService', 'handleDeleteChargingStation',
        req.user);
    }
    // Get
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, filteredRequest.ID);
    // Found?
    if (!chargingStation) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Charging Station with ID '${filteredRequest.ID}' does not exist`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'ChargingStationService', 'handleDeleteChargingStation', req.user);
    }
    // Deleted
    if (chargingStation.deleted) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `User with ID '${filteredRequest.ID}' is already deleted`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'UserService', 'handleDeleteUser', req.user);
    }
    // Check no active transaction
    const foundIndex = chargingStation.connectors.findIndex((connector) =>
      (connector ? connector.activeTransactionID > 0 : false));
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
      { chargeBoxID: chargingStation.id }, Constants.DB_PARAMS_COUNT_ONLY);
    if(transactions.count > 0) {
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
    // Charge Box is mandatory
    if (!filteredRequest.ID) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'The Charging Station ID is mandatory', Constants.HTTP_GENERAL_ERROR,
        'ChargingStationService', 'handleGetChargingStation', req.user);
    }
    // Check auth
    if(!Authorizations.canReadChargingStation(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_READ,
        Constants.ENTITY_CHARGING_STATION,
        filteredRequest.ID, Constants.HTTP_AUTH_ERROR, 'ChargingStationService',
        'handleGetChargingStation', req.user);
    }
    // Query charging station
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, filteredRequest.ID);
    // Found?
    if (!chargingStation) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Charging Station '${filteredRequest.ID}' does not exist`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'ChargingStationService', 'handleGetChargingStation', req.user);
    }
    // Deleted?
    if(chargingStation.deleted) {
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

  private static async _getChargingStations(req: Request): Promise<{count: number, result: ChargingStation[]}> {
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
      await UtilsService.assertComponentIsActive(req.user.tenantID,
        Constants.COMPONENTS.ORGANIZATION, Constants.ACTION_READ, Constants.ENTITY_USER, 'UserService', 'handleGetUsers');
    }
    // Get Charging Stations
    const chargingStations = await ChargingStationStorage.getChargingStations(req.user.tenantID,
      {
        search: filteredRequest.Search,
        withNoSiteArea: filteredRequest.WithNoSiteArea,
        withSite: filteredRequest.WithSite,
        siteIDs: (filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : Authorizations.getAuthorizedSiteIDs(req.user)),
        chargeBoxID: filteredRequest.ChargeBoxID,
        siteAreaID: filteredRequest.SiteAreaID,
        includeDeleted: filteredRequest.IncludeDeleted,
        errorType: filteredRequest.ErrorType
      },
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort, onlyRecordCount: filteredRequest.OnlyRecordCount }
    );
    // Build the result
    if (chargingStations.result && chargingStations.result.length > 0) {
      // Filter
      ChargingStationSecurity.filterChargingStationsResponse(chargingStations, req.user, req.user.activeComponents.includes(Constants.COMPONENTS.ORGANIZATION));
    }
    return chargingStations;
  }

  public static async handleGetChargingStationsExport(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    const result = await ChargingStationService._getChargingStations(req);
    const filename = 'chargingStations_export.csv';
    fs.writeFile(filename, ChargingStationService.convertToCSV(result.result), (err) => {
      if (err) {
        throw err;
      }
      res.download(filename, (err) => {
        if (err) {
          throw err;
        }
        fs.unlink(filename, (err) => {
          if (err) {
            throw err;
          }
        });
      });
    });
  }

  public static async handleGetChargingStationsInError(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    if(! req.query.ErrorType) {
      req.query.ErrorType = 'all';
    }
    ChargingStationService.handleGetChargingStations(action, req, res, next);
  }

  static async handleGetStatusNotifications(action, req, res, next) {
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
    const filteredRequest = ChargingStationSecurity.filterStatusNotificationsRequest(req.query, req.user);
    // Get all Status Notifications
    const statusNotifications = await OCPPStorage.getStatusNotifications(req.user.tenantID, {},
      filteredRequest.Limit, filteredRequest.Skip, filteredRequest.Sort);
    // Set
    statusNotifications.result = ChargingStationSecurity.filterStatusNotificationsResponse(statusNotifications.result, req.user);
    // Return
    res.json(statusNotifications);
    next();
  }

  static async handleGetBootNotifications(action, req, res, next) {
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
    const filteredRequest = ChargingStationSecurity.filterBootNotificationsRequest(req.query, req.user);
    // Get all Status Notifications
    const bootNotifications = await OCPPStorage.getBootNotifications(req.user.tenantID, {},
      filteredRequest.Limit, filteredRequest.Skip, filteredRequest.Sort);
    // Set
    bootNotifications.result = ChargingStationSecurity.filterBootNotificationsResponse(bootNotifications.result, req.user);
    // Return
    res.json(bootNotifications);
    next();
  }

  static async handleAction(action, req, res, next) {
    // Filter
    const filteredRequest = ChargingStationSecurity.filterChargingStationActionRequest(req.body, action, req.user);
    // Charge Box is mandatory
    if (!filteredRequest.chargeBoxID) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'Charging Station ID is mandatory', Constants.HTTP_GENERAL_ERROR,
        'ChargingStationService', 'handleAction', req.user, null, action);
    }
    // Get the Charging station
    const chargingStation = await ChargingStation.getChargingStation(req.user.tenantID, filteredRequest.chargeBoxID);
    if (!chargingStation) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Charging Station with ID '${filteredRequest.chargeBoxID}' does not exist`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'ChargingStationService', 'handleAction', req.user);
    }
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
      if (!transaction) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Transaction ID '${filteredRequest.args.transactionId}' does not exist`, Constants.HTTP_AUTH_ERROR,
          'ChargingStationService', 'handleAction', req.user, null, action);
      }
      // Add connector ID
      filteredRequest.args.connectorId = transaction.getConnectorId();
      // Check Tag ID
      if (!req.user.tagIDs || req.user.tagIDs.length === 0) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          'The user does not have any badge',
          Constants.HTTP_USER_NO_BADGE_ERROR,
          'ChargingStationService', 'handleAction', req.user, null, action);
      }

      // Check if user is authorized
      await Authorizations.isTagIDsAuthorizedOnChargingStation(req.user.tenantID, chargingStation, req.user.tagIDs[0], transaction.getTagID(), action);
      // Set the tag ID to handle the Stop Transaction afterwards
      transaction.setRemoteStopDate(new Date().toISOString());
      transaction.setRemoteStopTagID(req.user.tagIDs[0]);
      // Save Transaction
      await TransactionStorage.saveTransaction(transaction.getTenantID(), transaction.getModel());
      // Ok: Execute it
      result = await chargingStation.handleAction(action, filteredRequest.args);
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
      await Authorizations.isTagIDAuthorizedOnChargingStation(req.user.tenantID, chargingStation, filteredRequest.args.tagID, action);
      // Ok: Execute it
      result = await chargingStation.handleAction(action, filteredRequest.args);
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
        result = await chargingStation.handleAction(action, filteredRequest.args);
        if (result.status !== Constants.OCPP_RESPONSE_ACCEPTED) {
          result = [];
          // Call each connectors
          for (const connector of chargingStation.getConnectors()) {
            filteredRequest.args.connectorId = connector.connectorId;
            // Execute request
            const simpleResult = await chargingStation.handleAction(action, filteredRequest.args);
            // Fix central reference date
            const centralTime = new Date();
            simpleResult.centralSystemTime = centralTime;
            result.push(simpleResult);
          }
        }
      } else {
        // Execute it
        result = await chargingStation.handleAction(action, filteredRequest.args);
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
      result = await chargingStation.handleAction(action, filteredRequest.args);
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
    if (!filteredRequest.chargeBoxID) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'The Charging Station ID is mandatory', Constants.HTTP_GENERAL_ERROR,
        'ChargingStationService', 'handleActionSetMaxIntensitySocket', req.user);
    }
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
    // Found?
    if (!chargingStation) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Charging Station with ID '${filteredRequest.chargeBoxID}' does not exist`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'ChargingStationService', 'handleActionSetMaxIntensitySocket', req.user);
    }
    // Get the Config
    const chargerConfiguration = await ChargingStationStorage.getConfiguration(req.user.tenantID, chargingStation.id);
    if (!chargerConfiguration) {
      throw new AppError(
        chargingStation.id,
        'Cannot retrieve the configuration', Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'ChargingStationService', 'handleActionSetMaxIntensitySocket', req.user);
    }
    let maxIntensitySocketMax = null;
    // Fill current params
    for (let i = 0; i < chargerConfiguration.configuration.length; i++) {
      // Max Intensity?
      if (chargerConfiguration.configuration[i].key.startsWith('currentpb')) {
        maxIntensitySocketMax = Number(chargerConfiguration.configuration[i].value);
      }
    }
    if (!maxIntensitySocketMax) {
      throw new AppError(
        chargingStation.id,
        'Cannot retrieve the max intensity socket from the configuration', Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'ChargingStationService', 'handleActionSetMaxIntensitySocket', req.user);
    }
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
      const result = await ChargingStationService.requestExecuteCommand(req.user.tenantID, chargingStation, 'changeConfiguration', {key: 'maxintensitysocket', value: filteredRequest.maxIntensity});
      // Request the new Configuration?
      if (result.status !== 'Accepted') {
        // Error
        throw new BackendError(chargingStation.id, `Cannot set the configuration param ${'maxintensitysocket'} with value ${filteredRequest.maxIntensity} to ${chargingStation.id}`,
          'ChargingStationService', 'handleActionSetSocketMaxIntensity');
      }
      // Retrieve and Save it in the DB
    await this.requestAndSaveConfiguration();

      result = await chargingStation.requestChangeConfiguration({
        key: 'maxintensitysocket',
        value: filteredRequest.maxIntensity
      });
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

  public static convertToCSV(chargingStations: ChargingStation[]): string {
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


  // TODO: Please review. Previously on ChargingStation.ts. Service a good new home?
  // Access modifier public because it is used by OCPP etc as well most likely.
  public static async getClient(tenantID: string, chargingStation: ChargingStation): Promise<ChargingStationClient> {
    if(! chargingStation.client) {
      chargingStation.client = await buildChargingStationClient(tenantID, chargingStation);
    }
    return chargingStation.client;
  }

  public static async requestExecuteCommand(tenantID: string, chargingStation: ChargingStation, method, params?) {
    try {
      // Get the client
      const chargingStationClient = await ChargingStationService.getClient(tenantID, chargingStation);
      // Set Charging Profile
      const result = await chargingStationClient[method](params);
      // Log
      Logging.logInfo({
        tenantID: tenantID, source: chargingStation.id,
        module: 'ChargingStation', method: '_requestExecuteCommand',
        action: Utils.firstLetterInUpperCase(method),
        message: 'Command sent with success',
        detailedMessages: result
      });
      // Return
      return result;
    } catch (error) {
      // OCPP 1.6?
      if (Array.isArray(error.error)) {
        const response = error.error;
        throw new BackendError(chargingStation.id, response[3], 'ChargingStationService',
          'requestExecuteCommand', Utils.firstLetterInUpperCase(method));
      } else {
        throw error;
      }
    }
  }

  public static async requestAndSaveConfiguration(tenantID: string, chargingStation: ChargingStation) {
    let configuration = null;
    try {
      // In case of error. the boot should no be denied
      configuration = await ChargingStationService.requestExecuteCommand(tenantID, chargingStation, 'getConfiguration', {});
      // Log
      Logging.logInfo({
        tenantID: tenantID, source: chargingStation.id, module: 'ChargingStationService',
        method: 'requestAndSaveConfiguration', action: 'RequestConfiguration',
        message: 'Command sent with success', detailedMessages: configuration
      });
      // Override with Conf
      configuration = {
        'configuration': configuration.configurationKey
      };
      // Set default?
      if (!configuration) {
        // Check if there is an already existing config
        const existingConfiguration = await ChargingStationStorage.getConfiguration(tenantID, chargingStation.id);
        if (!existingConfiguration) {
          // No config at all: Set default OCCP configuration
          configuration = OCPPConstants.DEFAULT_OCPP_CONFIGURATION;
        } else {
          // Set default
          configuration = existingConfiguration;
        }
      }
      // Set the charger ID
      configuration.chargeBoxID = chargingStation.id;
      configuration.timestamp = new Date();
      // Save config
      await OCPPStorage.saveConfiguration(tenantID, configuration);
      // Update connector power
      await OCPPUtils.updateConnectorsPower(this);
      // Ok
      Logging.logInfo({
        tenantID: tenantID, source: chargingStation.id, module: 'ChargingStation',
        method: 'requestAndSaveConfiguration', action: 'RequestConfiguration',
        message: 'Configuration has been saved'
      });
      return { status: 'Accepted' };
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, 'RequestConfiguration', error);
      return { status: 'Rejected' };
    }
  }
}
