import { OCPPAuthorizeRequestExtended, OCPPBootNotificationRequestExtended, OCPPDataTransferRequestExtended, OCPPDiagnosticsStatusNotificationRequestExtended, OCPPFirmwareStatusNotificationRequestExtended, OCPPHeartbeatRequestExtended, OCPPNormalizedMeterValue, OCPPNormalizedMeterValues, OCPPReadingContext, OCPPStatusNotificationRequestExtended } from '../../types/ocpp/OCPPServer';
import global, { FilterParams } from '../../types/GlobalType';

import Cypher from '../../utils/Cypher';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'OCPPStorage';

export default class OCPPStorage {
  public static async saveAuthorize(tenant: Tenant, authorize: OCPPAuthorizeRequestExtended): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenant.id, MODULE_NAME, 'saveAuthorize');
    // Check Tenant
    DatabaseUtils.checkTenantObject(tenant);
    const timestamp = Utils.convertToDate(authorize.timestamp);
    // Insert
    await global.database.getCollection<any>(tenant.id, 'authorizes')
      .insertOne({
        _id: Cypher.hash(`${authorize.chargeBoxID}~${timestamp.toISOString()}`),
        tagID: authorize.idTag,
        authorizationId: authorize.authorizationId,
        chargeBoxID: authorize.chargeBoxID,
        userID: authorize.user ? DatabaseUtils.convertToObjectID(authorize.user.id) : null,
        timestamp: timestamp,
        timezone: authorize.timezone
      });
    // Debug
    await Logging.traceEnd(tenant.id, MODULE_NAME, 'saveAuthorize', uniqueTimerID, authorize);
  }

  public static async getAuthorizes(tenant: Tenant, params: {dateFrom?: Date; chargeBoxID?: string; tagID?: string},
      dbParams: DbParams): Promise<DataResult<OCPPAuthorizeRequestExtended>> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenant.id, MODULE_NAME, 'getAuthorizes');
    // Check Tenant
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
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
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
      .aggregate(aggregation, {
        allowDiskUse: true
      })
      .toArray();
    // Debug
    await Logging.traceEnd(tenant.id, MODULE_NAME, 'getAuthorizes', uniqueTimerID, authorizesMDB);
    // Ok
    return {
      count: (authorizesCountMDB.length > 0 ? authorizesCountMDB[0].count : 0),
      result: authorizesMDB
    };
  }

  public static async saveHeartbeat(tenant: Tenant, heartbeat: OCPPHeartbeatRequestExtended): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenant.id, MODULE_NAME, 'saveHeartbeat');
    // Check Tenant
    DatabaseUtils.checkTenantObject(tenant);
    const timestamp = Utils.convertToDate(heartbeat.timestamp);
    // Insert
    await global.database.getCollection<any>(tenant.id, 'heartbeats')
      .insertOne({
        _id: Cypher.hash(`${heartbeat.chargeBoxID}~${timestamp.toISOString()}`),
        chargeBoxID: heartbeat.chargeBoxID,
        timestamp: timestamp,
        timezone: heartbeat.timezone
      });
    // Debug
    await Logging.traceEnd(tenant.id, MODULE_NAME, 'saveHeartbeat', uniqueTimerID, heartbeat);
  }

  public static async getStatusNotifications(tenant: Tenant,
      params: { dateFrom?: Date; chargeBoxID?: string; connectorId?: number; status?: string },
      dbParams: DbParams): Promise<DataResult<OCPPStatusNotificationRequestExtended>> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenant.id, MODULE_NAME, 'getStatusNotifications');
    // Check Tenant
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
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
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
      .aggregate(aggregation, {
        allowDiskUse: true
      })
      .toArray();
    // Debug
    await Logging.traceEnd(tenant.id, MODULE_NAME, 'getStatusNotifications', uniqueTimerID, statusNotificationsMDB);
    // Ok
    return {
      count: (statusNotificationsCountMDB.length > 0 ? statusNotificationsCountMDB[0].count : 0),
      result: statusNotificationsMDB
    };
  }

  public static async getLastStatusNotifications(tenant: Tenant,
      params: { dateBefore?: string; chargeBoxID?: string; connectorId?: number; status?: string }):
      Promise<OCPPStatusNotificationRequestExtended[]> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenant.id, MODULE_NAME, 'getLastStatusNotifications');
    // Check Tenant
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
      .aggregate(aggregation, {
        allowDiskUse: true
      })
      .toArray();
    // Debug
    await Logging.traceEnd(tenant.id, MODULE_NAME, 'getLastStatusNotifications', uniqueTimerID, statusNotificationsMDB);
    // Ok
    return statusNotificationsMDB;
  }

  public static async saveStatusNotification(tenant: Tenant, statusNotificationToSave: OCPPStatusNotificationRequestExtended): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenant.id, MODULE_NAME, 'saveStatusNotification');
    // Set
    const timestamp = Utils.convertToDate(statusNotificationToSave.timestamp);
    // Check Tenant
    DatabaseUtils.checkTenantObject(tenant);
    const statusNotificationMDB: any = {
      _id: Cypher.hash(`${statusNotificationToSave.chargeBoxID}~${statusNotificationToSave.connectorId}~${statusNotificationToSave.status}~${timestamp.toISOString()}`),
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
    // Debug
    await Logging.traceEnd(tenant.id, MODULE_NAME, 'saveStatusNotification', uniqueTimerID, statusNotificationMDB);
  }

  public static async saveDataTransfer(tenant: Tenant, dataTransfer: OCPPDataTransferRequestExtended): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenant.id, MODULE_NAME, 'saveDataTransfer');
    // Check Tenant
    DatabaseUtils.checkTenantObject(tenant);
    // Set the ID
    const timestamp = Utils.convertToDate(dataTransfer.timestamp);
    // Insert
    await global.database.getCollection<any>(tenant.id, 'datatransfers')
      .insertOne({
        _id: Cypher.hash(`${dataTransfer.chargeBoxID}~${dataTransfer.data}~${timestamp.toISOString()}`),
        vendorId: dataTransfer.vendorId,
        messageId: dataTransfer.messageId,
        data: dataTransfer.data,
        chargeBoxID: dataTransfer.chargeBoxID,
        timestamp: timestamp,
        timezone: dataTransfer.timezone
      });
    // Debug
    await Logging.traceEnd(tenant.id, MODULE_NAME, 'saveDataTransfer', uniqueTimerID, dataTransfer);
  }

  public static async saveBootNotification(tenant: Tenant, bootNotification: OCPPBootNotificationRequestExtended): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenant.id, MODULE_NAME, 'saveBootNotification');
    // Check Tenant
    DatabaseUtils.checkTenantObject(tenant);
    // Insert
    const timestamp = Utils.convertToDate(bootNotification.timestamp);
    await global.database.getCollection<any>(tenant.id, 'bootnotifications')
      .insertOne({
        _id: Cypher.hash(`${bootNotification.chargeBoxID}~${timestamp.toISOString()}`),
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
      });
    // Debug
    await Logging.traceEnd(tenant.id, MODULE_NAME, 'saveBootNotification', uniqueTimerID, bootNotification);
  }

  public static async getBootNotifications(tenant: Tenant, params: {chargeBoxID?: string},
      dbParams: DbParams): Promise<DataResult<OCPPBootNotificationRequestExtended>> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenant.id, MODULE_NAME, 'getBootNotifications');
    // Check Tenant
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
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
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
    // Read DB
    const bootNotificationsMDB = await global.database.getCollection<any>(tenant.id, 'bootnotifications')
      .aggregate(aggregation, {
        allowDiskUse: true
      })
      .toArray();
    // Debug
    await Logging.traceEnd(tenant.id, MODULE_NAME, 'getBootNotifications', uniqueTimerID, bootNotificationsMDB);
    // Ok
    return {
      count: (bootNotificationsCountMDB.length > 0 ? bootNotificationsCountMDB[0].count : 0),
      result: bootNotificationsMDB
    };
  }

  public static async saveDiagnosticsStatusNotification(tenant: Tenant, diagnosticsStatusNotification: OCPPDiagnosticsStatusNotificationRequestExtended): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenant.id, MODULE_NAME, 'saveDiagnosticsStatusNotification');
    // Check Tenant
    DatabaseUtils.checkTenantObject(tenant);
    const timestamp = Utils.convertToDate(diagnosticsStatusNotification.timestamp);
    // Insert
    await global.database.getCollection<any>(tenant.id, 'diagnosticsstatusnotifications')
      .insertOne({
        _id: Cypher.hash(`${diagnosticsStatusNotification.chargeBoxID}~${timestamp.toISOString()}`),
        chargeBoxID: diagnosticsStatusNotification.chargeBoxID,
        status: diagnosticsStatusNotification.status,
        timestamp: timestamp,
        timezone: diagnosticsStatusNotification.timezone
      });
    // Debug
    await Logging.traceEnd(tenant.id, MODULE_NAME, 'saveDiagnosticsStatusNotification', uniqueTimerID, diagnosticsStatusNotification);
  }

  public static async saveFirmwareStatusNotification(tenant: Tenant, firmwareStatusNotification: OCPPFirmwareStatusNotificationRequestExtended): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenant.id, MODULE_NAME, 'saveFirmwareStatusNotification');
    // Check Tenant
    DatabaseUtils.checkTenantObject(tenant);
    // Set the ID
    const timestamp = Utils.convertToDate(firmwareStatusNotification.timestamp);
    // Insert
    await global.database.getCollection<any>(tenant.id, 'firmwarestatusnotifications')
      .insertOne({
        _id: Cypher.hash(`${firmwareStatusNotification.chargeBoxID}~${timestamp.toISOString()}`),
        chargeBoxID: firmwareStatusNotification.chargeBoxID,
        status: firmwareStatusNotification.status,
        timestamp: timestamp,
        timezone: firmwareStatusNotification.timezone
      });
    // Debug
    await Logging.traceEnd(tenant.id, MODULE_NAME, 'saveFirmwareStatusNotification', uniqueTimerID, firmwareStatusNotification);
  }

  public static async saveMeterValues(tenant: Tenant, meterValuesToSave: OCPPNormalizedMeterValues): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenant.id, MODULE_NAME, 'saveMeterValues');
    // Check
    DatabaseUtils.checkTenantObject(tenant);
    // Save all
    for (const meterValueToSave of meterValuesToSave.values) {
      try {
        const timestamp = Utils.convertToDate(meterValueToSave.timestamp);
        const meterValueMDB = {
          _id: Cypher.hash(`${meterValueToSave.chargeBoxID}~${meterValueToSave.connectorId}~${timestamp.toISOString()}~${meterValueToSave.value}~${JSON.stringify(meterValueToSave.attribute)}`),
          chargeBoxID: meterValueToSave.chargeBoxID,
          connectorId: Utils.convertToInt(meterValueToSave.connectorId),
          transactionId: Utils.convertToInt(meterValueToSave.transactionId),
          timestamp,
          value: meterValueToSave.attribute.format === 'SignedData' ? meterValueToSave.value : Utils.convertToInt(meterValueToSave.value),
          attribute: meterValueToSave.attribute,
        };
        // Execute
        await global.database.getCollection<any>(tenant.id, 'metervalues').insertOne(meterValueMDB);
      } catch (error) {
        await Logging.logError({
          tenantID: tenant.id,
          source: meterValueToSave.chargeBoxID,
          module: MODULE_NAME, method: 'saveMeterValues',
          action: ServerAction.METER_VALUES,
          message: 'An error occurred while trying to save the meter value',
          detailedMessages: { error: error.stack, meterValue: meterValueToSave, meterValues: meterValuesToSave }
        });
      }
    }
    // Debug
    await Logging.traceEnd(tenant.id, MODULE_NAME, 'saveMeterValues', uniqueTimerID, meterValuesToSave);
  }

  public static async getMeterValues(tenant: Tenant, params: { transactionId: number },
      dbParams: DbParams): Promise<DataResult<OCPPNormalizedMeterValue>> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenant.id, MODULE_NAME, 'getMeterValues');
    // Check Tenant
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
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
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
      .aggregate(aggregation, {
        allowDiskUse: true
      })
      .toArray();
    // Debug
    await Logging.traceEnd(tenant.id, MODULE_NAME, 'getMeterValues', uniqueTimerID, meterValuesMDB);
    // Ok
    return {
      count: (meterValuesCountMDB.length > 0 ? meterValuesCountMDB[0].count : 0),
      result: meterValuesMDB
    };
  }
}
