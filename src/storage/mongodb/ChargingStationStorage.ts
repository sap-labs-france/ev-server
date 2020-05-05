import fs from 'fs';
import moment from 'moment';
import { GridFSBucket, GridFSBucketReadStream } from 'mongodb';
import BackendError from '../../exception/BackendError';
import { ChargingProfile, ChargingProfilePurposeType } from '../../types/ChargingProfile';
import ChargingStation, { ChargingStationCurrentType, ChargingStationOcppParameters, ChargingStationTemplate, Connector, ConnectorType, OcppParameter, PowerLimitUnits } from '../../types/ChargingStation';
import DbParams from '../../types/database/DbParams';
import { DataResult } from '../../types/DataResult';
import global from '../../types/GlobalType';
import { ChargingStationInError, ChargingStationInErrorType } from '../../types/InError';
import { OCPPFirmwareStatus } from '../../types/ocpp/OCPPServer';
import { ServerAction } from '../../types/Server';
import TenantComponents from '../../types/TenantComponents';
import Constants from '../../utils/Constants';
import Cypher from '../../utils/Cypher';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import DatabaseUtils from './DatabaseUtils';
import TenantStorage from './TenantStorage';

const MODULE_NAME = 'ChargingStationStorage';

export default class ChargingStationStorage {

  public static async updateChargingStationTemplatesFromFile() {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'updateChargingStationTemplatesFromFile');
    // Read File
    let chargingStationTemplates;
    try {
      chargingStationTemplates =
        JSON.parse(fs.readFileSync(`${global.appRoot}/assets/charging-station-templates/charging-stations.json`, 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw error;
      }
    }
    // Update Templates
    for (const chargingStationTemplate of chargingStationTemplates) {
      try {
        // Set the hash
        chargingStationTemplate.hash = Cypher.hash(JSON.stringify(chargingStationTemplate));
        // Save
        await ChargingStationStorage.saveChargingStationTemplate(chargingStationTemplate);
      } catch (error) {
        Logging.logActionExceptionMessage(Constants.DEFAULT_TENANT, ServerAction.UPDATE_CHARGING_STATION_TEMPLATES, error);
      }
    }
    // Debug
    Logging.traceEnd(MODULE_NAME, 'updateChargingStationTemplatesFromFile', uniqueTimerID);
  }

