import { ChargingProfile, ChargingProfilePurposeType, ChargingRateUnitType } from '../../types/ChargingProfile';
import ChargingStation, { ChargePoint, ChargingStationOcppParameters, ChargingStationTemplate, Connector, ConnectorMDB, ConnectorType, OcppParameter } from '../../types/ChargingStation';
import { ChargingStationInError, ChargingStationInErrorType } from '../../types/InError';
import { GridFSBucket, GridFSBucketReadStream, GridFSBucketWriteStream } from 'mongodb';
import global, { FilterParams } from '../../types/GlobalType';

import BackendError from '../../exception/BackendError';
import Configuration from '../../utils/Configuration';
import Constants from '../../utils/Constants';
import Cypher from '../../utils/Cypher';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import { OCPPFirmwareStatus } from '../../types/ocpp/OCPPServer';
import { ServerAction } from '../../types/Server';
import TenantComponents from '../../types/TenantComponents';
import TenantStorage from './TenantStorage';
import Utils from '../../utils/Utils';
import fs from 'fs';
import moment from 'moment';

const MODULE_NAME = 'ChargingStationStorage';

export default class ChargingStationStorage {

  public static async updateChargingStationTemplatesFromFile(): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'updateChargingStationTemplatesFromFile');
    // Read File
    let chargingStationTemplates: ChargingStationTemplate[];
    try {
      chargingStationTemplates = JSON.parse(fs.readFileSync(Configuration.getChargingStationTemplatesConfig().templatesFilePath, 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw error;
      }
    }
    // Update Templates
    for (const chargingStationTemplate of chargingStationTemplates) {
      try {
        // Set the hashes
        chargingStationTemplate.hash = Cypher.hash(JSON.stringify(chargingStationTemplate));
        chargingStationTemplate.hashTechnical = Cypher.hash(JSON.stringify(chargingStationTemplate.technical));
        chargingStationTemplate.hashCapabilities = Cypher.hash(JSON.stringify(chargingStationTemplate.capabilities));
        chargingStationTemplate.hashOcppStandard = Cypher.hash(JSON.stringify(chargingStationTemplate.ocppStandardParameters));
        chargingStationTemplate.hashOcppVendor = Cypher.hash(JSON.stringify(chargingStationTemplate.ocppVendorParameters));
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
    const chargingStationTemplatesMDB: ChargingStationTemplate[] =
      await global.database.getCollection<ChargingStationTemplate>(Constants.DEFAULT_TENANT, 'chargingstationtemplates')
        .aggregate(aggregation).toArray();
    // Transfer
    const chargingStationTemplates: ChargingStationTemplate[] = [];
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

  public static async getChargingStation(tenantID: string, id: string = Constants.UNKNOWN_STRING_ID,
    params: { includeDeleted?: boolean } = {}): Promise<ChargingStation> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getChargingStation');
    // Query single Charging Station
    const chargingStationsMDB = await ChargingStationStorage.getChargingStations(tenantID,
      { chargingStationIDs: [id], withSite: true, ...params }, Constants.DB_PARAMS_SINGLE_RECORD);
    // Debug
    Logging.traceEnd(MODULE_NAME, 'getChargingStation', uniqueTimerID, { id });
    return chargingStationsMDB.result[0];
  }

  public static async getChargingStations(tenantID: string,
    params: {
      search?: string; chargingStationIDs?: string[]; siteAreaIDs?: string[]; withNoSiteArea?: boolean;
      connectorStatuses?: string[]; connectorTypes?: string[]; statusChangedBefore?: Date;
      siteIDs?: string[]; withSite?: boolean; includeDeleted?: boolean; offlineSince?: Date; issuer?: boolean;
      locCoordinates?: number[]; locMaxDistanceMeters?: number;
    },
    dbParams: DbParams, projectFields?: string[]): Promise<DataResult<ChargingStation>> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getChargingStations');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Clone before updating the values
    dbParams = Utils.cloneJSonDocument(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Create Aggregation
    const aggregation = [];
    // Position coordinates
    if (Utils.containsGPSCoordinates(params.locCoordinates)) {
      aggregation.push({
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: params.locCoordinates
          },
          distanceField: 'distanceMeters',
          maxDistance: params.locMaxDistanceMeters > 0 ? params.locMaxDistanceMeters : Constants.MAX_GPS_DISTANCE_METERS,
          spherical: true
        }
      });
    }
    // Set the filters
    const filters: FilterParams = {
      $or: DatabaseUtils.getNotDeletedFilter()
    };
    // Filter
    if (params.search) {
      filters.$or = [
        { '_id': { $regex: params.search, $options: 'i' } },
        { 'chargePointModel': { $regex: params.search, $options: 'i' } },
        { 'chargePointVendor': { $regex: params.search, $options: 'i' } }
      ];
    }
    // Charging Stations
    if (!Utils.isEmptyArray(params.chargingStationIDs)) {
      filters._id = {
        $in: params.chargingStationIDs
      };
    }
    // Filter on last heart beat
    if (params.offlineSince && moment(params.offlineSince).isValid()) {
      filters.lastHeartBeat = { $lte: params.offlineSince };
    }
    // Issuer
    if (Utils.objectHasProperty(params, 'issuer')) {
      filters.issuer = params.issuer;
    }
    // Add Charging Station inactive flag
    DatabaseUtils.pushChargingStationInactiveFlag(aggregation);
    // Include deleted charging stations if requested
    if (params.includeDeleted) {
      filters.$or.push({
        'deleted': true
      });
    }
    // Add in aggregation
    aggregation.push({
      $match: filters
    });
    // Connector Status
    if (params.connectorStatuses) {
      filters['connectors.status'] = { $in: params.connectorStatuses };
      filters.inactive = false;
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
      filters['connectors.type'] = { $in: params.connectorTypes };
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
      filters.siteAreaID = null;
    } else {
      // Query by siteAreaID
      if (!Utils.isEmptyArray(params.siteAreaIDs)) {
        filters.siteAreaID = { $in: params.siteAreaIDs.map((id) => Utils.convertToObjectID(id)) };
      }
      // Site Area
      DatabaseUtils.pushSiteAreaLookupInAggregation({
        tenantID, aggregation: aggregation, localField: 'siteAreaID', foreignField: '_id',
        asField: 'siteArea', oneToOneCardinality: true
      });
      // Check Site ID
      if (!Utils.isEmptyArray(params.siteIDs)) {
        // Build filter
        aggregation.push({
          $match: {
            'siteArea.siteID': {
              $in: params.siteIDs.map((id) => Utils.convertToObjectID(id))
            }
          }
        });
      }
    }
    // Date before provided
    if (params.statusChangedBefore && moment(params.statusChangedBefore).isValid()) {
      aggregation.push({
        $match: { 'connectors.statusLastChangedOn': { $lte: params.statusChangedBefore } }
      });
    }
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
    // Sort
    if (!dbParams.sort) {
      dbParams.sort = { _id: 1 };
    }
    // Position coordinates
    if (Utils.containsGPSCoordinates(params.locCoordinates)) {
      dbParams.sort = { distanceMeters: 1 };
    }
    aggregation.push({
      $sort: dbParams.sort
    });
    // Skip
    aggregation.push({
      $skip: dbParams.skip
    });
    // Limit
    aggregation.push({
      $limit: dbParams.limit
    });
    // Users on connectors
    DatabaseUtils.pushArrayLookupInAggregation('connectors', DatabaseUtils.pushUserLookupInAggregation.bind(this), {
      tenantID, aggregation: aggregation, localField: 'connectors.userID', foreignField: '_id',
      asField: 'connectors.user', oneToOneCardinality: true, objectIDFields: ['createdBy', 'lastChangedBy']
    }, { sort: dbParams.sort });
    // Site
    if (params.withSite && !params.withNoSiteArea) {
      DatabaseUtils.pushSiteLookupInAggregation({
        tenantID, aggregation: aggregation, localField: 'siteArea.siteID', foreignField: '_id',
        asField: 'siteArea.site', oneToOneCardinality: true
      });
    }
    // Change ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Convert siteID back to string after having queried the site
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteArea.siteID');
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteAreaID');
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
    // Clone before updating the values
    dbParams = Utils.cloneJSonDocument(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Create Aggregation
    const aggregation = [];
    // Add Charging Station inactive flag
    DatabaseUtils.pushChargingStationInactiveFlag(aggregation);
    // Set the filters
    const filters: FilterParams = { '$or': DatabaseUtils.getNotDeletedFilter() };
    filters.issuer = true;
    if (!Utils.isEmptyArray(params.siteAreaIDs)) {
      filters.siteAreaID = { $in: params.siteAreaIDs.map((id) => Utils.convertToObjectID(id)) };
    }
    // Search filters
    if (params.search) {
      filters.$or = [
        { '_id': { $regex: params.search, $options: 'i' } },
        { 'chargePointModel': { $regex: params.search, $options: 'i' } },
        { 'chargePointVendor': { $regex: params.search, $options: 'i' } }
      ];
    }
    // Add in aggregation
    aggregation.push({
      $match: filters
    });
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
    if (!Utils.isEmptyArray(params.siteIDs)) {
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
    if (!Utils.isEmptyArray(params.errorType)) {
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
    if (!dbParams.sort) {
      dbParams.sort = { _id: 1 };
    }
    aggregation.push({
      $sort: dbParams.sort
    });
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
    const chargingStationMDB = {
      _id: chargingStationToSave.id,
      templateHash: chargingStationToSave.templateHash,
      templateHashTechnical: chargingStationToSave.templateHashTechnical,
      templateHashCapabilities: chargingStationToSave.templateHashCapabilities,
      templateHashOcppStandard: chargingStationToSave.templateHashOcppStandard,
      templateHashOcppVendor: chargingStationToSave.templateHashOcppVendor,
      issuer: Utils.convertToBoolean(chargingStationToSave.issuer),
      public: Utils.convertToBoolean(chargingStationToSave.public),
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
      deleted: Utils.convertToBoolean(chargingStationToSave.deleted),
      lastReboot: Utils.convertToDate(chargingStationToSave.lastReboot),
      chargingStationURL: chargingStationToSave.chargingStationURL,
      maximumPower: Utils.convertToInt(chargingStationToSave.maximumPower),
      excludeFromSmartCharging: Utils.convertToBoolean(chargingStationToSave.excludeFromSmartCharging),
      forceInactive: Utils.convertToBoolean(chargingStationToSave.forceInactive),
      powerLimitUnit: chargingStationToSave.powerLimitUnit,
      voltage: Utils.convertToInt(chargingStationToSave.voltage),
      connectors: chargingStationToSave.connectors ? chargingStationToSave.connectors.map(
        (connector) => ChargingStationStorage.connector2connectorMDB(connector)) : [],
      chargePoints: chargingStationToSave.chargePoints ? chargingStationToSave.chargePoints.map(
        (chargePoint) => ChargingStationStorage.chargePoint2ChargePointMDB(chargePoint)) : [],
      coordinates: Utils.containsGPSCoordinates(chargingStationToSave.coordinates) ? chargingStationToSave.coordinates.map(
        (coordinate) => Utils.convertToFloat(coordinate)) : [],
      remoteAuthorizations: chargingStationToSave.remoteAuthorizations ? chargingStationToSave.remoteAuthorizations : [],
      currentIPAddress: chargingStationToSave.currentIPAddress,
      capabilities: chargingStationToSave.capabilities,
      ocppStandardParameters: chargingStationToSave.ocppStandardParameters,
      ocppVendorParameters: chargingStationToSave.ocppVendorParameters,
      ocpiData: chargingStationToSave.ocpiData
    };
    // Add Created/LastChanged By
    DatabaseUtils.addLastChangedCreatedProps(chargingStationMDB, chargingStationToSave);
    // Modify and return the modified document
    await global.database.getCollection<any>(tenantID, 'chargingstations').findOneAndUpdate(
      { _id: chargingStationToSave.id },
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
    const connectorMDB = ChargingStationStorage.connector2connectorMDB(connector);
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const updatedFields: any = {};
    updatedFields['connectors.' + (connector.connectorId - 1).toString()] = connectorMDB;
    // Modify and return the modified document
    const result = await global.database.getCollection<any>(tenantID, 'chargingstations').findOneAndUpdate(
      { '_id': chargingStation.id },
      { $set: updatedFields },
      { upsert: true });
    // Debug
    Logging.traceEnd(MODULE_NAME, 'saveChargingStationConnector', uniqueTimerID);
  }

  public static async saveChargingStationHeartBeat(tenantID: string, id: string,
    params: { lastHeartBeat: Date; currentIPAddress?: string | string[] }): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'saveChargingStationHeartBeat');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Set data
    // Modify and return the modified document
    await global.database.getCollection<any>(tenantID, 'chargingstations').findOneAndUpdate(
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

  public static async getOcppParameterValue(tenantID: string, chargeBoxID: string, paramName: string): Promise<string> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getOcppParameterValue');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Get the config
    const configuration = await ChargingStationStorage.getOcppParameters(tenantID, chargeBoxID);
    let value: string = null;
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

  static async saveOcppParameters(tenantID: string, parameters: ChargingStationOcppParameters): Promise<void> {
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
      .findOne({ '_id': id });
    if (parametersMDB) {
      // Sort
      if (parametersMDB.configuration) {
        parametersMDB.configuration.sort((param1, param2) => {
          if (param1.key.toLocaleLowerCase() < param2.key.toLocaleLowerCase()) {
            return -1;
          }
          if (param1.key.toLocaleLowerCase() > param2.key.toLocaleLowerCase()) {
            return 1;
          }
          return 0;
        });
      }
      // Debug
      Logging.traceEnd(MODULE_NAME, 'getOcppParameters', uniqueTimerID);
      return {
        count: parametersMDB.configuration.length,
        result: parametersMDB.configuration
      };
    }
    // No conf
    return {
      count: 0,
      result: []
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
    return chargingProfilesMDB.count === 1 ? chargingProfilesMDB.result[0] : null;
  }

  public static async getChargingProfiles(tenantID: string,
    params: {
      search?: string; chargingStationIDs?: string[]; connectorID?: number; chargingProfileID?: string;
      profilePurposeType?: ChargingProfilePurposeType; transactionId?: number; withChargingStation?: boolean; withSiteArea?: boolean; siteIDs?: string[];
    } = {},
    dbParams: DbParams, projectFields?: string[]): Promise<DataResult<ChargingProfile>> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getChargingProfiles');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Clone before updating the values
    dbParams = Utils.cloneJSonDocument(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Query by chargingStationID
    const filters: FilterParams = {};
    // Build filter
    if (params.search) {
      const searchRegex = Utils.escapeSpecialCharsInRegex(params.search);
      filters.$or = [
        { 'chargingStationID': { $regex: searchRegex, $options: 'i' } },
      ];
    }
    if (params.chargingProfileID) {
      filters._id = params.chargingProfileID;
    } else {
      // Charger
      if (params.chargingStationIDs) {
        filters.chargingStationID = { $in: params.chargingStationIDs };
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
    if (params.withChargingStation || params.withSiteArea || !Utils.isEmptyArray(params.siteIDs)) {
      // Charging Stations
      DatabaseUtils.pushChargingStationLookupInAggregation({
        tenantID, aggregation, localField: 'chargingStationID', foreignField: '_id',
        asField: 'chargingStation', oneToOneCardinality: true, oneToOneCardinalityNotNull: false
      });
      // Site Areas
      DatabaseUtils.pushSiteAreaLookupInAggregation({
        tenantID, aggregation, localField: 'chargingStation.siteAreaID', foreignField: '_id',
        asField: 'chargingStation.siteArea', oneToOneCardinality: true, oneToOneCardinalityNotNull: false
      });
      // Check Site ID
      if (!Utils.isEmptyArray(params.siteIDs)) {
        // Build filter
        aggregation.push({
          $match: {
            'chargingStation.siteArea.siteID': {
              $in: params.siteIDs.map((siteID) => Utils.convertToObjectID(siteID))
            }
          }
        });
      }
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
    if (!dbParams.sort) {
      dbParams.sort = {
        'chargingStationID': 1,
        'connectorID': 1,
        'profile.chargingProfilePurpose': 1,
        'profile.stackLevel': 1,
      };
    }
    aggregation.push({
      $sort: dbParams.sort
    });
    // Skip
    aggregation.push({
      $skip: dbParams.skip
    });
    // Limit
    aggregation.push({
      $limit: dbParams.limit
    });
    // Convert
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'chargingStation.siteAreaID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'chargingStation.siteArea.siteID');
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
      connectorID: Utils.convertToInt(chargingProfileToSave.connectorID),
      chargePointID: Utils.convertToInt(chargingProfileToSave.chargePointID),
      profile: chargingProfileToSave.profile
    };
    await global.database.getCollection<any>(tenantID, 'chargingprofiles').findOneAndUpdate(
      chargingProfileFilter,
      { $set: chargingProfileMDB },
      { upsert: true });
    Logging.traceEnd(MODULE_NAME, 'saveChargingProfile', uniqueTimerID);
    return chargingProfileFilter._id as string;
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

  public static putChargingStationFirmware(filename: string): GridFSBucketWriteStream {
    // Get the bucket
    const bucket: GridFSBucket = global.database.getGridFSBucket('default.firmwares');
    // Put the file
    return bucket.openUploadStream(filename);
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
              { 'powerLimitUnit': { $nin: [ChargingRateUnitType.AMPERE, ChargingRateUnitType.WATT] } },
              { 'chargingStationURL': { $exists: false } }, { 'chargingStationURL': null }, { 'chargingStationURL': { $eq: '' } },
              { 'connectors.type': { $exists: false } }, { 'connectors.type': null }, { 'connectors.type': { $eq: '' } },
              { 'connectors.type': { $nin: [ConnectorType.CHADEMO, ConnectorType.COMBO_CCS, ConnectorType.DOMESTIC, ConnectorType.TYPE_1, ConnectorType.TYPE_1_CCS, ConnectorType.TYPE_2, ConnectorType.TYPE_3C] } },
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

  private static connector2connectorMDB(connector: Connector): ConnectorMDB {
    if (!connector) {
      return null;
    }
    return {
      connectorId: Utils.convertToInt(connector.connectorId),
      currentInstantWatts: Utils.convertToFloat(connector.currentInstantWatts),
      currentStateOfCharge: connector.currentStateOfCharge,
      currentTotalInactivitySecs: Utils.convertToInt(connector.currentTotalInactivitySecs),
      currentTotalConsumptionWh: Utils.convertToFloat(connector.currentTotalConsumptionWh),
      currentTransactionDate: Utils.convertToDate(connector.currentTransactionDate),
      currentTagID: connector.currentTagID,
      status: connector.status,
      errorCode: connector.errorCode,
      info: connector.info,
      vendorErrorCode: connector.vendorErrorCode,
      power: Utils.convertToInt(connector.power),
      type: connector.type,
      voltage: Utils.convertToInt(connector.voltage),
      amperage: Utils.convertToInt(connector.amperage),
      amperageLimit: connector.amperageLimit,
      currentTransactionID: Utils.convertToInt(connector.currentTransactionID),
      userID: Utils.convertToObjectID(connector.userID),
      statusLastChangedOn: connector.statusLastChangedOn,
      currentInactivityStatus: connector.currentInactivityStatus,
      numberOfConnectedPhase: connector.numberOfConnectedPhase,
      currentType: connector.currentType,
      chargePointID: connector.chargePointID,
    };
  }

  private static chargePoint2ChargePointMDB(chargePoint: ChargePoint): ChargePoint {
    if (!chargePoint) {
      return null;
    }
    return {
      chargePointID: Utils.convertToInt(chargePoint.chargePointID),
      currentType: chargePoint.currentType,
      voltage: chargePoint.voltage ? Utils.convertToInt(chargePoint.voltage) : null,
      amperage: chargePoint.amperage ? Utils.convertToInt(chargePoint.amperage) : null,
      numberOfConnectedPhase: chargePoint.numberOfConnectedPhase ? Utils.convertToInt(chargePoint.numberOfConnectedPhase) : null,
      cannotChargeInParallel: Utils.convertToBoolean(chargePoint.cannotChargeInParallel),
      sharePowerToAllConnectors: Utils.convertToBoolean(chargePoint.sharePowerToAllConnectors),
      excludeFromPowerLimitation: Utils.convertToBoolean(chargePoint.excludeFromPowerLimitation),
      ocppParamForPowerLimitation: chargePoint.ocppParamForPowerLimitation,
      power: chargePoint.power ? Utils.convertToInt(chargePoint.power) : null,
      efficiency: chargePoint.efficiency ? Utils.convertToInt(chargePoint.efficiency) : null,
      connectorIDs: chargePoint.connectorIDs.map((connectorID) => Utils.convertToInt(connectorID)),
    };
  }
}
