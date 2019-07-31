import { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import Authorizations from '../../../authorization/Authorizations';
import ChargingStation from '../../../entity/ChargingStation';
import ChargingStationSecurity from './security/ChargingStationSecurity';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import OCPPStorage from '../../../storage/mongodb/OCPPStorage';
import SiteAreaStorage from '../../../storage/mongodb/SiteAreaStorage';
import TransactionStorage from '../../../storage/mongodb/TransactionStorage';
import Utils from '../../../utils/Utils';

export default class ChargingStationService {
  static async handleAddChargingStationsToSiteArea(action: string, req: Request, res: Response, next: NextFunction) {
    // Filter
    const filteredRequest = ChargingStationSecurity.filterAddChargingStationsToSiteAreaRequest(req.body, req.user);
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

  static async handleRemoveChargingStationsFromSiteArea(action: string, req: Request, res: Response, next: NextFunction) {
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

  static async handleUpdateChargingStationParams(action: string, req: Request, res: Response, next: NextFunction) {
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
        chargingStation.getID(), Constants.HTTP_AUTH_ERROR,
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
      source: updatedChargingStation.getID(),
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

  static async handleGetChargingStationConfiguration(action: string, req: Request, res: Response, next: NextFunction) {
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
        chargingStation.getID(), Constants.HTTP_AUTH_ERROR,
        'ChargingStationService', 'handleGetChargingStationConfiguration',
        req.user);
    }
    // Get the Config
    const configuration = await chargingStation.getConfiguration();
    // Return the result
    res.json(configuration);
    next();
  }

  static async handleRequestChargingStationConfiguration(action: string, req: Request, res: Response, next: NextFunction) {
    // Filter
    const filteredRequest = ChargingStationSecurity.filterChargingStationConfigurationRequest(req.query, req.user);
    // Charge Box is mandatory
    if (!filteredRequest.ChargeBoxID) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'The Charging Station ID is mandatory', Constants.HTTP_GENERAL_ERROR,
        'ChargingStationService', 'handleRequestChargingStationConfiguration', req.user);
    }
    // Get the Charging Station
    const chargingStation = await ChargingStation.getChargingStation(req.user.tenantID, filteredRequest.ChargeBoxID);
    // Found?
    if (!chargingStation) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Charging Station with ID '${filteredRequest.ChargeBoxID}' does not exist`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'ChargingStationService', 'handleRequestChargingStationConfiguration', req.user);
    }
    // Check auth
    if (!Authorizations.canReadChargingStation(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_READ,
        Constants.ENTITY_CHARGING_STATION,
        chargingStation.getID(), Constants.HTTP_AUTH_ERROR,
        'ChargingStationService', 'handleGetChargingStationConfiguration',
        req.user);
    }
    // Get the Config
    const result = await chargingStation.requestAndSaveConfiguration();
    // Ok
    res.json(result);
    next();
  }

  static async handleDeleteChargingStation(action: string, req: Request, res: Response, next: NextFunction) {
    // Filter
    const filteredRequest = ChargingStationSecurity.filterChargingStationDeleteRequest(req.query, req.user);
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
    const chargingStation = await ChargingStation.getChargingStation(req.user.tenantID, filteredRequest.ID);
    // Found?
    if (!chargingStation) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Charging Station with ID '${filteredRequest.ID}' does not exist`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'ChargingStationService', 'handleDeleteChargingStation', req.user);
    }
    // Check no active transaction
    const foundIndex = chargingStation.getConnectors().findIndex((connector) => {
      return (connector ? connector.activeTransactionID > 0 : false);
    });
    if (foundIndex >= 0) {
      // Can' t be deleted
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Charging station '${chargingStation.getID()}' can't be deleted due to existing active transactions`,
        Constants.HTTP_EXISTING_TRANSACTION_ERROR,
        'ChargingStationService', 'handleDeleteChargingStation', req.user);
    }
    // Remove Site Area
    chargingStation.setSiteArea(null);
    // Delete
    await chargingStation.delete();
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: 'ChargingStationService', method: 'handleDeleteChargingStation',
      message: `Charging Station '${chargingStation.getID()}' has been deleted successfully`,
      action: action, detailedMessages: chargingStation
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  static async handleGetChargingStation(action: string, req: Request, res: Response, next: NextFunction) {
    // Filter
    const filteredRequest = ChargingStationSecurity.filterChargingStationRequest(req.query, req.user);
    // Charge Box is mandatory
    if (!filteredRequest.ID) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'The Charging Station ID is mandatory', Constants.HTTP_GENERAL_ERROR,
        'ChargingStationService', 'handleGetChargingStation', req.user);
    }
    // Get it
    const chargingStation = await ChargingStation.getChargingStation(req.user.tenantID, filteredRequest.ID);
    // Found?
    if (!chargingStation) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Charging Station '${filteredRequest.ID}' does not exist`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'ChargingStationService', 'handleGetChargingStation', req.user);
    }
    // Return
    const tenant = await chargingStation.getTenant(); // pragma await TenantStorage.getTenant(chargingStation.getTenantID());
    res.json(
      // Filter
      ChargingStationSecurity.filterChargingStationResponse(
        chargingStation.getModel(), req.user, Utils.isComponentActiveFromToken(req.user, Constants.COMPONENTS.ORGANIZATION))
    );
    next();
  }

  static async handleGetChargingStations(action: string, req: Request, res: Response, next: NextFunction) {
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
    const filteredRequest = ChargingStationSecurity.filterChargingStationsRequest(req.query, req.user);
    // Get Charging Stations
    const chargingStations = await ChargingStation.getChargingStations(req.user.tenantID,
      {
        'search': filteredRequest.Search,
        'withNoSiteArea': filteredRequest.WithNoSiteArea,
        'withSite': filteredRequest.WithSite,
        'siteIDs': (filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : Authorizations.getAuthorizedSiteIDs(req.user)),
        'chargeBoxID': filteredRequest.ChargeBoxID,
        'siteAreaID': filteredRequest.SiteAreaID,
        'includeDeleted': filteredRequest.IncludeDeleted
      },
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort, onlyRecordCount: filteredRequest.OnlyRecordCount }
    );
    // Build the result
    if (chargingStations.result && chargingStations.result.length > 0) {
      // Get the Tenant
      const organizationIsActive = Utils.isComponentActiveFromToken(
        req.user, Constants.COMPONENTS.ORGANIZATION);
      // Convert to JSon
      chargingStations.result = chargingStations.result.map((chargingStation) => {
        return chargingStation.getModel();
      });
      // Filter
      ChargingStationSecurity.filterChargingStationsResponse(chargingStations, req.user, organizationIsActive);
    }
    // Return
    res.json(chargingStations);
    next();
  }

  static async handleGetChargingStationsExport(action: string, req: Request, res: Response, next: NextFunction) {
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
    const filteredRequest = ChargingStationSecurity.filterChargingStationsRequest(req.query, req.user);
    // Get the charging Charging Stations
    const chargingStations = await ChargingStation.getChargingStations(req.user.tenantID,
      {
        'search': filteredRequest.Search,
        'withNoSiteArea': filteredRequest.WithNoSiteArea,
        'withSite': filteredRequest.WithSite,
        'siteIDs': (filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : null),
        'chargeBoxID': filteredRequest.ChargeBoxID,
        'siteAreaID': filteredRequest.SiteAreaID,
      },
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort, onlyRecordCount: filteredRequest.OnlyRecordCount }
    );
    // Build the result
    if (chargingStations.result && chargingStations.result.length > 0) {
      // Check
      const organizationIsActive = Utils.isComponentActiveFromToken(req.user, Constants.COMPONENTS.ORGANIZATION);
      // Set
      chargingStations.result = chargingStations.result.map((chargingStation) => {
        return chargingStation.getModel();
      });
      // Filter
      ChargingStationSecurity.filterChargingStationsResponse(chargingStations, req.user, organizationIsActive);
    }

    const filename = 'chargingStations_export.csv';
    fs.writeFile(filename, ChargingStationService.convertToCSV(chargingStations.result), (err) => {
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

  static async handleGetChargingStationsInError(action: string, req: Request, res: Response, next: NextFunction) {
    // Check auth
    if (!Authorizations.canListChargingStations(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_LIST,
        Constants.ENTITY_CHARGING_STATIONS,
        null, Constants.HTTP_AUTH_ERROR,
        'ChargingStationService', 'handleGetChargingStationsInError',
        req.user);
    }
    // Filter
    const filteredRequest = ChargingStationSecurity.filterChargingStationsInErrorRequest(req.query, req.user);
    // Get Charging Stations in Error
    const chargingStations = await ChargingStation.getChargingStationsInError(req.user.tenantID,
      {
        'search': filteredRequest.Search,
        'withNoSiteArea': filteredRequest.WithNoSiteArea,
        'withSite': filteredRequest.WithSite,
        'siteIDs': filteredRequest.SiteID,
        'chargeBoxID': filteredRequest.ChargeBoxID,
        'siteAreaID': filteredRequest.SiteAreaID,
        'errorType': (filteredRequest.ErrorType ? filteredRequest.ErrorType.split('|') : null)
      },
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort, onlyRecordCount: filteredRequest.OnlyRecordCount }
    );
    // Build the result
    if (chargingStations.result && chargingStations.result.length > 0) {
      // Check
      const organizationIsActive = Utils.isComponentActiveFromToken(req.user, Constants.COMPONENTS.ORGANIZATION);
      // Set
      chargingStations.result = chargingStations.result.map((chargingStation) => {
        return chargingStation.getModel();
      });
      // Filter
      ChargingStationSecurity.filterChargingStationsResponse(chargingStations, req.user, organizationIsActive);
    }
    // Return
    res.json(chargingStations);
    next();
  }

  static async handleGetStatusNotifications(action: string, req: Request, res: Response, next: NextFunction) {
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

  static async handleGetBootNotifications(action: string, req: Request, res: Response, next: NextFunction) {
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

  static async handleAction(action: string, req: Request, res: Response, next: NextFunction) {
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
      await Authorizations.isTagIDsAuthorizedOnChargingStation(chargingStation, req.user.tagIDs[0], transaction.getTagID(), action);
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
      await Authorizations.isTagIDAuthorizedOnChargingStation(chargingStation, filteredRequest.args.tagID, action);
      // Ok: Execute it
      result = await chargingStation.handleAction(action, filteredRequest.args);
    } else if (action === 'GetCompositeSchedule') {
      // Check auth
      if (!Authorizations.canPerformActionOnChargingStation(req.user, action)) {
        throw new AppAuthError(action,
          Constants.ENTITY_CHARGING_STATION,
          chargingStation.getID(),
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
          chargingStation.getID(),
          Constants.HTTP_AUTH_ERROR, 'ChargingStationService', 'handleAction',
          req.user);
      }
      // Execute it
      result = await chargingStation.handleAction(action, filteredRequest.args);
    }
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      source: chargingStation.getID(), user: req.user, action: action,
      module: 'ChargingStationService', method: 'handleAction',
      message: `'${action}' has been executed successfully`,
      detailedMessages: result
    });
    // Return
    res.json(result);
    next();
  }

  static async handleActionSetMaxIntensitySocket(action: string, req: Request, res: Response, next: NextFunction) {
    // Filter
    const filteredRequest = ChargingStationSecurity.filterChargingStationSetMaxIntensitySocketRequest(req.body, req.user);
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
    const chargingStation = await ChargingStation.getChargingStation(req.user.tenantID, filteredRequest.chargeBoxID);
    // Found?
    if (!chargingStation) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Charging Station with ID '${filteredRequest.chargeBoxID}' does not exist`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'ChargingStationService', 'handleActionSetMaxIntensitySocket', req.user);
    }
    // Get the Config
    const chargerConfiguration = await chargingStation.getConfiguration();
    if (!chargerConfiguration) {
      throw new AppError(
        chargingStation.getID(),
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
        chargingStation.getID(),
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
        source: chargingStation.getID(),
        message: `Max Instensity Socket has been set to '${filteredRequest.maxIntensity}'`
      });
      // Change the config
      result = await chargingStation.requestChangeConfiguration({
        key: 'maxintensitysocket',
        value: filteredRequest.maxIntensity
      });
    } else {
      // Invalid value
      throw new AppError(
        chargingStation.getID(),
        `Invalid value for Max Intensity Socket: '${filteredRequest.maxIntensity}'`, Constants.HTTP_GENERAL_ERROR,
        'ChargingStationService', 'handleActionSetMaxIntensitySocket', req.user);
    }
    // Return the result
    res.json(result);
    next();
  }

  static convertToCSV(chargingStations) {
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
}