  public static async getChargingStationTemplates(chargePointVendor?: string): Promise<ChargingStationTemplate[]> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getChargingStationTemplates');
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
    DatabaseUtils.pushRenameDatabaseID(aggregation);
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
    Logging.traceEnd(MODULE_NAME, 'getChargingStationTemplates', uniqueTimerID, { chargePointVendor });
    return chargingStationTemplates;
  }

  public static async saveChargingStationTemplate(chargingStationTemplate: ChargingStationTemplate): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'saveChargingStationTemplate');
    // Modify and return the modified document
    await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'chargingstationtemplates').findOneAndReplace(
      { '_id': chargingStationTemplate.id },
      chargingStationTemplate,
      { upsert: true });
    // Debug
    Logging.traceEnd(MODULE_NAME, 'saveChargingStationTemplate', uniqueTimerID);
  }

  public static async getChargingStation(tenantID: string, id: string): Promise<ChargingStation> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getChargingStation');
    // Query single Charging Station
    const chargingStationsMDB = await ChargingStationStorage.getChargingStations(tenantID,
      { chargingStationID: id, withSite: true }, Constants.DB_PARAMS_SINGLE_RECORD);
    // Debug
    Logging.traceEnd(MODULE_NAME, 'getChargingStation', uniqueTimerID, { id });
    return chargingStationsMDB.result[0];
  }

  public static async getChargingStations(tenantID: string,
    params: {
      search?: string; chargingStationID?: string; siteAreaIDs?: string[]; withNoSiteArea?: boolean;
      connectorStatuses?: string[]; connectorTypes?: string[]; statusChangedBefore?: Date;
      siteIDs?: string[]; withSite?: boolean; includeDeleted?: boolean; offlineSince?: Date; issuer?: boolean;
    },
    dbParams: DbParams, projectFields?: string[]): Promise<DataResult<ChargingStation>> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getChargingStations');
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
    // Issuer
    if (params.issuer === true || params.issuer === false) {
      filters.$and.push({ 'issuer': params.issuer });
    }
    // Add Charging Station inactive flag
    DatabaseUtils.pushChargingStationInactiveFlag(aggregation);
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
    // Connector Status
    if (params.connectorStatuses) {
      filters.$and.push({
        'connectors.status': { $in: params.connectorStatuses },
        'inactive': false
      });
      // Filter connectors array
      aggregation.push({
        '$addFields': {
          'connectors': {
            '$filter': {
              input: '$connectors',
              as: 'connector',
              cond: {
                $in: ['$$connector.status', params.connectorStatuses]
              }
            }
          }
        }
      });
    }
    // Connector Type
    if (params.connectorTypes) {
      filters.$and.push({
        'connectors.type': { $in: params.connectorTypes }
      });
      // Filter connectors array
      aggregation.push({
        '$addFields': {
          'connectors': {
            '$filter': {
              input: '$connectors',
              as: 'connector',
              cond: {
                $in: ['$$connector.type', params.connectorTypes]
              }
            }
          }
        }
      });
    }
    // With no Site Area
    if (params.withNoSiteArea) {
      filters.$and.push({
        'siteAreaID': null
      });
    } else {
      // Query by siteAreaID
      if (params.siteAreaIDs && Array.isArray(params.siteAreaIDs)) {
        filters.$and.push({
          'siteAreaID': { $in: params.siteAreaIDs.map((id) => Utils.convertToObjectID(id)) }
        });
      }
      // Site Area
      DatabaseUtils.pushSiteAreaLookupInAggregation({
        tenantID, aggregation: aggregation, localField: 'siteAreaID', foreignField: '_id',
        asField: 'siteArea', oneToOneCardinality: true, objectIDFields: ['createdBy', 'lastChangedBy']
      });
    }
    // Date before provided
    if (params.statusChangedBefore && moment(params.statusChangedBefore).isValid()) {
      aggregation.push({
        $match: { 'connectors.statusLastChangedOn': { $lte: params.statusChangedBefore } }
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
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteArea.siteID');
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
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteAreaID');
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
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const chargingStationsMDB = await global.database.getCollection<ChargingStation>(tenantID, 'chargingstations')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 } })
      .toArray();
    // Debug
    Logging.traceEnd(MODULE_NAME, 'getChargingStations', uniqueTimerID);
    // Ok
    return {
      count: (chargingStationsCountMDB.length > 0 ?
        (chargingStationsCountMDB[0].count === Constants.DB_RECORD_COUNT_CEIL ? -1 : chargingStationsCountMDB[0].count) : 0),
      result: chargingStationsMDB
    };
  }

  public static async getChargingStationsInError(tenantID: string,
    params: { search?: string; siteIDs?: string[]; siteAreaIDs: string[]; errorType?: string[] },
    dbParams: DbParams): Promise<DataResult<ChargingStationInError>> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getChargingStations');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Create Aggregation
    const aggregation = [];
    // Add Charging Station inactive flag
    DatabaseUtils.pushChargingStationInactiveFlag(aggregation);
    // Set the filters
    const match: any = { '$and': [{ '$or': DatabaseUtils.getNotDeletedFilter() }] };
    match.$and.push({ issuer: true });
    if (params.siteAreaIDs && Array.isArray(params.siteAreaIDs) && params.siteAreaIDs.length > 0) {
      match.$and.push({
        'siteAreaID': { $in: params.siteAreaIDs.map((id) => Utils.convertToObjectID(id)) }
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
      if (!Utils.isTenantComponentActive(await TenantStorage.getTenant(tenantID), TenantComponents.ORGANIZATION) && params.errorType.includes(ChargingStationInErrorType.MISSING_SITE_AREA)) {
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME,
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
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Read DB
    const chargingStationsMDB = await global.database.getCollection<ChargingStation>(tenantID, 'chargingstations')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 } })
      .toArray();
    // Debug
    Logging.traceEnd(MODULE_NAME, 'getChargingStations', uniqueTimerID);
    // Ok
    return {
      count: chargingStationsMDB.length,
      result: chargingStationsMDB
    };
  }

  public static async saveChargingStation(tenantID: string, chargingStationToSave: ChargingStation): Promise<string> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'saveChargingStation');
    // Check Tenant
    await Utils.checkTenant(tenantID);
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
      templateHash: chargingStationToSave.templateHash,
      issuer: chargingStationToSave.issuer,
      private: chargingStationToSave.private,
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
      remoteAuthorizations: chargingStationToSave.remoteAuthorizations,
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
    if (!chargingStationMDB.remoteAuthorizations) {
      chargingStationMDB.remoteAuthorizations = [];
    }
    // Add Created/LastChanged By
    DatabaseUtils.addLastChangedCreatedProps(chargingStationMDB, chargingStationToSave);
    // Modify and return the modified document
    const result = await global.database.getCollection<any>(tenantID, 'chargingstations').findOneAndUpdate(
      chargingStationFilter,
      { $set: chargingStationMDB },
      { upsert: true });
    // Debug
    Logging.traceEnd(MODULE_NAME, 'saveChargingStation', uniqueTimerID);
    return chargingStationMDB._id;
  }

  public static async saveChargingStationConnector(tenantID: string, chargingStation: ChargingStation, connector: Connector): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'saveChargingStationConnector');
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
    Logging.traceEnd(MODULE_NAME, 'saveChargingStationConnector', uniqueTimerID);
  }

  public static async saveChargingStationHeartBeat(tenantID: string, id: string,
    params: { lastHeartBeat: Date; currentIPAddress: string }): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'saveChargingStationHeartBeat');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Set data
    // Modify and return the modified document
    const result = await global.database.getCollection<any>(tenantID, 'chargingstations').findOneAndUpdate(
      { '_id': id },
      { $set: params },
      { upsert: true });
    // Debug
    Logging.traceEnd(MODULE_NAME, 'saveChargingStationHeartBeat', uniqueTimerID);
  }

  public static async saveChargingStationFirmwareStatus(tenantID: string, id: string, firmwareUpdateStatus: OCPPFirmwareStatus): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'saveChargingStationFirmwareStatus');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Set data
    // Modify and return the modified document
    const result = await global.database.getCollection<any>(tenantID, 'chargingstations').findOneAndUpdate(
      { '_id': id },
      { $set: { firmwareUpdateStatus } },
      { upsert: true });
    // Debug
    Logging.traceEnd(MODULE_NAME, 'saveChargingStationFirmwareStatus', uniqueTimerID);
  }

  public static async deleteChargingStation(tenantID: string, id: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'deleteChargingStation');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Delete Configuration
    await global.database.getCollection<any>(tenantID, 'configurations')
      .findOneAndDelete({ '_id': id });
    // Delete Charging Profiles
    await this.deleteChargingProfiles(tenantID, id);
    // Delete Charging Station
    await global.database.getCollection<any>(tenantID, 'chargingstations')
      .findOneAndDelete({ '_id': id });
    // Keep the rest (bootnotif, authorize...)
    // Debug
    Logging.traceEnd(MODULE_NAME, 'deleteChargingStation', uniqueTimerID);
  }

  public static async getOcppParameterValue(tenantID: string, chargeBoxID: string, paramName: string) {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getOcppParameterValue');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Get the config
    const configuration = await ChargingStationStorage.getOcppParameters(tenantID, chargeBoxID);
    let value = null;
    if (configuration) {
      // Get the value
      configuration.result.every((param) => {
        // Check
        if (param.key === paramName) {
          value = param.value;
          return false;
        }
        return true;
      });
    }
    // Debug
    Logging.traceEnd(MODULE_NAME, 'getOcppParameterValue', uniqueTimerID);
    return value;
  }

  static async saveOcppParameters(tenantID: string, parameters: ChargingStationOcppParameters) {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'saveOcppParameters');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Modify
    await global.database.getCollection<any>(tenantID, 'configurations').findOneAndUpdate({
      '_id': parameters.id
    }, {
      $set: {
        configuration: parameters.configuration,
        timestamp: Utils.convertToDate(parameters.timestamp)
      }
    }, {
      upsert: true,
      returnOriginal: false
    });
    // Debug
    Logging.traceEnd(MODULE_NAME, 'saveOcppParameters', uniqueTimerID);
  }

  public static async getOcppParameters(tenantID: string, id: string): Promise<DataResult<OcppParameter>> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getOcppParameters');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const parametersMDB = await global.database.getCollection<ChargingStationOcppParameters>(tenantID, 'configurations')
      .findOne({
        '_id': id
      });
    // Found?
    const parameters: OcppParameter[] = [];
    if (parametersMDB && parametersMDB.configuration && parametersMDB.configuration.length > 0) {
      // Set values
      let index = 0;
      for (const parameter of parametersMDB.configuration) {
        parameters.push({
          id: index.toString(),
          key: parameter.key,
          value: parameter.value,
          readonly: parameter.readonly
        });
        index++;
      }
    }
    // Sort
    parameters.sort((param1, param2) => {
      if (param1.key.toLocaleLowerCase() < param2.key.toLocaleLowerCase()) {
        return -1;
      }
      if (param1.key.toLocaleLowerCase() > param2.key.toLocaleLowerCase()) {
        return 1;
      }
      return 0;
    });
    // Debug
    Logging.traceEnd(MODULE_NAME, 'getOcppParameters', uniqueTimerID);
    return {
      count: parameters.length,
      result: parameters
    };
  }

  public static async getChargingProfile(tenantID: string, id: string): Promise<ChargingProfile> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getChargingProfile');
    // Query single Site
    const chargingProfilesMDB = await ChargingStationStorage.getChargingProfiles(tenantID,
      { chargingProfileID: id },
      Constants.DB_PARAMS_SINGLE_RECORD);
    // Debug
    Logging.traceEnd(MODULE_NAME, 'getChargingProfile', uniqueTimerID, { id });
    return chargingProfilesMDB.count > 0 ? chargingProfilesMDB.result[0] : null;
  }

  public static async getChargingProfiles(tenantID: string,
    params: {
      chargingStationID?: string; connectorID?: number; chargingProfileID?: string;
      profilePurposeType?: ChargingProfilePurposeType; transactionId?: number;
    } = {},
    dbParams: DbParams, projectFields?: string[]): Promise<DataResult<ChargingProfile>> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getChargingProfiles');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Query by chargingStationID
    const filters: any = {};
    if (params.chargingProfileID) {
      filters._id = params.chargingProfileID;
    } else {
      // Charger
      if (params.chargingStationID) {
        filters.chargingStationID = params.chargingStationID;
      }
      // Connector
      if (params.connectorID) {
        filters.connectorID = params.connectorID;
      }
      // Purpose Type
      if (params.profilePurposeType) {
        filters['profile.chargingProfilePurpose'] = params.profilePurposeType;
      }
      // Transaction ID
      if (params.transactionId) {
        filters['profile.transactionId'] = params.transactionId;
      }
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
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Sort
    if (dbParams.sort) {
      aggregation.push({
        $sort: dbParams.sort
      });
    } else {
      aggregation.push({
        $sort: {
          connectorID: -1
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
    const chargingProfilesMDB = await global.database.getCollection<ChargingProfile>(tenantID, 'chargingprofiles')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 }, allowDiskUse: true })
      .toArray();
    // Debug
    Logging.traceEnd(MODULE_NAME, 'getChargingProfiles', uniqueTimerID, { params, dbParams });
    return {
      count: (chargingProfilesCountMDB.length > 0 ?
        (chargingProfilesCountMDB[0].count === Constants.DB_RECORD_COUNT_CEIL ? -1 : chargingProfilesCountMDB[0].count) : 0),
      result: chargingProfilesMDB
    };
  }

  public static async saveChargingProfile(tenantID: string, chargingProfileToSave: ChargingProfile): Promise<string> {
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'saveChargingProfile');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const chargingProfileFilter: any = {};
    // Build Request
    if (chargingProfileToSave.id) {
      chargingProfileFilter._id = chargingProfileToSave.id;
    } else {
      chargingProfileFilter._id =
        Cypher.hash(`${chargingProfileToSave.chargingStationID}~${chargingProfileToSave.connectorID}~${chargingProfileToSave.profile.chargingProfileId}`);
    }
    // Properties to save
    const chargingProfileMDB: any = {
      _id: chargingProfileFilter._id,
      chargingStationID: chargingProfileToSave.chargingStationID,
      connectorID: chargingProfileToSave.connectorID,
      profile: chargingProfileToSave.profile
    };
    await global.database.getCollection<any>(tenantID, 'chargingprofiles').findOneAndUpdate(
      chargingProfileFilter,
      { $set: chargingProfileMDB },
      { upsert: true });
    Logging.traceEnd(MODULE_NAME, 'saveChargingProfile', uniqueTimerID);
    return chargingProfileFilter._id;
  }

  public static async deleteChargingProfile(tenantID: string, id: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'deleteChargingProfile');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Delete Charging Profile
    await global.database.getCollection<any>(tenantID, 'chargingprofiles')
      .findOneAndDelete({ '_id': id });
    // Debug
    Logging.traceEnd(MODULE_NAME, 'deleteChargingProfile', uniqueTimerID);
  }

  public static async deleteChargingProfiles(tenantID: string, chargingStationID: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'deleteChargingProfile');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Delete Charging Profiles
    await global.database.getCollection<any>(tenantID, 'chargingprofiles')
      .findOneAndDelete({ 'chargingStationID': chargingStationID });
    // Debug
    Logging.traceEnd(MODULE_NAME, 'deleteChargingProfile', uniqueTimerID);
  }

  public static getChargingStationFirmware(filename: string): GridFSBucketReadStream {
    // Get the bucket
    const bucket: GridFSBucket = global.database.getGridFSBucket('default.firmwares');
    // Get the file
    return bucket.openDownloadStreamByName(filename);
  }

  public static async removeChargingStationsFromSiteArea(tenantID: string, siteAreaID: string, chargingStationIDs: string[]): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'removeChargingStationsFromSiteArea');
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
    Logging.traceEnd(MODULE_NAME, 'removeChargingStationsFromSiteArea', uniqueTimerID, {
      siteAreaID,
      chargingStationIDs
    });
  }

  public static async addChargingStationsToSiteArea(tenantID: string, siteAreaID: string, chargingStationIDs: string[]): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'addChargingStationsToSiteArea');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Site provided?
    if (siteAreaID) {
      // At least one ChargingStation
      if (chargingStationIDs && chargingStationIDs.length > 0) {
        // Update all chargers
        await global.database.getCollection<any>(tenantID, 'chargingstations').updateMany({
          $and: [
            { '_id': { $in: chargingStationIDs } }
          ]
        }, {
          $set: { siteAreaID: Utils.convertToObjectID(siteAreaID) }
        }, {
          upsert: false
        });
      }
    }
    // Debug
    Logging.traceEnd(MODULE_NAME, 'addChargingStationsToSiteArea', uniqueTimerID, {
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
              { 'powerLimitUnit': { $exists: false } }, { 'powerLimitUnit': null },
              { 'powerLimitUnit': { $nin: [PowerLimitUnits.AMPERE, PowerLimitUnits.WATT] } },
              { 'chargingStationURL': { $exists: false } }, { 'chargingStationURL': null }, { 'chargingStationURL': { $eq: '' } },
              { 'cannotChargeInParallel': { $exists: false } }, { 'cannotChargeInParallel': null },
              { 'currentType': { $exists: false } }, { 'currentType': null },
              { 'currentType': { $nin: [ChargingStationCurrentType.AC, ChargingStationCurrentType.DC, ChargingStationCurrentType.AC_DC] } },
              { 'connectors.numberOfConnectedPhase': { $exists: false } }, { 'connectors.numberOfConnectedPhase': null }, { 'connectors.numberOfConnectedPhase': { $nin: [0, 1, 3] } },
              { 'connectors.type': { $exists: false } }, { 'connectors.type': null }, { 'connectors.type': { $eq: '' } },
              { 'connectors.type': { $nin: [ConnectorType.CHADEMO, ConnectorType.COMBO_CCS, ConnectorType.DOMESTIC, ConnectorType.TYPE_1, ConnectorType.TYPE_1_CCS, ConnectorType.TYPE_2, ConnectorType.TYPE_3C] } },
              { 'connectors.currentType': { $exists: false } }, { 'connectors.currentType': null }, { 'connectors.currentType': { $eq: '' } },
              { 'connectors.power': { $exists: false } }, { 'connectors.power': null }, { 'connectors.power': { $lte: 0 } },
              { 'connectors.voltage': { $exists: false } }, { 'connectors.voltage': null }, { 'connectors.voltage': { $lte: 0 } },
              { 'connectors.amperage': { $exists: false } }, { 'connectors.amperage': null }, { 'connectors.amperage': { $lte: 0 } },
            ]
          }
        },
        { $addFields: { 'errorCode': ChargingStationInErrorType.MISSING_SETTINGS } }
        ];
      case ChargingStationInErrorType.CONNECTION_BROKEN: {
        const inactiveDate = new Date(new Date().getTime() - Utils.getChargingStationHeartbeatMaxIntervalSecs() * 1000);
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
}
