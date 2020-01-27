import DbParams from '../../types/database/DbParams';
import global from '../../types/GlobalType';
import { OCPPAuthorizeRequestExtended, OCPPBootNotificationRequestExtended, OCPPDataTransferRequestExtended, OCPPDiagnosticsStatusNotificationRequestExtended, OCPPFirmwareStatusNotificationRequestExtended, OCPPNormalizedMeterValues, OCPPStatusNotificationRequestExtended, OCPPHeartbeatRequestExtended } from '../../types/ocpp/OCPPServer';
import Constants from '../../utils/Constants';
import Cypher from '../../utils/Cypher';
import Database from '../../utils/Database';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import DatabaseUtils from './DatabaseUtils';

export default class OCPPStorage {
  static async saveAuthorize(tenantID: string, authorize: OCPPAuthorizeRequestExtended) {
    // Debug
    const uniqueTimerID = Logging.traceStart('OCPPStorage', 'saveAuthorize');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const timestamp = Utils.convertToDate(authorize.timestamp);
    // Insert
    await global.database.getCollection<any>(tenantID, 'authorizes')
      .insertOne({
        _id: Cypher.hash(`${authorize.chargeBoxID}~${timestamp.toISOString()}`),
        tagID: authorize.idTag,
        chargeBoxID: authorize.chargeBoxID,
        userID: authorize.user ? Utils.convertToObjectID(authorize.user.id) : null,
        timestamp: timestamp,
        timezone: authorize.timezone
      });
    // Debug
    Logging.traceEnd('OCPPStorage', 'saveAuthorize', uniqueTimerID);
  }

  static async saveHeartbeat(tenantID: string, heartbeat: OCPPHeartbeatRequestExtended) {
    // Debug
    const uniqueTimerID = Logging.traceStart('OCPPStorage', 'saveHeartbeat');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const timestamp = Utils.convertToDate(heartbeat.timestamp);
    // Insert
    await global.database.getCollection<any>(tenantID, 'heartbeats')
      .insertOne({
        _id: Cypher.hash(`${heartbeat.chargeBoxID}~${timestamp.toISOString()}`),
        chargeBoxID: heartbeat.chargeBoxID,
        timestamp: timestamp,
        timezone: heartbeat.timezone
      });
    // Debug
    Logging.traceEnd('OCPPStorage', 'saveHeartbeat', uniqueTimerID);
  }

