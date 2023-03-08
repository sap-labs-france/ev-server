import { ChargePointStatus, OCPPFirmwareStatus } from '../../types/ocpp/OCPPServer';
import { ChargingProfile, ChargingProfilePurposeType, ChargingRateUnitType } from '../../types/ChargingProfile';
import { ChargingProfileDataResult, ChargingStationDataResult, ChargingStationInErrorDataResult, DataResult } from '../../types/DataResult';
import ChargingStation, { ChargePoint, ChargingStationOcpiData, ChargingStationOcppParameters, ChargingStationOicpData, ChargingStationTemplate, Connector, ConnectorType, CurrentType, OcppParameter, PhaseAssignmentToGrid, RemoteAuthorization, Voltage } from '../../types/ChargingStation';
import { GridFSBucket, GridFSBucketReadStream, GridFSBucketWriteStream, ObjectId, UpdateResult } from 'mongodb';
import Tenant, { TenantComponents } from '../../types/Tenant';
import global, { DatabaseCount, FilterParams } from '../../types/GlobalType';

import BackendError from '../../exception/BackendError';
import { ChargingStationInErrorType } from '../../types/InError';
import ChargingStationValidatorStorage from '../validator/ChargingStationValidatorStorage';
import Configuration from '../../utils/Configuration';
import Constants from '../../utils/Constants';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import { InactivityStatus } from '../../types/Transaction';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import moment from 'moment';

const MODULE_NAME = 'ChargingStationStorage';

export interface ConnectorMDB {
  id?: string; // Needed for the roaming component
  connectorId: number;
  currentInstantWatts: number;
  currentStateOfCharge: number;
  currentTotalConsumptionWh: number;
  currentTotalInactivitySecs: number;
  currentInactivityStatus: InactivityStatus;
  currentTransactionID: number;
  currentTransactionDate: Date;
  currentTagID: string;
  status: ChargePointStatus;
  errorCode: string;
  info: string;
  vendorErrorCode: string;
  power: number;
  type: ConnectorType;
  voltage: Voltage;
  amperage: number;
  amperageLimit: number;
  currentUserID: ObjectId;
  statusLastChangedOn: Date;
  numberOfConnectedPhase: number;
  currentType: CurrentType;
  chargePointID: number;
  phaseAssignmentToGrid: PhaseAssignmentToGrid;
  tariffID?: string;
}

export default class ChargingStationStorage {

  public static async getChargingStationTemplates(chargePointVendor?: string): Promise<ChargingStationTemplate[]> {
    const startTime = Logging.traceDatabaseRequestStart();
    // Create Aggregation
    const aggregation = [];
    // Change ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Query Templates
    const chargingStationTemplatesMDB = await global.database.getCollection<any>(Constants.DEFAULT_TENANT_ID, 'chargingstationtemplates')
      .aggregate<any>(aggregation)
      .toArray() as ChargingStationTemplate[];
    const chargingStationTemplates: ChargingStationTemplate[] = [];
    // Reverse match the regexp in JSON template records against the charging station vendor string
    for (const chargingStationTemplateMDB of chargingStationTemplatesMDB) {
      const regExp = new RegExp(chargingStationTemplateMDB.template.chargePointVendor);
      if (regExp.test(chargePointVendor)) {
        chargingStationTemplates.push(chargingStationTemplateMDB);
      }
    }
    await Logging.traceDatabaseRequestEnd(Constants.DEFAULT_TENANT_OBJECT, MODULE_NAME, 'getChargingStationTemplates', startTime, aggregation, chargingStationTemplatesMDB);
    return chargingStationTemplates;
  }

