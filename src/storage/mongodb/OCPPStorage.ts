import { OCPPAuthorizeRequestExtended, OCPPBootNotificationRequestExtended, OCPPDataTransferRequestExtended, OCPPDiagnosticsStatusNotificationRequestExtended, OCPPFirmwareStatusNotificationRequestExtended, OCPPHeartbeatRequestExtended, OCPPNormalizedMeterValue, OCPPNormalizedMeterValues, OCPPStatusNotificationRequestExtended } from '../../types/ocpp/OCPPServer';
import global, { DatabaseCount, FilterParams } from '../../types/GlobalType';

import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'OCPPStorage';

export default class OCPPStorage {
  public static async saveAuthorize(tenant: Tenant, authorize: OCPPAuthorizeRequestExtended): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    const timestamp = Utils.convertToDate(authorize.timestamp);
    const authorizeMDB: any = {
      _id: Utils.hash(`${authorize.chargeBoxID}~${timestamp.toISOString()}`),
      tagID: authorize.idTag,
      authorizationId: authorize.authorizationId,
      chargeBoxID: authorize.chargeBoxID,
      userID: authorize.user ? DatabaseUtils.convertToObjectID(authorize.user.id) : null,
      timestamp: timestamp,
      timezone: authorize.timezone
    };
    // Insert
    await global.database.getCollection<any>(tenant.id, 'authorizes')
      .insertOne(authorizeMDB);
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveAuthorize', startTime, authorizeMDB);
  }

  public static async getAuthorizes(tenant: Tenant, params: {dateFrom?: Date; chargeBoxID?: string; tagID?: string},
      dbParams: DbParams): Promise<DataResult<OCPPAuthorizeRequestExtended>> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Set the filters
    const filters: FilterParams = {};
    // Date from provided?
    if (params.dateFrom) {
      filters.timestamp = {};
      filters.timestamp.$gte = new Date(params.dateFrom);
    }
    // Charging Station
    if (params.chargeBoxID) {
      filters.chargeBoxID = params.chargeBoxID;
    }
    // Tag ID
    if (params.tagID) {
      filters.tagID = params.tagID;
    }
    // Create Aggregation
    const aggregation = [];
    // Filters
    if (filters) {
      aggregation.push({
        $match: filters
      });
    }
    // Count Records
    const authorizesCountMDB = await global.database.getCollection<any>(tenant.id, 'authorizes')
      .aggregate([...aggregation, { $count: 'count' }], DatabaseUtils.buildAggregateOptions())
      .toArray() as DatabaseCount[];
    // Sort
    if (!dbParams.sort) {
      dbParams.sort = { timestamp: -1 };
    }
    // Sort
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
    // Read DB
    const authorizesMDB = await global.database.getCollection<any>(tenant.id, 'authorizes')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as OCPPAuthorizeRequestExtended[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getAuthorizes', startTime, aggregation, authorizesMDB);
    return {
      count: (authorizesCountMDB.length > 0 ? authorizesCountMDB[0].count : 0),
      result: authorizesMDB
    };
  }

  public static async saveHeartbeat(tenant: Tenant, heartbeat: OCPPHeartbeatRequestExtended): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    const timestamp = Utils.convertToDate(heartbeat.timestamp);
    // Insert
    const heartBeatMDB: any = {
      _id: Utils.hash(`${heartbeat.chargeBoxID}~${timestamp.toISOString()}`),
      chargeBoxID: heartbeat.chargeBoxID,
      timestamp: timestamp,
      timezone: heartbeat.timezone
    };
    await global.database.getCollection<any>(tenant.id, 'heartbeats')
      .insertOne(heartBeatMDB);
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveHeartbeat', startTime, heartBeatMDB);
  }

  public static async getStatusNotifications(tenant: Tenant,
      params: { dateFrom?: Date; chargeBoxID?: string; connectorId?: number; status?: string },
      dbParams: DbParams, projectFields?: string[]): Promise<DataResult<OCPPStatusNotificationRequestExtended>> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Set the filters
    const filters: FilterParams = {};
    // Date from provided?
    if (params.dateFrom) {
      filters.timestamp = {};
      filters.timestamp.$gte = new Date(params.dateFrom);
    }
    // Charging Station
    if (params.chargeBoxID) {
      filters.chargeBoxID = params.chargeBoxID;
    }
    // Connector ID
    if (params.connectorId) {
      filters.connectorId = params.connectorId;
    }
    // Status
    if (params.status) {
      filters.status = params.status;
    }
    // Create Aggregation
    const aggregation = [];
    // Filters
    if (filters) {
      aggregation.push({
        $match: filters
      });
    }
    // Count Records
    const statusNotificationsCountMDB = await global.database.getCollection<any>(tenant.id, 'statusnotifications')
      .aggregate([...aggregation, { $count: 'count' }], DatabaseUtils.buildAggregateOptions())
      .toArray() as DatabaseCount[];
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
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
    // Read DB
    const statusNotificationsMDB = await global.database.getCollection<any>(tenant.id, 'statusnotifications')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as OCPPStatusNotificationRequestExtended[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getStatusNotifications', startTime, aggregation, statusNotificationsMDB);
    return {
      count: (statusNotificationsCountMDB.length > 0 ? statusNotificationsCountMDB[0].count : 0),
      result: statusNotificationsMDB
    };
  }

  public static async getLastStatusNotifications(tenant: Tenant,
      params: { dateBefore?: string; chargeBoxID?: string; connectorId?: number; status?: string }):
      Promise<OCPPStatusNotificationRequestExtended[]> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Set the filters
    const filters: FilterParams = {};
    // Date before provided?
    if (params.dateBefore) {
      filters.timestamp = {};
      filters.timestamp.$lte = new Date(params.dateBefore);
    }
    // Charging Station
    if (params.chargeBoxID) {
      filters.chargeBoxID = params.chargeBoxID;
    }
    // Connector ID
    if (params.connectorId) {
      filters.connectorId = params.connectorId;
    }
    // Status
    if (params.status) {
      filters.status = params.status;
    }
    // Create Aggregation
    const aggregation = [];
    // Filters
    if (filters) {
      aggregation.push({
        $match: filters
      });
    }
    // Sort
    aggregation.push({ $sort: { 'timestamp': -1 } });
    // Skip
    aggregation.push({ $skip: 0 });
    // Limit
    aggregation.push({ $limit: 1 });
    // Read DB
    const statusNotificationsMDB = await global.database.getCollection<any>(tenant.id, 'statusnotifications')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as OCPPStatusNotificationRequestExtended[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getLastStatusNotifications', startTime, aggregation, statusNotificationsMDB);
    return statusNotificationsMDB;
  }

  public static async saveStatusNotification(tenant: Tenant, statusNotificationToSave: OCPPStatusNotificationRequestExtended): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    // Set
    const timestamp = Utils.convertToDate(statusNotificationToSave.timestamp);
    DatabaseUtils.checkTenantObject(tenant);
    const statusNotificationMDB: any = {
      _id: Utils.hash(`${statusNotificationToSave.chargeBoxID}~${statusNotificationToSave.connectorId}~${statusNotificationToSave.status}~${timestamp.toISOString()}`),
      timestamp,
      chargeBoxID: statusNotificationToSave.chargeBoxID,
      connectorId: Utils.convertToInt(statusNotificationToSave.connectorId),
      timezone: statusNotificationToSave.timezone,
      status: statusNotificationToSave.status,
      errorCode: statusNotificationToSave.errorCode,
      info: statusNotificationToSave.info,
      vendorId: statusNotificationToSave.vendorId,
      vendorErrorCode: statusNotificationToSave.vendorErrorCode
    };
    // Insert
    await global.database.getCollection<any>(tenant.id, 'statusnotifications')
      .insertOne(statusNotificationMDB);
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveStatusNotification', startTime, statusNotificationMDB);
  }

  public static async saveDataTransfer(tenant: Tenant, dataTransfer: OCPPDataTransferRequestExtended): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    const timestamp = Utils.convertToDate(dataTransfer.timestamp);
    // Insert
    const dataTransferMDB: any = {
      _id: Utils.hash(`${dataTransfer.chargeBoxID}~${dataTransfer.data}~${timestamp.toISOString()}`),
      vendorId: dataTransfer.vendorId,
      messageId: dataTransfer.messageId,
      data: dataTransfer.data,
      chargeBoxID: dataTransfer.chargeBoxID,
      timestamp: timestamp,
      timezone: dataTransfer.timezone
    };
    await global.database.getCollection<any>(tenant.id, 'datatransfers')
      .insertOne(dataTransferMDB);
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveDataTransfer', startTime, dataTransferMDB);
  }

  public static async saveBootNotification(tenant: Tenant, bootNotification: OCPPBootNotificationRequestExtended): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    const timestamp = Utils.convertToDate(bootNotification.timestamp);
    // Insert
    const bootNotificationMDB: any = {
      _id: Utils.hash(`${bootNotification.chargeBoxID}~${timestamp.toISOString()}`),
      chargeBoxID: bootNotification.chargeBoxID,
      chargePointVendor: bootNotification.chargePointVendor,
      chargePointModel: bootNotification.chargePointModel,
      chargePointSerialNumber: bootNotification.chargePointSerialNumber,
      chargeBoxSerialNumber: bootNotification.chargeBoxSerialNumber,
      firmwareVersion: bootNotification.firmwareVersion,
      ocppVersion: bootNotification.ocppVersion,
      ocppProtocol: bootNotification.ocppProtocol,
      endpoint: bootNotification.endpoint,
      timestamp: timestamp
    };
    await global.database.getCollection<any>(tenant.id, 'bootnotifications')
      .insertOne(bootNotificationMDB);
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveBootNotification', startTime, bootNotificationMDB);
  }

  public static async getBootNotifications(tenant: Tenant, params: {chargeBoxID?: string},
      dbParams: DbParams, projectFields?: string[]): Promise<DataResult<OCPPBootNotificationRequestExtended>> {
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
    // Set the filters
    const filters: FilterParams = {};
    // Remove deleted
    filters.deleted = { '$ne': true };
    // Charging Station ID
    if (params.chargeBoxID) {
      filters._id = params.chargeBoxID;
    }
    // Filters
    aggregation.push({
      $match: filters
    });
    // Count Records
    const bootNotificationsCountMDB = await global.database.getCollection<any>(tenant.id, 'bootnotifications')
      .aggregate([...aggregation, { $count: 'count' }], DatabaseUtils.buildAggregateOptions())
      .toArray() as DatabaseCount[];
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenant.id, aggregation);
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
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
    // Read DB
    const bootNotificationsMDB = await global.database.getCollection<any>(tenant.id, 'bootnotifications')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as OCPPBootNotificationRequestExtended[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getBootNotifications', startTime, aggregation, bootNotificationsMDB);
    return {
      count: (bootNotificationsCountMDB.length > 0 ? bootNotificationsCountMDB[0].count : 0),
      result: bootNotificationsMDB
    };
  }

  public static async saveDiagnosticsStatusNotification(tenant: Tenant, diagnosticsStatusNotification: OCPPDiagnosticsStatusNotificationRequestExtended): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    const timestamp = Utils.convertToDate(diagnosticsStatusNotification.timestamp);
    // Insert
    const diagnosticsStatusNotificationMDB: any = {
      _id: Utils.hash(`${diagnosticsStatusNotification.chargeBoxID}~${timestamp.toISOString()}`),
      chargeBoxID: diagnosticsStatusNotification.chargeBoxID,
      status: diagnosticsStatusNotification.status,
      timestamp: timestamp,
      timezone: diagnosticsStatusNotification.timezone
    };
    await global.database.getCollection<any>(tenant.id, 'diagnosticsstatusnotifications')
      .insertOne(diagnosticsStatusNotificationMDB);
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveDiagnosticsStatusNotification', startTime, diagnosticsStatusNotificationMDB);
  }

  public static async saveFirmwareStatusNotification(tenant: Tenant, firmwareStatusNotification: OCPPFirmwareStatusNotificationRequestExtended): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    const timestamp = Utils.convertToDate(firmwareStatusNotification.timestamp);
    // Insert
    const firmwareStatusNotificationMDB: any = {
      _id: Utils.hash(`${firmwareStatusNotification.chargeBoxID}~${timestamp.toISOString()}`),
      chargeBoxID: firmwareStatusNotification.chargeBoxID,
      status: firmwareStatusNotification.status,
      timestamp: timestamp,
      timezone: firmwareStatusNotification.timezone
    };
    await global.database.getCollection<any>(tenant.id, 'firmwarestatusnotifications')
      .insertOne(firmwareStatusNotificationMDB);
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveFirmwareStatusNotification', startTime, firmwareStatusNotificationMDB);
  }

  public static async saveMeterValues(tenant: Tenant, meterValuesToSave: OCPPNormalizedMeterValues): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Save all
    for (const meterValueToSave of meterValuesToSave.values) {
      const timestamp = Utils.convertToDate(meterValueToSave.timestamp);
      const meterValueMDB: any = {
        _id: Utils.hash(`${meterValueToSave.chargeBoxID}~${meterValueToSave.connectorId}~${timestamp.toISOString()}~${meterValueToSave.value}~${JSON.stringify(meterValueToSave.attribute)}`),
        chargeBoxID: meterValueToSave.chargeBoxID,
        connectorId: Utils.convertToInt(meterValueToSave.connectorId),
        transactionId: Utils.convertToInt(meterValueToSave.transactionId),
        timestamp,
        value: meterValueToSave.attribute.format === 'SignedData' ? meterValueToSave.value : Utils.convertToInt(meterValueToSave.value),
        attribute: meterValueToSave.attribute,
      };
      // Execute
      await global.database.getCollection<any>(tenant.id, 'metervalues').insertOne(meterValueMDB);
    }
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveMeterValues', startTime, meterValuesToSave);
  }

  public static async getMeterValues(tenant: Tenant, params: { transactionId: number },
      dbParams: DbParams): Promise<DataResult<OCPPNormalizedMeterValue>> {
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
    const filters: FilterParams = {};
    // Charging Station ID
    if (params.transactionId) {
      filters.transactionId = params.transactionId;
    }
    // Filters
    aggregation.push({
      $match: filters
    });
    // Count Records
    const meterValuesCountMDB = await global.database.getCollection<any>(tenant.id, 'metervalues')
      .aggregate([...aggregation, { $count: 'count' }], DatabaseUtils.buildAggregateOptions())
      .toArray() as DatabaseCount[];
    // Sort
    if (!dbParams.sort) {
      dbParams.sort = { timestamp: 1 };
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
    // Read DB
    const meterValuesMDB = await global.database.getCollection<any>(tenant.id, 'metervalues')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as OCPPNormalizedMeterValue[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getMeterValues', startTime, aggregation, meterValuesMDB);
    return {
      count: (meterValuesCountMDB.length > 0 ? meterValuesCountMDB[0].count : 0),
      result: meterValuesMDB
    };
  }
}
