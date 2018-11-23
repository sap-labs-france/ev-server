const Constants = require('../../utils/Constants');
const Utils = require('../../utils/Utils');
const Database = require('../../utils/Database');
const crypto = require('crypto');
const DatabaseUtils = require('./DatabaseUtils');

class ChargingStationStorage {
  static async getChargingStation(tenantID, id) {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const ChargingStation = require('../../entity/ChargingStation'); // Avoid fucking circular deps!!!
    const SiteArea = require('../../entity/SiteArea'); // Avoid fucking circular deps!!!
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: {
        _id: id
      }
    });
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID,aggregation);
    // Add
    aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenantID, "siteareas"),
        localField: "siteAreaID",
        foreignField: "_id",
        as: "siteArea"
      }
    });
    // Add
    aggregation.push({
      $unwind: {"path": "$siteArea", "preserveNullAndEmptyArrays": true}
    });
    // Read DB
    const chargingStationMDB = await global.database.getCollection(tenantID, 'chargingstations')
      .aggregate(aggregation)
      .limit(1)
      .toArray();
    let chargingStation = null;
    // Found
    if (chargingStationMDB && chargingStationMDB.length > 0) {
      // Create
      chargingStation = new ChargingStation(tenantID, chargingStationMDB[0]);
      // Set Site Area
      if (chargingStationMDB[0].siteArea) {
        chargingStation.setSiteArea(
          new SiteArea(tenantID, chargingStationMDB[0].siteArea));
      }
    }
    return chargingStation;
  }

  static async getChargingStations(tenantID, params = {}, limit, skip, sort) {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const ChargingStation = require('../../entity/ChargingStation'); // Avoid fucking circular deps!!!
    const SiteArea = require('../../entity/SiteArea'); // Avoid fucking circular deps!!!
    const Site = require('../../entity/Site'); // Avoid fucking circular deps!!!
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
    // Source?
    if (params.search) {
      // Build filter
      filters.$and.push({
        "$or": [
          {"_id": {$regex: params.search, $options: 'i'}},
          {"chargePointModel": {$regex: params.search, $options: 'i'}},
          {"chargePointVendor": {$regex: params.search, $options: 'i'}}
        ]
      });
    }
    // Source?
    if (params.siteAreaID) {
      // Build filter
      filters.$and.push({
        "siteAreaID": Utils.convertToObjectID(params.siteAreaID)
      });
    }
    // With no Site Area
    if (params.withNoSiteArea) {
      // Build filter
      filters.$and.push({
        "siteAreaID": null
      });
    } else {
      // Always get the Site Area
      aggregation.push({
        $lookup: {
          from: DatabaseUtils.getCollectionName(tenantID, "siteareas"),
          localField: "siteAreaID",
          foreignField: "_id",
          as: "siteArea"
        }
      });
      // Single Record
      aggregation.push({
        $unwind: {"path": "$siteArea", "preserveNullAndEmptyArrays": true}
      });
      // Check Site ID
      if (params.siteID) {
        // Build filter
        filters.$and.push({
          "siteArea.siteID": Utils.convertToObjectID(params.siteID)
        });
      } 
      if (params.withSite) {
        // Get the site from the sitearea
        aggregation.push({
          $lookup: {
            from: DatabaseUtils.getCollectionName(tenantID, "sites"),
            localField: "siteArea.siteID",
            foreignField: "_id",
            as: "site"
          }
        });
        // Single Record
        aggregation.push({
          $unwind: {"path": "$site", "preserveNullAndEmptyArrays": true}
        });
      }
    }
    if (params.chargeBoxId) {
      // Build filter
      filters.$and.push({
        "_id": params.chargeBoxId
      });
    }
    // Filters
    aggregation.push({
      $match: filters
    });
    // Count Records
    const chargingStationsCountMDB = await global.database.getCollection(tenantID, 'chargingstations')
      .aggregate([...aggregation, {$count: "count"}])
      .toArray();
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID,aggregation);
    // Sort
    if (sort) {
      // Sort
      aggregation.push({
        $sort: sort
      });
    } else {
      // Default
      aggregation.push({
        $sort: {_id: 1}
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
    const chargingStationsMDB = await global.database.getCollection(tenantID, 'chargingstations')
      .aggregate(aggregation, {collation: {locale: Constants.DEFAULT_LOCALE, strength: 2}})
      .toArray();
    const chargingStations = [];
    // Create
    for (const chargingStationMDB of chargingStationsMDB) {
      // Create the Charger
      const chargingStation = new ChargingStation(tenantID, chargingStationMDB)
      // Add the Site Area?
      if (chargingStationMDB.siteArea) {
        const siteArea = new SiteArea(tenantID, chargingStationMDB.siteArea)
        // Set
        chargingStation.setSiteArea(siteArea);
        if (chargingStationMDB.site) {
          // Add site
          siteArea.setSite(new Site(tenantID, chargingStationMDB.site));
        }
      }
      // Add
      chargingStations.push(chargingStation);
    }
    // Ok
    return {
      count: (chargingStationsCountMDB.length > 0 ? chargingStationsCountMDB[0].count : 0),
      result: chargingStations
    };
  }

  static async saveChargingStation(tenantID, chargingStationToSave) {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const ChargingStation = require('../../entity/ChargingStation'); // Avoid fucking circular deps!!!
    // Check Site Area
    chargingStationToSave.siteAreaID = null;
    if (chargingStationToSave.siteArea && chargingStationToSave.siteArea.id) {
      // Set the ID
      chargingStationToSave.siteAreaID = chargingStationToSave.siteArea.id;
    }
    // Check Created By/On
    chargingStationToSave.createdBy = Utils.convertUserToObjectID(chargingStationToSave.createdBy);
    chargingStationToSave.lastChangedBy = Utils.convertUserToObjectID(chargingStationToSave.lastChangedBy);
    // Transfer
    const chargingStation = {};
    Database.updateChargingStation(chargingStationToSave, chargingStation, false);
    // Modify and return the modified document
    const result = await global.database.getCollection(tenantID, 'chargingstations').findOneAndUpdate({
      "_id": chargingStationToSave.id
    }, {
      $set: chargingStation
    }, {
      upsert: true,
      new: true,
      returnOriginal: false
    });
    // Create
    return new ChargingStation(tenantID, result.value);
  }

  static async saveChargingStationConnector(tenantID, chargingStation, connectorId) {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const ChargingStation = require('../../entity/ChargingStation'); // Avoid fucking circular deps!!!
    const updatedFields = {};
    updatedFields["connectors." + (connectorId - 1)] = chargingStation.connectors[connectorId - 1];
    // Modify and return the modified document
    const result = await global.database.getCollection(tenantID, 'chargingstations').findOneAndUpdate({
      "_id": chargingStation.id
    }, {
      $set: updatedFields
    }, {
      upsert: true,
      new: true,
      returnOriginal: false
    });
    // Create
    return new ChargingStation(tenantID, result.value);
  }

  static async saveChargingStationHeartBeat(tenantID, chargingStation) {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const ChargingStation = require('../../entity/ChargingStation'); // Avoid fucking circular deps!!!
    const updatedFields = {};
    updatedFields["lastHeartBeat"] = Utils.convertToDate(chargingStation.lastHeartBeat);
    // Modify and return the modified document
    const result = await global.database.getCollection(tenantID, 'chargingstations').findOneAndUpdate({
      "_id": chargingStation.id
    }, {
      $set: updatedFields
    }, {
      upsert: true,
      new: true,
      returnOriginal: false
    });
    // Create
    return new ChargingStation(tenantID, result.value);
  }

  static async saveChargingStationSiteArea(tenantID, chargingStation) {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const ChargingStation = require('../../entity/ChargingStation'); // Avoid fucking circular deps!!!
    const updatedFields = {};
    updatedFields["siteAreaID"] = (chargingStation.siteArea ? Utils.convertToObjectID(chargingStation.siteArea.id) : null);
    // Check Last Changed By
    if (chargingStation.lastChangedBy && typeof chargingStation.lastChangedBy == "object") {
      // This is the User Model
      updatedFields["lastChangedBy"] = Utils.convertToObjectID(chargingStation.lastChangedBy.id);
      updatedFields["lastChangedOn"] = Utils.convertToDate(chargingStation.lastChangedOn);
    }
    // Modify and return the modified document
    const result = await global.database.getCollection(tenantID, 'chargingstations').findOneAndUpdate({
      "_id": chargingStation.id
    }, {
      $set: updatedFields
    }, {
      upsert: true,
      new: true,
      returnOriginal: false
    });
    // Create
    return new ChargingStation(tenantID, result.value);
  }

  static async deleteChargingStation(tenantID, id) {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Delete Configuration
    await global.database.getCollection(tenantID, 'configurations')
      .findOneAndDelete({
        '_id': id
      });
    // Delete Charger
    await global.database.getCollection(tenantID, 'chargingstations')
      .findOneAndDelete({
        '_id': id
      });
    // Keep the rest (bootnotif, authorize...)
  }

  static async saveAuthorize(tenantID, authorize) {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Set the ID
    authorize.id = crypto.createHash('sha256')
      .update(`${authorize.chargeBoxID}~${authorize.timestamp.toISOString()}`)
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
        timestamp: Utils.convertToDate(authorize.timestamp)
      });
  }

  static async saveConfiguration(tenantID, configuration) {
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
  }

  static async saveDataTransfer(tenantID, dataTransfer) {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Set the ID
    dataTransfer.id = crypto.createHash('sha256')
      .update(`${dataTransfer.chargeBoxID}~${dataTransfer.data}~${dataTransfer.timestamp}`)
      .digest("hex");
    // Insert
    await global.database.getCollection(tenantID, 'datatransfers')
      .insertOne({
        _id: dataTransfer.id,
        vendorId: dataTransfer.vendorId,
        messageId: dataTransfer.messageId,
        data: dataTransfer.data,
        chargeBoxID: dataTransfer.chargeBoxID,
        timestamp: Utils.convertToDate(dataTransfer.timestamp)
      });
  }

  static async saveBootNotification(tenantID, bootNotification) {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Insert
    await global.database.getCollection(tenantID, 'bootnotifications')
      .insertOne({
        _id: crypto.createHash('sha256')
          .update(`${bootNotification.chargeBoxID}~${bootNotification.timestamp}`)
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
        timestamp: Utils.convertToDate(bootNotification.timestamp)
      });
  }

  static async saveDiagnosticsStatusNotification(tenantID, diagnosticsStatusNotification) {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Set the ID
    diagnosticsStatusNotification.id = crypto.createHash('sha256')
      .update(`${diagnosticsStatusNotification.chargeBoxID}~${diagnosticsStatusNotification.timestamp.toISOString()}`)
      .digest("hex");
    // Insert
    await global.database.getCollection(tenantID, 'diagnosticsstatusnotifications')
      .insertOne({
        _id: diagnosticsStatusNotification.id,
        chargeBoxID: diagnosticsStatusNotification.chargeBoxID,
        status: diagnosticsStatusNotification.status,
        timestamp: Utils.convertToDate(diagnosticsStatusNotification.timestamp)
      });
  }

  static async saveFirmwareStatusNotification(tenantID, firmwareStatusNotification) {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Set the ID
    firmwareStatusNotification.id = crypto.createHash('sha256')
      .update(`${firmwareStatusNotification.chargeBoxID}~${firmwareStatusNotification.timestamp.toISOString()}`)
      .digest("hex");
    // Insert
    await global.database.getCollection(tenantID, 'firmwarestatusnotifications')
      .insertOne({
        _id: firmwareStatusNotification.id,
        chargeBoxID: firmwareStatusNotification.chargeBoxID,
        status: firmwareStatusNotification.status,
        timestamp: Utils.convertToDate(firmwareStatusNotification.timestamp)
      });
  }

  static async saveStatusNotification(tenantID, statusNotificationToSave) {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const statusNotification = {};
    // Set the ID
    statusNotification._id = crypto.createHash('sha256')
      .update(`${statusNotificationToSave.chargeBoxID}~${statusNotificationToSave.connectorId}~${statusNotificationToSave.status}~${statusNotificationToSave.timestamp}`)
      .digest("hex");
    // Set
    Database.updateStatusNotification(statusNotificationToSave, statusNotification, false);
    // Insert
    await global.database.getCollection(tenantID, 'statusnotifications')
      .insertOne(statusNotification);
  }

  static async getConfigurationParamValue(tenantID, chargeBoxID, paramName) {
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
          // Found!
          value = param.value;
          // Break
          return false;
        } else {
          // Continue
          return true;
        }
      });
    }
    return value;
  }

  static async getConfiguration(tenantID, chargeBoxID) {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const configurationsMDB = await global.database.getCollection(tenantID, 'configurations')
      .find({
        "_id": chargeBoxID
      })
      .limit(1)
      .toArray();
    // Found?
    let configuration = null;
    if (configurationsMDB && configurationsMDB.length > 0) {
      // Set values
      configuration = {};
      Database.updateConfiguration(configurationsMDB[0], configuration);
    }
    return configuration;
  }
}

module.exports = ChargingStationStorage;
