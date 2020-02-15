import fs from 'fs';
import moment from 'moment';
import { GridFSBucket, GridFSBucketReadStream } from 'mongodb';
import BackendError from '../../exception/BackendError';
import UtilsService from '../../server/rest/service/UtilsService';
import { ChargingProfile } from '../../types/ChargingProfile';
import ChargingStation, { ChargingStationConfiguration, ChargingStationTemplate, Connector } from '../../types/ChargingStation';
import DbParams from '../../types/database/DbParams';
import { DataResult } from '../../types/DataResult';
import global from '../../types/GlobalType';
import { ChargingStationInError, ChargingStationInErrorType } from '../../types/InError';
import { ChargePointStatus } from '../../types/ocpp/OCPPServer';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import DatabaseUtils from './DatabaseUtils';
import TenantStorage from './TenantStorage';
export default class ChargingStationStorage {

  public static async updateChargingStationTemplatesFromFile() {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'updateChargingStationTemplatesFromFile');
    // Read File
    const chargingStationTemplates =
      JSON.parse(fs.readFileSync(`${global.appRoot}/assets/templates/charging-stations.json`, 'utf8'));
    // Update Templates
    for (const chargingStationTemplate of chargingStationTemplates) {
      try {
        // Save
        await ChargingStationStorage.saveChargingStationTemplate(chargingStationTemplate);
      } catch (error) {
        Logging.logActionExceptionMessage(Constants.DEFAULT_TENANT, 'UpdateChargingStationTemplatesFromFile', error);
      }
    }
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'updateChargingStationTemplatesFromFile', uniqueTimerID);
  }

  public static async getChargingStationTemplates(chargePointVendor?: string): Promise<ChargingStationTemplate[]> {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'getChargingStationTemplates');
    // Create Aggregation
    const aggregation = [];
    // Add in aggregation
    if (chargePointVendor) {
      aggregation.push({
        $match: {
          chargePointVendor
        }
      });
    }
    // Change ID
    DatabaseUtils.renameDatabaseID(aggregation);
    // Query Templates
    const chargingStationTemplatesMDB =
      await global.database.getCollection(Constants.DEFAULT_TENANT, 'chargingstationtemplates')
        .aggregate(aggregation).toArray();
    // Transfer
    const chargingStationTemplates = [];
    for (const chargingStationTemplateMDB of chargingStationTemplatesMDB) {
      chargingStationTemplates.push(chargingStationTemplateMDB);
    }
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'getChargingStationTemplates', uniqueTimerID, { chargePointVendor });
    return chargingStationTemplates;
  }

  public static async saveChargingStationTemplate(chargingStationTemplate: ChargingStationTemplate): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'saveChargingStationTemplate');
    // Modify and return the modified document
    await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'chargingstationtemplates').findOneAndReplace(
      { '_id': chargingStationTemplate.id },
      chargingStationTemplate,
      { upsert: true });
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'saveChargingStationTemplate', uniqueTimerID);
  }

  public static async getChargingStation(tenantID: string, id: string): Promise<ChargingStation> {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'getChargingStation');
    // Query single Charging Station
    const chargingStationsMDB = await ChargingStationStorage.getChargingStations(tenantID,
      { chargingStationID: id, withSite: true }, Constants.DB_PARAMS_SINGLE_RECORD);
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'getChargingStation', uniqueTimerID, { id });
    return chargingStationsMDB.result[0];
  }

  public static async getChargingStations(tenantID: string,
    params: {
      search?: string; chargingStationID?: string; siteAreaID?: string[]; withNoSiteArea?: boolean; status?: ChargePointStatus;
      siteIDs?: string[]; withSite?: boolean; includeDeleted?: boolean; offlineSince?: Date; issuer?: boolean;
    },
    dbParams: DbParams, projectFields?: string[]): Promise<DataResult<ChargingStation>> {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'getChargingStations');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Create Aggregation
    const aggregation = [];
    // Set the filters
    const filters: any = {
      $and: [{
        $or: DatabaseUtils.getNotDeletedFilter()
      }]
    };
    // Filter
    if (params.chargingStationID) {
      filters.$and.push({
        _id: params.chargingStationID
      });
      // Search filters
    } else if (params.search) {
      filters.$and.push({
        '$or': [
          { '_id': { $regex: params.search, $options: 'i' } },
          { 'chargePointModel': { $regex: params.search, $options: 'i' } },
          { 'chargePointVendor': { $regex: params.search, $options: 'i' } }
        ]
      });
    }
    // Filter on last heart beat
    if (params.offlineSince && moment(params.offlineSince).isValid()) {
      filters.$and.push({ 'lastHeartBeat': { $lte: params.offlineSince } });
    }
    if (Utils.hasOwnProperty(params, 'issuer')) {
      filters.$and.push({ 'issuer': params.issuer });
    }
    // Add Charging Station inactive flag
    DatabaseUtils.addChargingStationInactiveFlag(aggregation);
    // Add in aggregation
    aggregation.push({
      $match: filters
    });
    // Include deleted charging stations if requested
    if (params.includeDeleted) {
      filters.$and[0].$or.push({
        'deleted': true
      });
    }
    // With Status
    if (params.status) {
      filters.$and.push({
        'connectors.status': params.status,
        'inactive': false
      });
    }
    // With no Site Area
    if (params.withNoSiteArea) {
      filters.$and.push({
        'siteAreaID': null
      });
    } else {
      // Query by siteAreaID
      if (params.siteAreaID && Array.isArray(params.siteAreaID)) {
        filters.$and.push({
          'siteAreaID': { $in: params.siteAreaID.map((id) => Utils.convertToObjectID(id)) }
        });
      }
      // Site Area
      DatabaseUtils.pushSiteAreaLookupInAggregation({
        tenantID, aggregation: aggregation, localField: 'siteAreaID', foreignField: '_id',
        asField: 'siteArea', oneToOneCardinality: true, objectIDFields: ['createdBy', 'lastChangedBy']
      });
    }
    // Check Site ID
    if (params.siteIDs && Array.isArray(params.siteIDs)) {
      // If sites but no site area, no results can be found - return early.
      if (params.withNoSiteArea) {
        return { count: 0, result: [] };
      }
      // Build filter
      aggregation.push({
        $match: {
          'siteArea.siteID': {
            $in: params.siteIDs.map((id) => Utils.convertToObjectID(id))
          }
        }
      });
    }
    // Site
    if (params.withSite && !params.withNoSiteArea) {
      DatabaseUtils.pushSiteLookupInAggregation(
        {
          tenantID, aggregation: aggregation, localField: 'siteArea.siteID', foreignField: '_id',
          asField: 'siteArea.site', oneToOneCardinality: true
        });
    }
    // Convert siteID back to string after having queried the site
    DatabaseUtils.convertObjectIDToString(aggregation, 'siteArea.siteID');
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const chargingStationsCountMDB = await global.database.getCollection<any>(tenantID, 'chargingstations')
      .aggregate([...aggregation, { $count: 'count' }])
      .toArray();
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      // Return only the count
      return {
        count: (chargingStationsCountMDB.length > 0 ? chargingStationsCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);
    // Convert Object ID to string
    DatabaseUtils.convertObjectIDToString(aggregation, 'siteAreaID');
    // Sort
    if (dbParams.sort) {
      aggregation.push({
        $sort: dbParams.sort
      });
    } else {
      aggregation.push({
        $sort: {
          _id: 1
        }
      });
    }
    // Skip
    aggregation.push({
      $skip: dbParams.skip
    });
    // Limit
    aggregation.push({
      $limit: dbParams.limit
    });
    // Change ID
    DatabaseUtils.renameDatabaseID(aggregation);
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const chargingStationsMDB = await global.database.getCollection<ChargingStation>(tenantID, 'chargingstations')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 } })
      .toArray();
    // Add clean connectors in case of corrupted DB
    this.cleanAndUpdateConnectors(chargingStationsMDB);
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'getChargingStations', uniqueTimerID);
    // Ok
    return {
      count: (chargingStationsCountMDB.length > 0 ?
        (chargingStationsCountMDB[0].count === Constants.DB_RECORD_COUNT_CEIL ? -1 : chargingStationsCountMDB[0].count) : 0),
      result: chargingStationsMDB
    };
  }

  public static async getChargingStationsByConnectorStatus(tenantID: string,
    params: { statusChangedBefore?: Date; connectorStatus: string }): Promise<DataResult<ChargingStation>> {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'getChargingStationsPreparingSince');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Create Aggregation
    const aggregation = [];
    // Create filters
    const filters: any = { $and: [{ $or: DatabaseUtils.getNotDeletedFilter() }] };
    // Add Charging Station inactive flag
    DatabaseUtils.addChargingStationInactiveFlag(aggregation);
    // Filter on status preparing
    filters.$and.push({ 'connectors.status': params.connectorStatus });
    // Date before provided
    if (params.statusChangedBefore && moment(params.statusChangedBefore).isValid()) {
      filters.$and.push({ 'connectors.statusLastChangedOn': { $lte: params.statusChangedBefore } });
    }
    // Add in aggregation
    aggregation.push({ $match: filters });
    // Build lookups to fetch sites from chargers
    aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenantID, 'siteareas'),
        localField: 'siteAreaID',
        foreignField: '_id',
        as: 'siteArea'
      }
    });
    // Single Record
    aggregation.push({
      $unwind: { 'path': '$siteArea', 'preserveNullAndEmptyArrays': true }
    });
    // Change ID
    DatabaseUtils.renameDatabaseID(aggregation);
    // Read DB
    const chargingStations = await global.database.getCollection<ChargingStation>(tenantID, 'chargingstations')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 } })
      .toArray();
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'getChargingStationsPreparingSince', uniqueTimerID);
    return {
      count: chargingStations.length,
      result: chargingStations
    };
  }

  public static async getChargingStationsInError(tenantID: string,
    params: { search?: string; siteIDs?: string[]; siteAreaID: string[]; errorType?: string[] },
    dbParams: DbParams): Promise<DataResult<ChargingStationInError>> {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'getChargingStations');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Create Aggregation
    const aggregation = [];
    // Add Charging Station inactive flag
    DatabaseUtils.addChargingStationInactiveFlag(aggregation);
    // Set the filters
    const match: any = { '$and': [{ '$or': DatabaseUtils.getNotDeletedFilter() }] };
    if (params.siteAreaID && Array.isArray(params.siteAreaID) && params.siteAreaID.length > 0) {
      match.$and.push({
        'siteAreaID': { $in: params.siteAreaID.map((id) => Utils.convertToObjectID(id)) }
      });
    }
    // Search filters
    if (params.search) {
      match.$and.push({
        '$or': [
          { '_id': { $regex: params.search, $options: 'i' } },
          { 'chargePointModel': { $regex: params.search, $options: 'i' } },
          { 'chargePointVendor': { $regex: params.search, $options: 'i' } }
        ]
      });
    }
    aggregation.push({ $match: match });
    // Build lookups to fetch sites from chargers
    aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenantID, 'siteareas'),
        localField: 'siteAreaID',
        foreignField: '_id',
        as: 'sitearea'
      }
    });
    // Single Record
    aggregation.push({
      $unwind: { 'path': '$sitearea', 'preserveNullAndEmptyArrays': true }
    });
    // Check Site ID
    if (params.siteIDs && Array.isArray(params.siteIDs) && params.siteIDs.length > 0) {
      aggregation.push({
        $match: {
          'sitearea.siteID': {
            $in: params.siteIDs.map((id) => Utils.convertToObjectID(id))
          }
        }
      });
    }
    // Build facets for each type of error if any
    const facets: any = { $facet: {} };
    if (params.errorType && Array.isArray(params.errorType) && params.errorType.length > 0) {
      // Check allowed
      if (!Utils.isTenantComponentActive(await TenantStorage.getTenant(tenantID), Constants.COMPONENTS.ORGANIZATION) && params.errorType.includes(ChargingStationInErrorType.MISSING_SITE_AREA)) {
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: 'ChargingStationStorage',
          method: 'getChargingStationsInError',
          message: 'Organization is not active whereas filter is on missing site.'
        });
      }
      // Build facet only for one error type
      const array = [];
      params.errorType.forEach((type) => {
        array.push(`$${type}`);
        facets.$facet[type] = ChargingStationStorage.getChargerInErrorFacet(type);
      });
      aggregation.push(facets);
      // Manipulate the results to convert it to an array of document on root level
      aggregation.push({ $project: { chargersInError: { $setUnion: array } } });
      aggregation.push({ $unwind: '$chargersInError' });
      aggregation.push({ $replaceRoot: { newRoot: '$chargersInError' } });
      // Add a unique identifier as we may have the same Charging Station several time
      aggregation.push({ $addFields: { 'uniqueId': { $concat: ['$_id', '#', '$errorCode'] } } });
    }
    // Count Records
    const chargingStationsCountMDB = await global.database.getCollection<any>(tenantID, 'chargingstations')
      .aggregate([...aggregation, { $count: 'count' }])
      .toArray();
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      // Return only the count
      return {
        count: (chargingStationsCountMDB.length > 0 ? chargingStationsCountMDB[0].count : 0),
        result: []
      };
    }
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);
    // Sort
    if (dbParams.sort) {
      aggregation.push({
        $sort: dbParams.sort
      });
    } else {
      aggregation.push({
        $sort: {
          _id: 1
        }
      });
    }
    // Skip
    aggregation.push({
      $skip: dbParams.skip
    });
    // Limit
    aggregation.push({
      $limit: dbParams.limit
    });
    // Change ID
    DatabaseUtils.renameDatabaseID(aggregation);
    // Read DB
    const chargingStationsFacetMDB = await global.database.getCollection<ChargingStation>(tenantID, 'chargingstations')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 } })
      .toArray();
    // Add clean connectors in case of corrupted DB
    this.cleanAndUpdateConnectors(chargingStationsFacetMDB);
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'getChargingStations', uniqueTimerID);
    // Ok
    return {
      count: (chargingStationsCountMDB.length > 0 ?
        (chargingStationsCountMDB[0].count === Constants.DB_RECORD_COUNT_CEIL ? -1 : chargingStationsCountMDB[0].count) : 0),
      result: chargingStationsFacetMDB
    };
  }

  public static async saveChargingStation(tenantID: string, chargingStationToSave: ChargingStation): Promise<string> {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'saveChargingStation');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check if ID is provided
    UtilsService.assertIdIsProvided(chargingStationToSave.id, 'ChargingStationStorage', 'saveChargingStation', null);
    // Build Request
    const chargingStationFilter = {
      _id: chargingStationToSave.id
    };
    // Convert
    if (chargingStationToSave.connectors && Array.isArray(chargingStationToSave.connectors)) {
      for (const connector of chargingStationToSave.connectors) {
        if (connector) {
          connector.connectorId = Utils.convertToInt(connector.connectorId);
          connector.currentConsumption = Utils.convertToFloat(connector.currentConsumption);
          connector.totalInactivitySecs = Utils.convertToInt(connector.totalInactivitySecs);
          connector.totalConsumption = Utils.convertToFloat(connector.totalConsumption);
          connector.power = Utils.convertToInt(connector.power);
          connector.voltage = Utils.convertToInt(connector.voltage);
          connector.amperage = Utils.convertToInt(connector.amperage);
          connector.numberOfConnectedPhase = Utils.convertToInt(connector.numberOfConnectedPhase);
          connector.activeTransactionID = Utils.convertToInt(connector.activeTransactionID);
          connector.activeTransactionDate = Utils.convertToDate(connector.activeTransactionDate);
        }
      }
    }
    // Properties to save
    const chargingStationMDB = {
      _id: chargingStationToSave.id,
      issuer: chargingStationToSave.issuer,
      siteAreaID: Utils.convertToObjectID(chargingStationToSave.siteAreaID),
      chargePointSerialNumber: chargingStationToSave.chargePointSerialNumber,
      chargePointModel: chargingStationToSave.chargePointModel,
      chargeBoxSerialNumber: chargingStationToSave.chargeBoxSerialNumber,
      chargePointVendor: chargingStationToSave.chargePointVendor,
      iccid: chargingStationToSave.iccid,
      imsi: chargingStationToSave.imsi,
      meterType: chargingStationToSave.meterType,
      firmwareVersion: chargingStationToSave.firmwareVersion,
      meterSerialNumber: chargingStationToSave.meterSerialNumber,
      endpoint: chargingStationToSave.endpoint,
      ocppVersion: chargingStationToSave.ocppVersion,
      ocppProtocol: chargingStationToSave.ocppProtocol,
      cfApplicationIDAndInstanceIndex: chargingStationToSave.cfApplicationIDAndInstanceIndex,
      lastHeartBeat: chargingStationToSave.lastHeartBeat,
      deleted: chargingStationToSave.deleted,
      lastReboot: chargingStationToSave.lastReboot,
      chargingStationURL: chargingStationToSave.chargingStationURL,
      maximumPower: chargingStationToSave.maximumPower,
      cannotChargeInParallel: chargingStationToSave.cannotChargeInParallel,
      powerLimitUnit: chargingStationToSave.powerLimitUnit,
      coordinates: chargingStationToSave.coordinates,
      connectors: chargingStationToSave.connectors,
      currentType: chargingStationToSave.currentType,
      currentIPAddress: chargingStationToSave.currentIPAddress,
      capabilities: chargingStationToSave.capabilities,
      ocppAdvancedCommands: chargingStationToSave.ocppAdvancedCommands,
      ocppStandardParameters: chargingStationToSave.ocppStandardParameters,
      ocppVendorParameters: chargingStationToSave.ocppVendorParameters
    };
    if (!chargingStationMDB.connectors) {
      chargingStationMDB.connectors = [];
    }
    // Add Created/LastChanged By
    DatabaseUtils.addLastChangedCreatedProps(chargingStationMDB, chargingStationToSave);
    // Modify and return the modified document
    const result = await global.database.getCollection<any>(tenantID, 'chargingstations').findOneAndUpdate(
      chargingStationFilter,
      { $set: chargingStationMDB },
      { upsert: true });
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'saveChargingStation', uniqueTimerID);
    return chargingStationMDB._id;
  }

  public static async saveChargingStationConnector(tenantID: string, chargingStation: ChargingStation, connector: Connector): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'saveChargingStationConnector');
    // Ensure good typing
    if (connector) {
      connector.connectorId = Utils.convertToInt(connector.connectorId);
      connector.currentConsumption = Utils.convertToFloat(connector.currentConsumption);
      connector.totalInactivitySecs = Utils.convertToInt(connector.totalInactivitySecs);
      connector.totalConsumption = Utils.convertToFloat(connector.totalConsumption);
      connector.power = Utils.convertToInt(connector.power);
      connector.voltage = Utils.convertToInt(connector.voltage);
      connector.amperage = Utils.convertToInt(connector.amperage);
      connector.activeTransactionID = Utils.convertToInt(connector.activeTransactionID);
      connector.activeTransactionDate = Utils.convertToDate(connector.activeTransactionDate);
    }
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const updatedFields: any = {};
    updatedFields['connectors.' + (connector.connectorId - 1)] = connector;
    // Update model
    chargingStation.connectors[connector.connectorId - 1] = connector;
    // Modify and return the modified document
    const result = await global.database.getCollection<any>(tenantID, 'chargingstations').findOneAndUpdate(
      { '_id': chargingStation.id },
      { $set: updatedFields },
      { upsert: true });
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'saveChargingStationConnector', uniqueTimerID);
  }

  public static async saveChargingStationHeartBeat(tenantID: string, chargingStation: ChargingStation): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'saveChargingStationHeartBeat');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Set data
    const updatedFields: any = {};
    updatedFields['lastHeartBeat'] = Utils.convertToDate(chargingStation.lastHeartBeat);
    updatedFields['currentIPAddress'] = chargingStation.currentIPAddress;
    // Modify and return the modified document
    const result = await global.database.getCollection<any>(tenantID, 'chargingstations').findOneAndUpdate(
      { '_id': chargingStation.id },
      { $set: updatedFields },
      { upsert: true });
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'saveChargingStationHeartBeat', uniqueTimerID);
  }

  public static async deleteChargingStation(tenantID: string, id: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'deleteChargingStation');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Delete Configuration
    await global.database.getCollection<any>(tenantID, 'configurations')
      .findOneAndDelete({ '_id': id });
    // Delete Charging Station
    await global.database.getCollection<any>(tenantID, 'chargingstations')
      .findOneAndDelete({ '_id': id });
    // Keep the rest (bootnotif, authorize...)
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'deleteChargingStation', uniqueTimerID);
  }

  public static async getConfigurationParamValue(tenantID: string, chargeBoxID: string, paramName: string) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'getConfigurationParamValue');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Get the config
    const configuration = await ChargingStationStorage.getConfiguration(tenantID, chargeBoxID);
    let value = null;
    if (configuration) {
      // Get the value
      configuration.configuration.every((param) => {
        // Check
        if (param.key === paramName) {
          value = param.value;
          return false;
        }
        return true;
      });
    }
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'getConfigurationParamValue', uniqueTimerID);
    return value;
  }

  static async saveConfiguration(tenantID: string, configuration: ChargingStationConfiguration) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'saveConfiguration');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Modify
    await global.database.getCollection<any>(tenantID, 'configurations').findOneAndUpdate({
      '_id': configuration.id
    }, {
      $set: {
        configuration: configuration.configuration,
        timestamp: Utils.convertToDate(configuration.timestamp)
      }
    }, {
      upsert: true,
      returnOriginal: false
    });
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'saveConfiguration', uniqueTimerID);
  }

  public static async getConfiguration(tenantID: string, id: string): Promise<ChargingStationConfiguration> {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'getConfiguration');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const configurationsMDB = await global.database.getCollection<any>(tenantID, 'configurations')
      .findOne({
        '_id': id
      });
    // Found?
    let configuration = null;
    if (configurationsMDB && configurationsMDB.configuration && configurationsMDB.configuration.length > 0) {
      // Set values
      configuration = {
        id: configurationsMDB._id,
        timestamp: Utils.convertToDate(configurationsMDB.timestamp),
        configuration: configurationsMDB.configuration
      };
    }
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'getConfiguration', uniqueTimerID);
    return configuration;
  }

  public static async getChargingProfiles(tenantID: string,
      params: {
        chargingStationID?: string; connectorID?: number;
      } = {},
      dbParams: DbParams, projectFields?: string[]): Promise<DataResult<ChargingProfile[]>> {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'getChargingProfiles');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Query by chargingStationID
    const filters: any = {};
    if (params.chargingStationID) {
      filters.chargingStationID = params.chargingStationID;
    }
    if (params.connectorID) {
      filters.connectorID = params.connectorID;
    }
    // Create Aggregation
    const aggregation = [];
    // Filters
    if (filters) {
      aggregation.push({
        $match: filters
      });
    }
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const chargingProfilesCountMDB = await global.database.getCollection<any>(tenantID, 'chargingprofiles')
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      return {
        count: (chargingProfilesCountMDB.length > 0 ? chargingProfilesCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);
    // Rename ID
    DatabaseUtils.renameDatabaseID(aggregation);
    // Sort
    if (dbParams.sort) {
      aggregation.push({
        $sort: dbParams.sort
      });
    } else {
      aggregation.push({
        $sort: {
          identifier: 1
        }
      });
    }
    // Skip
    aggregation.push({
      $skip: dbParams.skip
    });
    // Limit
    aggregation.push({
      $limit: dbParams.limit
    });
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const chargingProfilesMDB = await global.database.getCollection<any>(tenantID, 'chargingprofiles')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 }, allowDiskUse: true })
      .toArray();
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'getChargingProfiles', uniqueTimerID, { params, dbParams });
    return {
      count: (chargingProfilesCountMDB.length > 0 ?
        (chargingProfilesCountMDB[0].count === Constants.DB_RECORD_COUNT_CEIL ? -1 : chargingProfilesCountMDB[0].count) : 0),
      result: chargingProfilesMDB
    };
  }

  public static async saveChargingProfile(tenantID: string, chargingProfile: ChargingProfile): Promise<void> {
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'saveChargingProfile');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const chargingProfileFilter = {
      chargingStationID: chargingProfile.chargingStationID
    };
    const chargingProfileMDB: ChargingProfile = chargingProfile;
    await global.database.getCollection<any>(tenantID, 'chargingprofiles').findOneAndUpdate(
      chargingProfileFilter,
      { $set: chargingProfileMDB },
      { upsert: true });
    Logging.traceEnd('ChargingStationStorage', 'saveChargingProfile', uniqueTimerID);
  }

  public static async deleteChargingProfile(tenantID: string, id: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'deleteChargingProfile');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Delete Charging Profile
    await global.database.getCollection<any>(tenantID, 'chargingprofiles')
      .findOneAndDelete({ 'chargingStationID': id });
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'deleteChargingProfile', uniqueTimerID);
  }

  public static getChargingStationFirmware(filename: string): GridFSBucketReadStream {
    // Get the bucket
    const bucket: GridFSBucket = global.database.getGridFSBucket('default.firmwares');
    // Get the file
    return bucket.openDownloadStreamByName(filename);
  }

  public static async removeChargingStationsFromSiteArea(tenantID: string, siteAreaID: string, chargingStationIDs: string[]): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'removeChargingStationsFromSiteArea');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Site provided?
    if (siteAreaID) {
      // At least one ChargingStation
      if (chargingStationIDs && chargingStationIDs.length > 0) {
        // Update all chargers
        await global.database.getCollection<any>(tenantID, 'chargingstations').updateMany({
          $and: [
            { '_id': { $in: chargingStationIDs } },
            { 'siteAreaID': Utils.convertToObjectID(siteAreaID) }
          ]
        }, {
          $set: { siteAreaID: null }
        }, {
          upsert: false
        });
      }
    }
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'removeChargingStationsFromSiteArea', uniqueTimerID, {
      siteAreaID,
      chargingStationIDs
    });
  }

  public static async addChargingStationsToSiteArea(tenantID: string, siteAreaID: string, chargingStationIDs: string[]): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'addChargingStationsToSiteArea');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Site provided?
    if (siteAreaID) {
      // At least one ChargingStation
      if (chargingStationIDs && chargingStationIDs.length > 0) {
        // Update all chargers
        await global.database.getCollection<any>(tenantID, 'chargingstations').updateMany({
          $and: [
            { '_id': { $in: chargingStationIDs } },
            { 'siteAreaID': null }
          ]
        }, {
          $set: { siteAreaID: Utils.convertToObjectID(siteAreaID) }
        }, {
          upsert: false
        });
      }
    }
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'addChargingStationsToSiteArea', uniqueTimerID, {
      siteAreaID,
      chargingStationIDs
    });
  }

  private static getChargerInErrorFacet(errorType: string) {
    switch (errorType) {
      case ChargingStationInErrorType.MISSING_SETTINGS:
        return [{
          $match: {
            $or: [
              { 'maximumPower': { $exists: false } }, { 'maximumPower': { $lte: 0 } }, { 'maximumPower': null },
              { 'chargePointModel': { $exists: false } }, { 'chargePointModel': { $eq: '' } },
              { 'chargePointVendor': { $exists: false } }, { 'chargePointVendor': { $eq: '' } },
              { 'numberOfConnectedPhase': { $exists: false } }, { 'numberOfConnectedPhase': null }, { 'numberOfConnectedPhase': { $nin: [0, 1, 3] } },
              { 'powerLimitUnit': { $exists: false } }, { 'powerLimitUnit': null }, { 'powerLimitUnit': { $nin: ['A', 'W'] } },
              { 'chargingStationURL': { $exists: false } }, { 'chargingStationURL': null }, { 'chargingStationURL': { $eq: '' } },
              { 'cannotChargeInParallel': { $exists: false } }, { 'cannotChargeInParallel': null },
              { 'connectors.type': { $exists: false } }, { 'connectors.type': null }, { 'connectors.type': { $eq: '' } },
              { 'connectors.power': { $exists: false } }, { 'connectors.power': null }, { 'connectors.power': { $lte: 0 } }
            ]
          }
        },
        { $addFields: { 'errorCode': ChargingStationInErrorType.MISSING_SETTINGS } }
        ];
      case ChargingStationInErrorType.CONNECTION_BROKEN: {
        const inactiveDate = new Date(new Date().getTime() - 3 * 60 * 1000);
        return [
          { $match: { 'lastHeartBeat': { $lte: inactiveDate } } },
          { $addFields: { 'errorCode': ChargingStationInErrorType.CONNECTION_BROKEN } }
        ];
      }
      case ChargingStationInErrorType.CONNECTOR_ERROR:
        return [
          { $match: { $or: [{ 'connectors.errorCode': { $ne: 'NoError' } }, { 'connectors.status': { $eq: 'Faulted' } }] } },
          { $addFields: { 'errorCode': ChargingStationInErrorType.CONNECTOR_ERROR } }
        ];
      case ChargingStationInErrorType.MISSING_SITE_AREA:
        return [
          { $match: { $or: [{ 'siteAreaID': { $exists: false } }, { 'siteAreaID': null }] } },
          { $addFields: { 'errorCode': ChargingStationInErrorType.MISSING_SITE_AREA } }
        ];
      default:
        return [];
    }
  }

  private static cleanAndUpdateConnectors(chargingStationsMDB: ChargingStation[]) {
    if (chargingStationsMDB.length > 0) {
      for (const chargingStationMDB of chargingStationsMDB) {
        if (!chargingStationMDB.connectors) {
          chargingStationMDB.connectors = [];
        // Clean broken connectors
        } else {
          const cleanedConnectors = [];
          for (const connector of chargingStationMDB.connectors) {
            if (connector) {
              cleanedConnectors.push(connector);
            }
          }
          chargingStationMDB.connectors = cleanedConnectors;
        }
      }
    }
  }
}
