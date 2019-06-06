
const Constants = require('../../utils/Constants');
const Utils = require('../../utils/Utils');
const Database = require('../../utils/Database');
const crypto = require('crypto');
const DatabaseUtils = require('./DatabaseUtils');
const Logging = require('../../utils/Logging');

class OCPPStorage {
  static async saveAuthorize(tenantID, authorize) {
    // Debug
    const uniqueTimerID = Logging.traceStart('OCPPStorage', 'saveAuthorize');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Set the ID
    const timestamp = Utils.convertToDate(authorize.timestamp);
    authorize.id = crypto.createHash('sha256')
      .update(`${authorize.chargeBoxID}~${timestamp.toISOString()}`)
      .digest("hex");
    // Set the User
    if (authorize.user) {
      authorize.userID = Utils.convertToObjectID(authorize.user.getID());
    }
    // Insert
    await global.database.getCollection(tenantID, 'authorizes')
      .insertOne({
        _id: authorize.id,
        tagID: authorize.idTag,
        chargeBoxID: authorize.chargeBoxID,
        userID: authorize.userID,
        timestamp: timestamp,
        timezone: authorize.timezone
      });
    // Debug
    Logging.traceEnd('OCPPStorage', 'saveAuthorize', uniqueTimerID);
  }

  static async getStatusNotifications(tenantID, params = {}, limit, skip, sort) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'getStatusNotifications');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check Limit
    limit = Utils.checkRecordLimit(limit);
    // Check Skip
    skip = Utils.checkRecordSkip(skip);
    // Set the filters
    const filters = {};
    // Date from provided?
    if (params.dateFrom) {
      filters.timestamp = {};
      filters.timestamp.$gte = new Date(params.dateFrom);
    }
    // Charger
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
    const statusNotificationsCountMDB = await global.database.getCollection(tenantID, 'statusnotifications')
      .aggregate([...aggregation, { $count: "count" }])
      .toArray();
    // Sort
    if (sort) {
      // Sort
      aggregation.push({
        $sort: sort
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
      $skip: skip
    });
    // Limit
    aggregation.push({
      $limit: limit
    });
    // Read DB
    const statusNotificationsMDB = await global.database.getCollection(tenantID, 'statusnotifications')
      .aggregate(aggregation, {
        collation: {
          locale: Constants.DEFAULT_LOCALE,
          strength: 2
        }
      })
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

  static async saveStatusNotification(tenantID, statusNotificationToSave) {
    // Debug
    const uniqueTimerID = Logging.traceStart('OCPPStorage', 'saveStatusNotification');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const statusNotification = {};
    // Set the ID
    const timestamp = Utils.convertToDate(statusNotificationToSave.timestamp);
    statusNotification._id = crypto.createHash('sha256')
      .update(`${statusNotificationToSave.chargeBoxID}~${statusNotificationToSave.connectorId}~${statusNotificationToSave.status}~${timestamp.toISOString()}`)
      .digest("hex");
    // Set
    Database.updateStatusNotification(statusNotificationToSave, statusNotification, false);
    // Insert
    await global.database.getCollection(tenantID, 'statusnotifications')
      .insertOne(statusNotification);
    // Debug
    Logging.traceEnd('OCPPStorage', 'saveStatusNotification', uniqueTimerID);
  }

  static async saveConfiguration(tenantID, configuration) {
    // Debug
    const uniqueTimerID = Logging.traceStart('OCPPStorage', 'saveConfiguration');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Modify
    await global.database.getCollection(tenantID, 'configurations').findOneAndUpdate({
      "_id": configuration.chargeBoxID
    }, {
      $set: {
        configuration: configuration.configuration,
        timestamp: Utils.convertToDate(configuration.timestamp)
      }
    }, {
      upsert: true,
      new: true,
      returnOriginal: false
    });
    // Debug
    Logging.traceEnd('OCPPStorage', 'saveConfiguration', uniqueTimerID);
  }

  static async saveDataTransfer(tenantID, dataTransfer) {
    // Debug
    const uniqueTimerID = Logging.traceStart('OCPPStorage', 'saveDataTransfer');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Set the ID
    const timestamp = Utils.convertToDate(dataTransfer.timestamp);
    dataTransfer.id = crypto.createHash('sha256')
      .update(`${dataTransfer.chargeBoxID}~${dataTransfer.data}~${timestamp.toISOString()}`)
      .digest("hex");
    // Insert
    await global.database.getCollection(tenantID, 'datatransfers')
      .insertOne({
        _id: dataTransfer.id,
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

  static async saveBootNotification(tenantID, bootNotification) {
    // Debug
    const uniqueTimerID = Logging.traceStart('OCPPStorage', 'saveBootNotification');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Insert
    const timestamp = Utils.convertToDate(bootNotification.timestamp);
    await global.database.getCollection(tenantID, 'bootnotifications')
      .insertOne({
        _id: crypto.createHash('sha256')
          .update(`${bootNotification.chargeBoxID}~${timestamp.toISOString()}`)
          .digest("hex"),
        chargeBoxID: bootNotification.chargeBoxID,
        chargePointVendor: bootNotification.chargePointVendor,
        chargePointModel: bootNotification.chargePointModel,
        chargePointSerialNumber: bootNotification.chargePointSerialNumber,
        chargeBoxSerialNumber: bootNotification.chargeBoxSerialNumber,
        firmwareVersion: bootNotification.firmwareVersion,
        ocppVersion: bootNotification.ocppVersion,
        ocppProtocol: bootNotification.ocppProtocol,
        endpoint: bootNotification.endpoint,
        chargeBoxIdentity: bootNotification.chargeBoxIdentity,
        timestamp: timestamp
      });
    // Debug
    Logging.traceEnd('OCPPStorage', 'saveBootNotification', uniqueTimerID);
  }

  static async getBootNotifications(tenantID, params = {}, limit, skip, sort) {
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
    const filters = {
      "$and": [{
        "$or": [
          {
            "deleted": {
              $exists: false
            }
          },
          {
            "deleted": null
          },
          {
            "deleted": false
          }
        ]
      }]
    };
    // Charger ID
    if (params.chargeBoxID) {
      // Build filter
      filters.$and.push({
        "_id": params.chargeBoxID
      });
    }
    // Filters
    aggregation.push({
      $match: filters
    });
    // Count Records
    const bootNotificationsCountMDB = await global.database.getCollection(tenantID, 'bootnotifications')
      .aggregate([...aggregation, { $count: "count" }])
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
    const bootNotificationsMDB = await global.database.getCollection(tenantID, 'bootnotifications')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 } })
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

  static async saveDiagnosticsStatusNotification(tenantID, diagnosticsStatusNotification) {
    // Debug
    const uniqueTimerID = Logging.traceStart('OCPPStorage', 'saveDiagnosticsStatusNotification');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Set the ID
    const timestamp = Utils.convertToDate(diagnosticsStatusNotification.timestamp);
    diagnosticsStatusNotification.id = crypto.createHash('sha256')
      .update(`${diagnosticsStatusNotification.chargeBoxID}~${timestamp.toISOString()}`)
      .digest("hex");
    // Insert
    await global.database.getCollection(tenantID, 'diagnosticsstatusnotifications')
      .insertOne({
        _id: diagnosticsStatusNotification.id,
        chargeBoxID: diagnosticsStatusNotification.chargeBoxID,
        status: diagnosticsStatusNotification.status,
        timestamp: timestamp,
        timezone: diagnosticsStatusNotification.timezone
      });
    // Debug
    Logging.traceEnd('OCPPStorage', 'saveDiagnosticsStatusNotification', uniqueTimerID);
  }

  static async saveFirmwareStatusNotification(tenantID, firmwareStatusNotification) {
    // Debug
    const uniqueTimerID = Logging.traceStart('OCPPStorage', 'saveFirmwareStatusNotification');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Set the ID
    const timestamp = Utils.convertToDate(firmwareStatusNotification.timestamp);
    firmwareStatusNotification.id = crypto.createHash('sha256')
      .update(`${firmwareStatusNotification.chargeBoxID}~${timestamp.toISOString()}`)
      .digest("hex");
    // Insert
    await global.database.getCollection(tenantID, 'firmwarestatusnotifications')
      .insertOne({
        _id: firmwareStatusNotification.id,
        chargeBoxID: firmwareStatusNotification.chargeBoxID,
        status: firmwareStatusNotification.status,
        timestamp: timestamp,
        timezone: firmwareStatusNotification.timezone
      });
    // Debug
    Logging.traceEnd('OCPPStorage', 'saveFirmwareStatusNotification', uniqueTimerID);
  }

  static async removeChargingStationsFromSiteArea(tenantID, siteAreaID, chargingStationIDs) {
    // Debug
    const uniqueTimerID = Logging.traceStart('OCPPStorage', 'removeChargingStationsFromSiteArea');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Site provided?
    if (siteAreaID) {
      // At least one User
      if (chargingStationIDs && chargingStationIDs.length > 0) {
        // update all chargers
        await global.database.getCollection(tenantID, 'chargingstations').updateMany({
          $and: [{
            "_id": {
              $in: chargingStationIDs
            }
          },
          {
            "siteAreaID": Utils.convertToObjectID(siteAreaID)
          }
          ]
        }, {
          $set: {
            siteAreaID: null
          }
        }, {
          upsert: false,
          new: true,
          returnOriginal: false
        });
      }
    }
    // Debug
    Logging.traceEnd('OCPPStorage', 'removeChargingStationsFromSiteArea', uniqueTimerID, {
      siteAreaID,
      chargingStationIDs
    });
  }

  static async addChargingStationsToSiteArea(tenantID, siteAreaID, chargingStationIDs) {
    // Debug
    const uniqueTimerID = Logging.traceStart('OCPPStorage', 'addChargingStationsToSiteArea');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Site provided?
    if (siteAreaID) {
      // At least one User
      if (chargingStationIDs && chargingStationIDs.length > 0) {
        // update all chargers
        await global.database.getCollection(tenantID, 'chargingstations').updateMany({
          $and: [{
            "_id": {
              $in: chargingStationIDs
            }
          },
          {
            "siteAreaID": null
          }
          ]
        }, {
          $set: {
            siteAreaID: Utils.convertToObjectID(siteAreaID)
          }
        }, {
          upsert: false,
          new: true,
          returnOriginal: false
        });
      }
    }
    // Debug
    Logging.traceEnd('OCPPStorage', 'addChargingStationsToSiteArea', uniqueTimerID, {
      siteAreaID,
      chargingStationIDs
    });
  }

  static async saveMeterValues(tenantID, meterValuesToSave) {
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', 'saveMeterValues');
    // Check
    await Utils.checkTenant(tenantID);
    const meterValuesMDB = [];
    // Save all
    for (const meterValueToSave of meterValuesToSave.values) {
      const meterValue = {};
      // Id
      const timestamp = Utils.convertToDate(meterValueToSave.timestamp);
      meterValue._id = crypto.createHash('sha256')
        .update(`${meterValueToSave.chargeBoxID}~${meterValueToSave.connectorId}~${timestamp.toISOString()}~${meterValueToSave.value}~${JSON.stringify(meterValueToSave.attribute)}`)
        .digest("hex");
      // Set
      Database.updateMeterValue(meterValueToSave, meterValue, false);
      // Add
      meterValuesMDB.push(meterValue);
    }
    // Execute
    await global.database.getCollection(tenantID, 'metervalues').insertMany(meterValuesMDB);
    // Debug
    Logging.traceEnd('TransactionStorage', 'saveMeterValues', uniqueTimerID, { meterValuesToSave });
  }

  static async getMeterValues(tenantID, transactionID) {
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
    const meterValuesMDB = await global.database.getCollection(tenantID, 'metervalues')
      .aggregate(aggregation)
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
      const meterValue = {};
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

module.exports = OCPPStorage;