  public static async deleteChargingStationTemplates(): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    // Delete all records
    await global.database.getCollection<any>(Constants.DEFAULT_TENANT_ID, 'chargingstationtemplates').deleteMany(
      { qa: { $not: { $eq: true } } }
    );
    await Logging.traceDatabaseRequestEnd(Constants.DEFAULT_TENANT_OBJECT, MODULE_NAME, 'deleteChargingStationTemplates', startTime, { qa: { $not: { $eq: true } } });
  }

  public static async getChargingStation(tenant: Tenant, id: string = Constants.UNKNOWN_STRING_ID,
      params: { includeDeleted?: boolean, issuer?: boolean; siteIDs?: string[]; withSiteArea?: boolean; withSite?: boolean; } = {},
      projectFields?: string[]): Promise<ChargingStation> {
    const chargingStationsMDB = await ChargingStationStorage.getChargingStations(tenant, {
      chargingStationIDs: [id],
      withSite: params.withSite,
      withSiteArea: params.withSiteArea,
      includeDeleted: params.includeDeleted,
      issuer: params.issuer,
      siteIDs: params.siteIDs,
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return chargingStationsMDB.count === 1 ? chargingStationsMDB.result[0] : null;
  }

  public static async getChargingProfile(tenant: Tenant, id: string = Constants.UNKNOWN_STRING_ID,
      params: { siteIDs?: string[]; withSiteArea?: boolean; } = {},
      projectFields?: string[]): Promise<ChargingProfile> {
    const chargingProfilesMDB = await ChargingStationStorage.getChargingProfiles(tenant, {
      chargingProfileID: id,
      siteIDs: params.siteIDs,
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return chargingProfilesMDB.count === 1 ? chargingProfilesMDB.result[0] : null;
  }

  public static async getChargingStationByOcpiLocationEvseUid(tenant: Tenant, ocpiLocationID: string = Constants.UNKNOWN_STRING_ID,
      ocpiEvseUid: string = Constants.UNKNOWN_STRING_ID,
      withSite = true,
      withSiteArea = true,
  ): Promise<ChargingStation> {
    const chargingStationsMDB = await ChargingStationStorage.getChargingStations(tenant, {
      ocpiLocationID,
      ocpiEvseUid,
      withSite,
      withSiteArea,
    }, Constants.DB_PARAMS_SINGLE_RECORD);
    return chargingStationsMDB.count === 1 ? chargingStationsMDB.result[0] : null;
  }

  public static async getChargingStationByOicpEvseID(tenant: Tenant, oicpEvseID: string = Constants.UNKNOWN_STRING_ID,
      projectFields?: string[]): Promise<ChargingStation> {
    const chargingStationsMDB = await ChargingStationStorage.getChargingStations(tenant, {
      oicpEvseID: oicpEvseID,
      withSiteArea: true
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return chargingStationsMDB.count === 1 ? chargingStationsMDB.result[0] : null;
  }

  public static async getChargingStations(tenant: Tenant,
      params: {
        search?: string; chargingStationIDs?: string[]; chargingStationSerialNumbers?: string[]; siteAreaIDs?: string[]; withNoSiteArea?: boolean;
        connectorStatuses?: ChargePointStatus[]; connectorTypes?: ConnectorType[]; statusChangedBefore?: Date; withSiteArea?: boolean; withUser?: boolean;
        ocpiEvseUid?: string; ocpiLocationID?: string; oicpEvseID?: string;
        siteIDs?: string[]; companyIDs?: string[]; withSite?: boolean; includeDeleted?: boolean; offlineSince?: Date; issuer?: boolean;
        locCoordinates?: number[]; locMaxDistanceMeters?: number; public?: boolean; manualConfiguration?: boolean;
      },
      dbParams: DbParams, projectFields?: string[]): Promise<ChargingStationDataResult> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Create Aggregation
    const aggregation = [];
    // Position coordinates
    if (Utils.hasValidGpsCoordinates(params.locCoordinates)) {
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
    const filters: FilterParams = {};
    // Filter
    if (params.search) {
      filters.$or = [
        { _id: { $regex: params.search, $options: 'im' } },
        { _id: params.search },
        { 'ocpiData.evses.uid': { $regex: params.search, $options: 'im' } },
        { 'ocpiData.evses.location_id': { $regex: params.search, $options: 'im' } },
        { chargePointModel: { $regex: params.search, $options: 'im' } },
        { chargePointVendor: { $regex: params.search, $options: 'im' } }
      ];
    }
    // Remove deleted
    if (!params.includeDeleted) {
      filters.deleted = { '$ne': true };
    }
    // Public Charging Stations
    if (Utils.isBoolean(params.public)) {
      filters.public = params.public;
    }
    // Charging Station
    if (Utils.isBoolean(params.manualConfiguration)) {
      filters.manualConfiguration = params.manualConfiguration;
    }
    // Charging Stations
    if (!Utils.isEmptyArray(params.chargingStationIDs)) {
      filters._id = {
        $in: params.chargingStationIDs
      };
    }
    // Charging Stations
    if (!Utils.isEmptyArray(params.chargingStationSerialNumbers)) {
      filters.chargeBoxSerialNumber = {
        $in: params.chargingStationSerialNumbers
      };
    }
    // OCPI Evse Uids
    if (params.ocpiEvseUid) {
      filters['ocpiData.evses.uid'] = params.ocpiEvseUid;
    }
    // OCPI Location ID
    if (params.ocpiLocationID) {
      filters['ocpiData.evses.location_id'] = params.ocpiLocationID;
    }
    // OICP Evse ID
    if (params.oicpEvseID) {
      filters['oicpData.evses.EvseID'] = params.oicpEvseID;
    }
    // Filter on lastSeen
    if (params.offlineSince && moment(params.offlineSince).isValid()) {
      filters.lastSeen = { $lte: params.offlineSince };
    }
    // Issuer
    if (Utils.objectHasProperty(params, 'issuer') && Utils.isBoolean(params.issuer)) {
      filters.issuer = params.issuer;
    }
    // Add Charging Station inactive flag
    DatabaseUtils.pushChargingStationInactiveFlagInAggregation(aggregation);
    // Add in aggregation
    aggregation.push({
      $match: filters
    });
    // Connector Status
    if (!Utils.isEmptyArray(params.connectorStatuses)) {
      DatabaseUtils.pushArrayFilterInAggregation(aggregation, 'connectors',
        { 'connectors.status': { $in: params.connectorStatuses } });
    }
    // Connector Type
    if (!Utils.isEmptyArray(params.connectorTypes)) {
      DatabaseUtils.pushArrayFilterInAggregation(aggregation, 'connectors',
        { 'connectors.type': { $in: params.connectorTypes } });
    }
    // With no Site Area
    if (params.withNoSiteArea) {
      filters.siteAreaID = null;
    } else if (!Utils.isEmptyArray(params.siteAreaIDs)) {
      // Query by siteAreaID
      filters.siteAreaID = { $in: params.siteAreaIDs.map((id) => DatabaseUtils.convertToObjectID(id)) };
    }
    // Check Site ID
    if (!Utils.isEmptyArray(params.siteIDs)) {
      // Query by siteID
      filters.siteID = { $in: params.siteIDs.map((id) => DatabaseUtils.convertToObjectID(id)) };
    }
    // Check Company ID
    if (!Utils.isEmptyArray(params.companyIDs)) {
      // Query by companyID
      filters.companyID = { $in: params.companyIDs.map((id) => DatabaseUtils.convertToObjectID(id)) };
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
    const chargingStationsCountMDB = await global.database.getCollection<any>(tenant.id, 'chargingstations')
      .aggregate([...aggregation, { $count: 'count' }])
      .toArray() as DatabaseCount[];
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      // Return only the count
      await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getChargingStations', startTime, aggregation, chargingStationsCountMDB);
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
    if (Utils.hasValidGpsCoordinates(params.locCoordinates)) {
      // Override (can have only one sort)
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
    if (params.withUser) {
      DatabaseUtils.pushArrayLookupInAggregation('connectors', DatabaseUtils.pushUserLookupInAggregation.bind(this), {
        tenantID: tenant.id, aggregation: aggregation, localField: 'connectors.currentUserID', foreignField: '_id',
        asField: 'connectors.user', oneToOneCardinality: true, objectIDFields: ['createdBy', 'lastChangedBy']
      }, { sort: dbParams.sort });
    }
    // Site Area
    if (params.withSiteArea) {
      DatabaseUtils.pushSiteAreaLookupInAggregation({
        tenantID: tenant.id, aggregation: aggregation, localField: 'siteAreaID', foreignField: '_id',
        asField: 'siteArea', oneToOneCardinality: true
      });
    }
    // Site
    if (params.withSite) {
      DatabaseUtils.pushSiteLookupInAggregation({
        tenantID: tenant.id, aggregation: aggregation, localField: 'siteID', foreignField: '_id',
        asField: 'site', oneToOneCardinality: true
      });
    }
    // Change ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Convert siteID back to string after having queried the site
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteArea.siteID');
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenant.id, aggregation);
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'companyID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteAreaID');
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Reorder connector ID
    if (!Utils.hasValidGpsCoordinates(params.locCoordinates)) {
      aggregation.push({
        $sort: dbParams.sort
      });
    }
    // Read DB
    const chargingStationsMDB = await global.database.getCollection<any>(tenant.id, 'chargingstations')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as ChargingStation[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getChargingStations', startTime, aggregation, chargingStationsMDB);
    return {
      count: DatabaseUtils.getCountFromDatabaseCount(chargingStationsCountMDB[0]),
      result: chargingStationsMDB
    };
  }

  public static async getChargingStationsInError(tenant: Tenant,
      params: { search?: string; siteIDs?: string[]; siteAreaIDs: string[]; errorType?: string[] },
      dbParams: DbParams, projectFields?: string[]): Promise<ChargingStationInErrorDataResult> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Create Aggregation
    const aggregation = [];
    // Add Charging Station inactive flag
    DatabaseUtils.pushChargingStationInactiveFlagInAggregation(aggregation);
    // Set the filters
    const filters: FilterParams = {};
    // Search filters
    if (params.search) {
      filters.$or = [
        { _id: { $regex: params.search, $options: 'im' } },
        { chargePointModel: { $regex: params.search, $options: 'im' } },
        { chargePointVendor: { $regex: params.search, $options: 'im' } }
      ];
    }
    // Remove deleted
    filters.deleted = { '$ne': true };
    // Issuer
    filters.issuer = true;
    // Site Areas
    if (!Utils.isEmptyArray(params.siteAreaIDs)) {
      filters.siteAreaID = { $in: params.siteAreaIDs.map((id) => DatabaseUtils.convertToObjectID(id)) };
    }
    // Add in aggregation
    aggregation.push({
      $match: filters
    });
    // Build lookups to fetch sites from chargers
    aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenant.id, 'siteareas'),
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
            $in: params.siteIDs.map((id) => DatabaseUtils.convertToObjectID(id))
          }
        }
      });
    }
    // Build facets for each type of error if any
    const facets: any = { $facet: {} };
    if (!Utils.isEmptyArray(params.errorType)) {
      // Check allowed
      if (!Utils.isTenantComponentActive(tenant, TenantComponents.ORGANIZATION)
        && params.errorType.includes(ChargingStationInErrorType.MISSING_SITE_AREA)) {
        throw new BackendError({
          module: MODULE_NAME,
          method: 'getChargingStationsInError',
          message: 'Organization is not active whereas filter is on missing site.'
        });
      }
      // Build facet only for one error type
      const array = [];
      for (const type of params.errorType) {
        array.push(`$${type}`);
        facets.$facet[type] = ChargingStationStorage.getChargerInErrorFacet(type);
      }
      aggregation.push(facets);
      // Manipulate the results to convert it to an array of document on root level
      aggregation.push({ $project: { chargersInError: { $setUnion: array } } });
      aggregation.push({ $unwind: '$chargersInError' });
      aggregation.push({ $replaceRoot: { newRoot: '$chargersInError' } });
      // Add a unique identifier as we may have the same Charging Station several time
      aggregation.push({ $addFields: { 'uniqueId': { $concat: ['$_id', '#', '$errorCode'] } } });
    }
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenant.id, aggregation);
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
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const chargingStationsMDB = await global.database.getCollection<any>(tenant.id, 'chargingstations')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as ChargingStation[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getChargingStationsInError', startTime, aggregation, chargingStationsMDB);
    return {
      count: chargingStationsMDB.length,
      result: chargingStationsMDB
    };
  }

  public static async saveChargingStation(tenant: Tenant, chargingStationToSave: ChargingStation): Promise<string> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Remove old field
    delete chargingStationToSave['registrationStatus'];
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
      companyID: DatabaseUtils.convertToObjectID(chargingStationToSave.companyID),
      siteID: DatabaseUtils.convertToObjectID(chargingStationToSave.siteID),
      siteAreaID: DatabaseUtils.convertToObjectID(chargingStationToSave.siteAreaID),
      chargePointSerialNumber: chargingStationToSave.chargePointSerialNumber,
      chargePointModel: chargingStationToSave.chargePointModel,
      chargeBoxSerialNumber: chargingStationToSave.chargeBoxSerialNumber,
      chargePointVendor: chargingStationToSave.chargePointVendor,
      iccid: chargingStationToSave.iccid,
      imsi: chargingStationToSave.imsi,
      tokenID: chargingStationToSave.tokenID,
      meterType: chargingStationToSave.meterType,
      firmwareVersion: chargingStationToSave.firmwareVersion,
      meterSerialNumber: chargingStationToSave.meterSerialNumber,
      endpoint: chargingStationToSave.endpoint,
      ocppVersion: chargingStationToSave.ocppVersion,
      cloudHostIP: chargingStationToSave.cloudHostIP,
      cloudHostName: chargingStationToSave.cloudHostName,
      ocppProtocol: chargingStationToSave.ocppProtocol,
      lastSeen: Utils.convertToDate(chargingStationToSave.lastSeen),
      deleted: Utils.convertToBoolean(chargingStationToSave.deleted),
      lastReboot: Utils.convertToDate(chargingStationToSave.lastReboot),
      chargingStationURL: chargingStationToSave.chargingStationURL,
      maximumPower: Utils.convertToInt(chargingStationToSave.maximumPower),
      masterSlave: Utils.convertToBoolean(chargingStationToSave.masterSlave),
      excludeFromSmartCharging: Utils.convertToBoolean(chargingStationToSave.excludeFromSmartCharging),
      forceInactive: Utils.convertToBoolean(chargingStationToSave.forceInactive),
      manualConfiguration: Utils.convertToBoolean(chargingStationToSave.manualConfiguration),
      powerLimitUnit: chargingStationToSave.powerLimitUnit,
      voltage: Utils.convertToInt(chargingStationToSave.voltage),
      connectors: chargingStationToSave.connectors ? chargingStationToSave.connectors.map(
        (connector) => ChargingStationStorage.filterConnectorMDB(connector)) : [],
      backupConnectors: chargingStationToSave.backupConnectors ? chargingStationToSave.backupConnectors.map(
        (backupConnector) => ChargingStationStorage.filterConnectorMDB(backupConnector)) : [],
      chargePoints: chargingStationToSave.chargePoints ? chargingStationToSave.chargePoints.map(
        (chargePoint) => ChargingStationStorage.filterChargePointMDB(chargePoint)) : [],
      coordinates: Utils.hasValidGpsCoordinates(chargingStationToSave.coordinates) ? chargingStationToSave.coordinates.map(
        (coordinate) => Utils.convertToFloat(coordinate)) : [],
      currentIPAddress: chargingStationToSave.currentIPAddress,
      capabilities: chargingStationToSave.capabilities,
      ocppStandardParameters: chargingStationToSave.ocppStandardParameters,
      ocppVendorParameters: chargingStationToSave.ocppVendorParameters,
      tariffID: chargingStationToSave.tariffID,
    };
    // Add Created/LastChanged By
    DatabaseUtils.addLastChangedCreatedProps(chargingStationMDB, chargingStationToSave);
    // Modify and return the modified document
    await global.database.getCollection<any>(tenant.id, 'chargingstations').findOneAndUpdate(
      { _id: chargingStationToSave.id },
      { $set: chargingStationMDB },
      { upsert: true });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveChargingStation', startTime, chargingStationMDB);
    return chargingStationMDB._id;
  }

  public static async saveChargingStationConnectors(tenant: Tenant, id: string, connectors: Connector[], backupConnectors?: Connector[]): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    const updatedProps: any = {};
    // Set connectors
    updatedProps.connectors = connectors.map((connector) =>
      ChargingStationStorage.filterConnectorMDB(connector));
    // Set backup connector
    if (backupConnectors) {
      updatedProps.backupConnectors = backupConnectors.map((backupConnector) =>
        ChargingStationStorage.filterConnectorMDB(backupConnector));
    }
    // Modify document
    await global.database.getCollection<any>(tenant.id, 'chargingstations').findOneAndUpdate(
      { '_id': id },
      {
        $set: updatedProps
      },
      { upsert: true });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveChargingStationConnectors', startTime, connectors);
  }

  public static async saveChargingStationOicpData(tenant: Tenant, id: string,
      oicpData: ChargingStationOicpData): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Modify document
    await global.database.getCollection<any>(tenant.id, 'chargingstations').findOneAndUpdate(
      { '_id': id },
      {
        $set: {
          oicpData
        }
      },
      { upsert: false });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveChargingStationOicpData', startTime, oicpData);
  }

  public static async saveChargingStationRuntimeData(tenant: Tenant, id: string,
      runtimeData: { lastSeen?: Date; currentIPAddress?: string | string[]; tokenID?: string; cloudHostIP?: string; cloudHostName?: string; }): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    const runtimeDataMDB: { lastSeen?: Date; currentIPAddress?: string | string[]; tokenID?: string; cloudHostIP?: string; cloudHostName?: string; } = {};
    if (runtimeData.lastSeen) {
      runtimeDataMDB.lastSeen = Utils.convertToDate(runtimeData.lastSeen);
    }
    if (runtimeData.currentIPAddress) {
      runtimeDataMDB.currentIPAddress = runtimeData.currentIPAddress;
    }
    if (runtimeData.tokenID) {
      runtimeDataMDB.tokenID = runtimeData.tokenID;
    }
    if (runtimeData.cloudHostIP || runtimeData.cloudHostName) {
      runtimeDataMDB.cloudHostIP = runtimeData.cloudHostIP;
      runtimeDataMDB.cloudHostName = runtimeData.cloudHostName;
    }
    // Modify document
    await global.database.getCollection<any>(tenant.id, 'chargingstations').findOneAndUpdate(
      { '_id': id },
      { $set: runtimeDataMDB },
      { upsert: true });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveChargingStationRuntimeData', startTime, runtimeData);
  }

  public static async saveChargingStationOcpiData(tenant: Tenant, id: string, ocpiData: ChargingStationOcpiData): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Modify document
    await global.database.getCollection<any>(tenant.id, 'chargingstations').findOneAndUpdate(
      { '_id': id },
      {
        $set: {
          ocpiData
        }
      },
      { upsert: false });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveChargingStationOcpiData', startTime, ocpiData);
  }

  public static async saveChargingStationRemoteAuthorizations(tenant: Tenant, id: string,
      remoteAuthorizations: RemoteAuthorization[]): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Modify document
    await global.database.getCollection<any>(tenant.id, 'chargingstations').findOneAndUpdate(
      { '_id': id },
      {
        $set: {
          remoteAuthorizations
        }
      },
      { upsert: false });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveChargingStationRemoteAuthorizations', startTime, remoteAuthorizations);
  }

  public static async saveChargingStationFirmwareStatus(tenant: Tenant, id: string, firmwareUpdateStatus: OCPPFirmwareStatus): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Modify document
    await global.database.getCollection<any>(tenant.id, 'chargingstations').findOneAndUpdate(
      { '_id': id },
      { $set: { firmwareUpdateStatus } },
      { upsert: true });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveChargingStationFirmwareStatus', startTime, firmwareUpdateStatus);
  }

  public static async deleteChargingStation(tenant: Tenant, id: string): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Delete Configuration
    await global.database.getCollection<any>(tenant.id, 'configurations')
      .findOneAndDelete({ '_id': id });
    // Delete Charging Profiles
    await ChargingStationStorage.deleteChargingProfiles(tenant, id);
    // Delete Charging Station
    await global.database.getCollection<any>(tenant.id, 'chargingstations')
      .findOneAndDelete({ '_id': id });
    // Keep the rest (boot notification, authorize...)
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'deleteChargingStation', startTime, { id });
  }

  public static async getOcppParameterValue(tenant: Tenant, chargeBoxID: string, paramName: string): Promise<string> {
    const configuration = await ChargingStationStorage.getOcppParameters(tenant, chargeBoxID);
    let value: string = null;
    if (configuration) {
      // Get the value
      configuration.result.every((param) => {
        if (param.key === paramName) {
          value = param.value;
          return false;
        }
        return true;
      });
    }
    return value;
  }

  public static async saveOcppParameters(tenant: Tenant, parameters: ChargingStationOcppParameters): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Modify
    await global.database.getCollection<any>(tenant.id, 'configurations').findOneAndUpdate({
      '_id': parameters.id
    }, {
      $set: {
        configuration: parameters.configuration,
        timestamp: Utils.convertToDate(parameters.timestamp)
      }
    }, {
      upsert: true,
      returnDocument: 'after'
    });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveOcppParameters', startTime, parameters);
  }

  public static async getOcppParameters(tenant: Tenant, id: string): Promise<DataResult<OcppParameter>> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Read DB
    const parametersMDB = await global.database.getCollection<any>(tenant.id, 'configurations')
      .findOne({ '_id': id }) as ChargingStationOcppParameters;
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
      await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getOcppParameters', startTime, { id }, parametersMDB);
      return {
        count: parametersMDB.configuration.length,
        result: parametersMDB.configuration
      };
    }
    // No conf
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getOcppParameters', startTime, { id }, parametersMDB);
    return {
      count: 0,
      result: []
    };
  }

  public static async getChargingProfiles(tenant: Tenant,
      params: { search?: string; chargingStationIDs?: string[]; connectorID?: number; chargingProfileID?: string;
        profilePurposeType?: ChargingProfilePurposeType; transactionId?: number;
        withSiteArea?: boolean; siteIDs?: string[]; } = {},
      dbParams: DbParams, projectFields?: string[]): Promise<ChargingProfileDataResult> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Query by chargingStationID
    const filters: FilterParams = {};
    // Build filter
    if (params.search) {
      filters.$or = [
        { 'chargingStationID': { $regex: params.search, $options: 'i' } },
        { 'profile.transactionId': Utils.convertToInt(params.search) },
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
    // Charging Stations
    DatabaseUtils.pushChargingStationLookupInAggregation({
      tenantID: tenant.id, aggregation, localField: 'chargingStationID', foreignField: '_id',
      asField: 'chargingStation', oneToOneCardinality: true, oneToOneCardinalityNotNull: false
    });
    // Site Areas
    if (params.withSiteArea) {
      DatabaseUtils.pushSiteAreaLookupInAggregation({
        tenantID: tenant.id, aggregation, localField: 'chargingStation.siteAreaID', foreignField: '_id',
        asField: 'chargingStation.siteArea', oneToOneCardinality: true, oneToOneCardinalityNotNull: false
      });
      // Convert
      DatabaseUtils.pushConvertObjectIDToString(aggregation, 'chargingStation.siteArea.siteID');
    }
    // Convert
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'chargingStation.siteAreaID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'chargingStation.siteID');
    // Site ID
    if (!Utils.isEmptyArray(params.siteIDs)) {
      // Build filter
      aggregation.push({
        $match: {
          'chargingStation.siteID': {
            $in: params.siteIDs
          }
        }
      });
    }
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const chargingProfilesCountMDB = await global.database.getCollection<any>(tenant.id, 'chargingprofiles')
      .aggregate([...aggregation, { $count: 'count' }], DatabaseUtils.buildAggregateOptions())
      .toArray() as DatabaseCount[];
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getChargingProfiles', startTime, aggregation, chargingProfilesCountMDB);
      return {
        count: (chargingProfilesCountMDB.length > 0 ? chargingProfilesCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenant.id, aggregation);
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
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const chargingProfilesMDB = await global.database.getCollection<any>(tenant.id, 'chargingprofiles')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as ChargingProfile[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getChargingProfiles', startTime, aggregation, chargingProfilesMDB);
    return {
      count: DatabaseUtils.getCountFromDatabaseCount(chargingProfilesCountMDB[0]),
      result: chargingProfilesMDB
    };
  }

  public static async saveChargingProfile(tenant: Tenant, chargingProfileToSave: ChargingProfile): Promise<string> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    const chargingProfileFilter: any = {};
    // Build Request
    if (chargingProfileToSave.id) {
      chargingProfileFilter._id = chargingProfileToSave.id;
    } else {
      chargingProfileFilter._id =
      Utils.hash(`${chargingProfileToSave.chargingStationID}~${chargingProfileToSave.connectorID}~${chargingProfileToSave.profile.chargingProfileId}`);
    }
    // Properties to save
    const chargingProfileMDB: any = {
      _id: chargingProfileFilter._id,
      chargingStationID: chargingProfileToSave.chargingStationID,
      connectorID: Utils.convertToInt(chargingProfileToSave.connectorID),
      chargePointID: Utils.convertToInt(chargingProfileToSave.chargePointID),
      profile: chargingProfileToSave.profile
    };
    await global.database.getCollection<any>(tenant.id, 'chargingprofiles').findOneAndUpdate(
      chargingProfileFilter,
      { $set: chargingProfileMDB },
      { upsert: true });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveChargingProfile', startTime, chargingProfileMDB);
    return chargingProfileFilter._id as string;
  }

  public static async deleteChargingProfile(tenant: Tenant, id: string): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Delete Charging Profile
    await global.database.getCollection<any>(tenant.id, 'chargingprofiles')
      .findOneAndDelete({ '_id': id });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'deleteChargingProfile', startTime, { id });
  }

  public static async deleteChargingProfiles(tenant: Tenant, chargingStationID: string): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Delete Charging Profiles
    await global.database.getCollection<any>(tenant.id, 'chargingprofiles')
      .findOneAndDelete({ 'chargingStationID': chargingStationID });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'deleteChargingProfiles', startTime, { chargingStationID });
  }

  public static getChargingStationFirmware(filename: string): GridFSBucketReadStream {
    const startTime = Logging.traceDatabaseRequestStart();
    // Get the bucket
    const bucket: GridFSBucket = global.database.getGridFSBucket('default.firmwares');
    // Get the file
    const firmware = bucket.openDownloadStreamByName(filename);
    void Logging.traceDatabaseRequestEnd(Constants.DEFAULT_TENANT_OBJECT, MODULE_NAME, 'getChargingStationFirmware', startTime, filename, firmware);
    return firmware;
  }

  public static putChargingStationFirmware(filename: string): GridFSBucketWriteStream {
    const startTime = Logging.traceDatabaseRequestStart();
    // Get the bucket
    const bucket: GridFSBucket = global.database.getGridFSBucket('default.firmwares');
    // Put the file
    const firmware = bucket.openUploadStream(filename);
    void Logging.traceDatabaseRequestEnd(Constants.DEFAULT_TENANT_OBJECT, MODULE_NAME, 'putChargingStationFirmware', startTime, filename, firmware);
    return firmware;
  }

  public static async updateChargingStationsWithOrganizationIDs(tenant: Tenant, companyID: string, siteID: string, siteAreaID?: string): Promise<number> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    let result: UpdateResult;
    if (siteAreaID) {
      result = await global.database.getCollection<any>(tenant.id, 'chargingstations').updateMany(
        {
          siteAreaID: DatabaseUtils.convertToObjectID(siteAreaID),
        },
        {
          $set: {
            siteID: DatabaseUtils.convertToObjectID(siteID),
            companyID: DatabaseUtils.convertToObjectID(companyID)
          }
        }) as UpdateResult;
    } else {
      result = await global.database.getCollection<any>(tenant.id, 'chargingstations').updateMany(
        {
          siteID: DatabaseUtils.convertToObjectID(siteID),
        },
        {
          $set: {
            companyID: DatabaseUtils.convertToObjectID(companyID)
          }
        }) as UpdateResult;
    }
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'updateChargingStationsWithOrganizationIDs', startTime, { siteID, companyID, siteAreaID });
    return result.modifiedCount;
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
        const inactiveDate = new Date(new Date().getTime() - Configuration.getChargingStationConfig().maxLastSeenIntervalSecs * 1000);
        return [
          { $match: { 'lastSeen': { $lte: inactiveDate } } },
          { $addFields: { 'errorCode': ChargingStationInErrorType.CONNECTION_BROKEN } }
        ];
      }
      case ChargingStationInErrorType.CONNECTOR_ERROR:
        return [
          { $match: { $or: [{ 'connectors.errorCode': { $ne: 'NoError' } }, { 'connectors.status': { $eq: ChargePointStatus.FAULTED } }] } },
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

  private static filterConnectorMDB(connector: Connector): ConnectorMDB {
    if (connector) {
      const filteredConnector: ConnectorMDB = {
        id: connector.id,
        connectorId: Utils.convertToInt(connector.connectorId),
        currentInstantWatts: Utils.convertToFloat(connector.currentInstantWatts),
        currentStateOfCharge: connector.currentStateOfCharge,
        currentTotalInactivitySecs: Utils.convertToInt(connector.currentTotalInactivitySecs),
        currentTotalConsumptionWh: Utils.convertToFloat(connector.currentTotalConsumptionWh),
        currentTransactionDate: Utils.convertToDate(connector.currentTransactionDate),
        currentTagID: connector.currentTagID,
        currentTransactionID: Utils.convertToInt(connector.currentTransactionID),
        currentUserID: DatabaseUtils.convertToObjectID(connector.currentUserID),
        status: connector.status,
        errorCode: connector.errorCode,
        info: connector.info,
        vendorErrorCode: connector.vendorErrorCode,
        power: Utils.convertToInt(connector.power),
        type: connector.type,
        voltage: Utils.convertToInt(connector.voltage),
        amperage: Utils.convertToInt(connector.amperage),
        amperageLimit: Utils.convertToInt(connector.amperageLimit),
        statusLastChangedOn: Utils.convertToDate(connector.statusLastChangedOn),
        currentInactivityStatus: connector.currentInactivityStatus,
        numberOfConnectedPhase: connector.numberOfConnectedPhase,
        currentType: connector.currentType,
        chargePointID: connector.chargePointID,
        tariffID: connector.tariffID,
        phaseAssignmentToGrid: connector.phaseAssignmentToGrid &&
          {
            csPhaseL1: connector.phaseAssignmentToGrid.csPhaseL1,
            csPhaseL2: connector.phaseAssignmentToGrid.csPhaseL2,
            csPhaseL3: connector.phaseAssignmentToGrid.csPhaseL3,
          },
      };
      return filteredConnector;
    }
    return null;
  }

  private static filterChargePointMDB(chargePoint: ChargePoint): ChargePoint {
    if (chargePoint) {
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
    return null;
  }
}