  static async getStatusNotifications(tenantID: string, params: {dateFrom?: Date; chargeBoxID?: string; connectorId?: number; status?: string}, dbParams: DbParams) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'getStatusNotifications');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Set the filters
    const filters: any = {};
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
    const statusNotificationsCountMDB = await global.database.getCollection<any>(tenantID, 'statusnotifications')
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
    // Sort
    if (dbParams.sort) {
      // Sort
      aggregation.push({
        $sort: dbParams.sort
      });
    } else {
      // Default
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
    // Read DB
    const statusNotificationsMDB = await global.database.getCollection<any>(tenantID, 'statusnotifications')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 }, allowDiskUse: true })
      .toArray();
    const statusNotifications = [];
    // Create
    for (const statusNotificationMDB of statusNotificationsMDB) {
      // Create status notification
      const statusNotification = statusNotificationMDB;
      // Add
      statusNotifications.push(statusNotification);
    }
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'getStatusNotifications', uniqueTimerID);
    // Ok
    return {
      count: (statusNotificationsCountMDB.length > 0 ? statusNotificationsCountMDB[0].count : 0),
      result: statusNotifications
    };
  }

  static async getLastStatusNotifications(tenantID: string, params: {dateBefore?: string; chargeBoxID?: string; connectorId?: number; status?: string}) {
    // Debug
    const uniqueTimerID = Logging.traceStart('OCPPStorage', 'getLastStatusNotifications');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Set the filters
    const filters: any = {};
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
    const statusNotificationsMDB = await global.database.getCollection<any>(tenantID, 'statusnotifications')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 }, allowDiskUse: true })
      .toArray();
    const statusNotifications = [];
    // Create
    for (const statusNotificationMDB of statusNotificationsMDB) {
      // Create status notification
      const statusNotification = statusNotificationMDB;
      // Add
      statusNotifications.push(statusNotification);
    }
    // Debug
    Logging.traceEnd('OCPPStorage', 'getLastStatusNotifications', uniqueTimerID);
    // Ok
    return statusNotifications;
  }

  static async saveStatusNotification(tenantID: string, statusNotificationToSave: OCPPStatusNotificationRequestExtended) {
    // Debug
    const uniqueTimerID = Logging.traceStart('OCPPStorage', 'saveStatusNotification');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const statusNotification: any = {};
    // Set the ID
    const timestamp = Utils.convertToDate(statusNotificationToSave.timestamp);
    statusNotification._id = Cypher.hash(`${statusNotificationToSave.chargeBoxID}~${statusNotificationToSave.connectorId}~${statusNotificationToSave.status}~${timestamp.toISOString()}`);
    // Set
    Database.updateStatusNotification(statusNotificationToSave, statusNotification, false);
    // Insert
    await global.database.getCollection<any>(tenantID, 'statusnotifications')
      .insertOne(statusNotification);
    // Debug
    Logging.traceEnd('OCPPStorage', 'saveStatusNotification', uniqueTimerID);
  }

  static async saveDataTransfer(tenantID: string, dataTransfer: OCPPDataTransferRequestExtended) {
    // Debug
    const uniqueTimerID = Logging.traceStart('OCPPStorage', 'saveDataTransfer');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Set the ID
    const timestamp = Utils.convertToDate(dataTransfer.timestamp);
    // Insert
    await global.database.getCollection<any>(tenantID, 'datatransfers')
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
    Logging.traceEnd('OCPPStorage', 'saveDataTransfer', uniqueTimerID);
  }

  static async saveBootNotification(tenantID: string, bootNotification: OCPPBootNotificationRequestExtended) {
    // Debug
    const uniqueTimerID = Logging.traceStart('OCPPStorage', 'saveBootNotification');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Insert
    const timestamp = Utils.convertToDate(bootNotification.timestamp);
    await global.database.getCollection<any>(tenantID, 'bootnotifications')
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
    Logging.traceEnd('OCPPStorage', 'saveBootNotification', uniqueTimerID);
  }

  public static async getBootNotifications(tenantID: string, params: {chargeBoxID?: string}, { limit, skip, sort }: DbParams) {
    // Debug
    const uniqueTimerID = Logging.traceStart('OCPPStorage', 'getBootNotifications');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check Limit
    limit = Utils.checkRecordLimit(limit);
    // Check Skip
    skip = Utils.checkRecordSkip(skip);
    // Create Aggregation
    const aggregation = [];
    // Set the filters
    const filters: any = {
      '$and': [{
        '$or': DatabaseUtils.getNotDeletedFilter()
      }]
    };

    // Charging Station ID
    if (params.chargeBoxID) {
      filters.$and.push({
        '_id': params.chargeBoxID
      });
    }
    // Filters
    aggregation.push({
      $match: filters
    });
    // Count Records
    const bootNotificationsCountMDB = await global.database.getCollection<any>(tenantID, 'bootnotifications')
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);
    // Sort
    if (sort) {
      // Sort
      aggregation.push({
        $sort: sort
      });
    } else {
      // Default
      aggregation.push({
        $sort: { _id: 1 }
      });
    }
    // Skip
    aggregation.push({
      $skip: skip
    });
    // Limit
    aggregation.push({
      $limit: limit
    });
    // Read DB
    const bootNotificationsMDB = await global.database.getCollection<any>(tenantID, 'bootnotifications')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 }, allowDiskUse: true })
      .toArray();
    const bootNotifications = [];
    // Create
    for (const bootNotificationMDB of bootNotificationsMDB) {
      // Add
      bootNotifications.push(bootNotificationMDB);
    }
    // Debug
    Logging.traceEnd('OCPPStorage', 'getBootNotifications', uniqueTimerID);
    // Ok
    return {
      count: (bootNotificationsCountMDB.length > 0 ? bootNotificationsCountMDB[0].count : 0),
      result: bootNotifications
    };
  }

  static async saveDiagnosticsStatusNotification(tenantID: string, diagnosticsStatusNotification: OCPPDiagnosticsStatusNotificationRequestExtended) {
    // Debug
    const uniqueTimerID = Logging.traceStart('OCPPStorage', 'saveDiagnosticsStatusNotification');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const timestamp = Utils.convertToDate(diagnosticsStatusNotification.timestamp);
    // Insert
    await global.database.getCollection<any>(tenantID, 'diagnosticsstatusnotifications')
      .insertOne({
        _id: Cypher.hash(`${diagnosticsStatusNotification.chargeBoxID}~${timestamp.toISOString()}`),
        chargeBoxID: diagnosticsStatusNotification.chargeBoxID,
        status: diagnosticsStatusNotification.status,
        timestamp: timestamp,
        timezone: diagnosticsStatusNotification.timezone
      });
    // Debug
    Logging.traceEnd('OCPPStorage', 'saveDiagnosticsStatusNotification', uniqueTimerID);
  }

  static async saveFirmwareStatusNotification(tenantID: string, firmwareStatusNotification: OCPPFirmwareStatusNotificationRequestExtended) {
    // Debug
    const uniqueTimerID = Logging.traceStart('OCPPStorage', 'saveFirmwareStatusNotification');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Set the ID
    const timestamp = Utils.convertToDate(firmwareStatusNotification.timestamp);
    // Insert
    await global.database.getCollection<any>(tenantID, 'firmwarestatusnotifications')
      .insertOne({
        _id: Cypher.hash(`${firmwareStatusNotification.chargeBoxID}~${timestamp.toISOString()}`),
        chargeBoxID: firmwareStatusNotification.chargeBoxID,
        status: firmwareStatusNotification.status,
        timestamp: timestamp,
        timezone: firmwareStatusNotification.timezone
      });
    // Debug
    Logging.traceEnd('OCPPStorage', 'saveFirmwareStatusNotification', uniqueTimerID);
  }

  static async saveMeterValues(tenantID: string, meterValuesToSave: OCPPNormalizedMeterValues) {
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', 'saveMeterValues');
    // Check
    await Utils.checkTenant(tenantID);
    const meterValuesMDB = [];
    // Save all
    for (const meterValueToSave of meterValuesToSave.values) {
      const meterValue: any = {};
      // Id
      const timestamp = Utils.convertToDate(meterValueToSave.timestamp);
      meterValue._id = Cypher.hash(`${meterValueToSave.chargeBoxID}~${meterValueToSave.connectorId}~${timestamp.toISOString()}~${meterValueToSave.value}~${JSON.stringify(meterValueToSave.attribute)}`);
      // Set
      Database.updateMeterValue(meterValueToSave, meterValue, false);
      // Add
      meterValuesMDB.push(meterValue);
    }
    // Execute
    await global.database.getCollection<any>(tenantID, 'metervalues').insertMany(meterValuesMDB);
    // Debug
    Logging.traceEnd('TransactionStorage', 'saveMeterValues', uniqueTimerID, { meterValuesToSave });
  }

  static async getMeterValues(tenantID: string, transactionID) {
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', 'getMeterValues');
    // Check
    await Utils.checkTenant(tenantID);
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: { transactionId: Utils.convertToInt(transactionID) }
    });
    // Read DB
    const meterValuesMDB = await global.database.getCollection<any>(tenantID, 'metervalues')
      .aggregate(aggregation, { allowDiskUse: true })
      .toArray();
    // Convert to date
    for (const meterValueMDB of meterValuesMDB) {
      meterValueMDB.timestamp = new Date(meterValueMDB.timestamp);
    }
    // Sort
    meterValuesMDB.sort((meterValue1, meterValue2) => meterValue1.timestamp.getTime() - meterValue2.timestamp.getTime());
    // Create
    const meterValues = [];
    for (const meterValueMDB of meterValuesMDB) {
      const meterValue: any = {};
      // Copy
      Database.updateMeterValue(meterValueMDB, meterValue);
      // Add
      meterValues.push(meterValue);
    }
    // Debug
    Logging.traceEnd('TransactionStorage', 'getMeterValues', uniqueTimerID, { transactionID });
    return meterValues;
  }
}
