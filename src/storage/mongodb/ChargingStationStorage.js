const Constants = require('../../utils/Constants');
const Utils = require('../../utils/Utils');
const Database = require('../../utils/Database');
const crypto = require('crypto');
const DatabaseUtils = require('./DatabaseUtils');
const Logging = require('../../utils/Logging');
const BackendError = require('../../exception/BackendError');

class ChargingStationStorage {
  static async getChargingStation(tenantID, id) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'getChargingStation');
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
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);
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
      $unwind: {
        "path": "$siteArea",
        "preserveNullAndEmptyArrays": true
      }
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
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'getChargingStation', uniqueTimerID);
    return chargingStation;
  }

  static async getChargingStations(tenantID, params = {}, limit, skip, sort) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'getChargingStations');
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
        "$or": [{
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
    // include deleted charging stations if requested
    if (params.includeDeleted) {
      filters.$and[0].$or.push({
        "deleted": true
      });
    }
    // Source?
    if (params.search) {
      // Build filter
      filters.$and.push({
        "$or": [{
          "_id": {
            $regex: params.search,
            $options: 'i'
          }
        },
        {
          "chargePointModel": {
            $regex: params.search,
            $options: 'i'
          }
        },
        {
          "chargePointVendor": {
            $regex: params.search,
            $options: 'i'
          }
        }
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
        $unwind: {
          "path": "$siteArea",
          "preserveNullAndEmptyArrays": true
        }
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
          $unwind: {
            "path": "$site",
            "preserveNullAndEmptyArrays": true
          }
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
      .aggregate([...aggregation, {
        $count: "count"
      }])
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
    const chargingStationsMDB = await global.database.getCollection(tenantID, 'chargingstations')
      .aggregate(aggregation, {
        collation: {
          locale: Constants.DEFAULT_LOCALE,
          strength: 2
        }
      })
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
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'getChargingStations', uniqueTimerID);
    // Ok
    return {
      count: (chargingStationsCountMDB.length > 0 ? chargingStationsCountMDB[0].count : 0),
      result: chargingStations
    };
  }

  static async getChargingStationsInError(tenantID, params = {}, limit, skip, sort) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'getChargingStations');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const ChargingStation = require('../../entity/ChargingStation'); // Avoid fucking circular deps!!!
    const SiteArea = require('../../entity/SiteArea'); // Avoid fucking circular deps!!!
    const Site = require('../../entity/Site'); // Avoid fucking circular deps!!!
    const Tenant = require('../../entity/Tenant'); // Avoid fucking circular deps!!!
    // Check Limit
    limit = Utils.checkRecordLimit(limit);
    // Check Skip
    skip = Utils.checkRecordSkip(skip);
    // Create Aggregation
    const aggregation = [];
    let siteAreaIdJoin = null;
    let siteAreaJoin = null;
    // Set the filters
    const basicFilters = {
      $and: [{
        $or: [{
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
      basicFilters.$and.push({
        "$or": [{
          "_id": {
            $regex: params.search,
            $options: 'i'
          }
        },
        {
          "chargePointModel": {
            $regex: params.search,
            $options: 'i'
          }
        },
        {
          "chargePointVendor": {
            $regex: params.search,
            $options: 'i'
          }
        }
        ]
      });
    }
    // Source?
    if (params.siteAreaID) {
      // Build filter
      basicFilters.$and.push({
        "siteAreaID": Utils.convertToObjectID(params.siteAreaID)
      });
    }
    // With no Site Area
    if (params.withNoSiteArea) {
      // Build filter
      basicFilters.$and.push({
        "siteAreaID": null
      });
    } else {
      // Always get the Site Area
      siteAreaIdJoin = [{
        $lookup: {
          from: DatabaseUtils.getCollectionName(tenantID, "siteareas"),
          localField: "siteAreaID",
          foreignField: "_id",
          as: "siteArea"
        }},
      { $unwind: {
        "path": "$siteArea",
        "preserveNullAndEmptyArrays": true
      }}]
    }
    // Check Site ID
    if (params.siteID) {
      // Build filter
      basicFilters.$and.push({
        "siteArea.siteID": Utils.convertToObjectID(params.siteID)
      });
    }
    if (params.withSite) {
      // Get the site from the sitearea
      siteAreaJoin = [{
        $lookup: {
          from: DatabaseUtils.getCollectionName(tenantID, "sites"),
          localField: "siteArea.siteID",
          foreignField: "_id",
          as: "site"
        }}, {
        $unwind: {
          "path": "$site",
          "preserveNullAndEmptyArrays": true
        }}
      ]
    }
    if (params.chargeBoxId) {
      // Build filter
      basicFilters.$and.push({
        "_id": params.chargeBoxId
      });
    }
    // Build facets meaning each different error scenario
    let facets = {};
    if (params.errorType) {
      // check allowed
      if (!(await Tenant.getTenant(tenantID)).isComponentActive(Constants.COMPONENTS.ORGANIZATION) && params.errorType === 'missingSiteArea') {
        throw new BackendError(null, `Organization is not active whereas filter is on missing site.`,
          "ChargingStationStorage", "getChargingStationsInError");
      }
      // build facet only for one error type
      facets.$facet = {};
      facets.$facet[params.errorType] = ChargingStationStorage.builChargerInErrorFacet(params.errorType);
    } else {
      facets = {
        "$facet":
        {
          "missingSettings": ChargingStationStorage.builChargerInErrorFacet("missingSettings"),
          "connectionBroken": ChargingStationStorage.builChargerInErrorFacet("connectionBroken"),
          "connectorError": ChargingStationStorage.builChargerInErrorFacet("connectorError"),
        }
      };
      if ((await Tenant.getTenant(tenantID)).isComponentActive(Constants.COMPONENTS.ORGANIZATION)) {
        // Add facet for missing Site Area ID
        facets.$facet.missingSiteArea = ChargingStationStorage.builChargerInErrorFacet("missingSiteArea");
      }
    }
    // merge in each facet the join for sitearea and siteareaid
    const project = [];
    for (const facet in facets.$facet) {
      if (siteAreaIdJoin) {
        facets.$facet[facet] = [...facets.$facet[facet], ...siteAreaIdJoin];
      }
      if (siteAreaJoin) {
        facets.$facet[facet] = [...facets.$facet[facet], ...siteAreaJoin];
        // Filters
        facets.$facet[facet].push({
          $match: basicFilters
        });
      }
      project.push(`$${facet}`);
    }
    aggregation.push(facets);
    // Manipulate the results to convert it to an array of document on root level
    aggregation.push({$project: { "allItems": { $concatArrays: project } } });
    aggregation.push({"$unwind":{"path":"$allItems"}});
    aggregation.push({$replaceRoot:{newRoot:"$allItems"}});
    // Add a unique identifier as we may have the same charger several time
    aggregation.push({$addFields: {"uniqueId":{$concat:["$_id","#", "$errorCode"]}}});

    // Count Records
    const chargingStationsCountMDB = await global.database.getCollection(tenantID, 'chargingstations')
      .aggregate([...aggregation, {
        $count: "count"
      }])
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
    const chargingStationsFacetMDB = await global.database.getCollection(tenantID, 'chargingstations')
      .aggregate(aggregation, {
        collation: {
          locale: Constants.DEFAULT_LOCALE,
          strength: 2
        }
      })
      .toArray();
    const chargingStations = [];
    // Create
    for (const chargingStationMDB of chargingStationsFacetMDB) {
      // Create the Charger
      const chargingStation = new ChargingStation(tenantID, chargingStationMDB);
      //enhance model with error info
      chargingStation.getModel().errorCode = chargingStationMDB.errorCode;
      chargingStation.getModel().uniqueId = chargingStationMDB.uniqueId;
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
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'getChargingStations', uniqueTimerID);
    // Ok
    return {
      count: (chargingStationsCountMDB.length > 0 ? chargingStationsCountMDB[0].count : 0),
      result: chargingStations
    };
  }

  static builChargerInErrorFacet(errorType) {
    switch (errorType) {
      case 'missingSettings':
        return [{$match:{$or:[
          {"maximumPower":{$exists:false}},{"maximumPower":{$lte:0}},{"maximumPower":null},
          {"chargePointModel":{$exists:false}},{"chargePointModel":{$eq:""}},
          {"chargePointVendor":{$exists:false}},{"chargePointVendor":{$eq:""}},
          {"numberOfConnectedPhase":{$exists:false}},{"numberOfConnectedPhase":null},{"numberOfConnectedPhase":{$nin:[1,3]}},
          {"powerLimitUnit":{$exists:false}},{"powerLimitUnit":null},{"powerLimitUnit":{$nin:["A","W"]}},
          {"chargingStationURL":{$exists:false}},{"chargingStationURL":null},{"chargingStationURL":{$eq:""}},
          {"cannotChargeInParallel":{$exists:false}},{"cannotChargeInParallel":null},
          {"connectors.type":{$exists:false}},{"connectors.type":null},{"connectors.type":{$eq:""}},
          {"connectors.power":{$exists:false}},{"connectors.power":null},{"connectors.power":{$lte:0}}
        ]}},
        {$addFields: {"errorCode":"missingSettings"}}
        ];
      case 'connectionBroken': 
      {
        const inactiveDate = new Date(new Date().getTime() - 3 * 60 * 1000);
        return [
          {$match:{"lastHeartBeat":{$lte:inactiveDate}}},
          {$addFields: {"errorCode":"connectionBroken"}}
        ];
      }
      case 'connectorError':
        return [
          {$match:{$or:[{"connectors.errorCode": {$ne: "NoError"}}, {"connectors.status": {$eq: "Faulted"}}]}},
          {$addFields: {"errorCode":"connectorError"}}
        ]
      case 'missingSiteArea':
        return [
          {$match:{$or:[{"siteAreaID":{$exists:false}},{"siteAreaID":null}]}},
          {$addFields: {"errorCode":"missingSiteArea"}}
        ]
      default:
        return [];
    }
  }

  // eslint-disable-next-line no-unused-vars
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
      // Yes, add in filter
      filters.timestamp = {};
      filters.timestamp.$gte = new Date(params.dateFrom);
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
      .aggregate([...aggregation, {
        $count: "count"
      }])
      .toArray();
    // Add Created By / Last Changed By
    // DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);
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

  static async saveChargingStation(tenantID, chargingStationToSave) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'saveChargingStation');
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
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'saveChargingStation', uniqueTimerID);
    return new ChargingStation(tenantID, result.value);
  }

  static async saveChargingStationConnector(tenantID, chargingStation, connectorId) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'saveChargingStationConnector');
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
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'saveChargingStationConnector', uniqueTimerID);
    return new ChargingStation(tenantID, result.value);
  }

  static async saveChargingStationHeartBeat(tenantID, chargingStation) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'saveChargingStationHeartBeat');
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
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'saveChargingStationHeartBeat', uniqueTimerID);
    return new ChargingStation(tenantID, result.value);
  }

  static async saveChargingStationSiteArea(tenantID, chargingStation) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'saveChargingStationSiteArea');
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
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'saveChargingStationSiteArea', uniqueTimerID);
    // Create
    return new ChargingStation(tenantID, result.value);
  }

  static async deleteChargingStation(tenantID, id) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'deleteChargingStation');
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
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'deleteChargingStation', uniqueTimerID);
  }

  static async saveAuthorize(tenantID, authorize) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'saveAuthorize');
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
        timestamp: Utils.convertToDate(authorize.timestamp),
        timezone: authorize.timezone
      });
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'saveAuthorize', uniqueTimerID);
  }

  static async saveConfiguration(tenantID, configuration) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'saveConfiguration');
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
    Logging.traceEnd('ChargingStationStorage', 'saveConfiguration', uniqueTimerID);
  }

  static async saveDataTransfer(tenantID, dataTransfer) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'saveDataTransfer');
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
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'saveDataTransfer', uniqueTimerID);
  }

  static async saveBootNotification(tenantID, bootNotification) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'saveBootNotification');
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
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'saveBootNotification', uniqueTimerID);
  }

  static async getBootNotifications(tenantID, params = {}, limit, skip, sort) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'getBootNotifications');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // const ChargingStation = require('../../entity/ChargingStation'); // Avoid fucking circular deps!!!
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
    Logging.traceEnd('ChargingStationStorage', 'getBootNotifications', uniqueTimerID);
    // Ok
    return {
      count: (bootNotificationsCountMDB.length > 0 ? bootNotificationsCountMDB[0].count : 0),
      result: bootNotifications
    };
  }

  static async saveDiagnosticsStatusNotification(tenantID, diagnosticsStatusNotification) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'saveDiagnosticsStatusNotification');
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
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'saveDiagnosticsStatusNotification', uniqueTimerID);
  }

  static async saveFirmwareStatusNotification(tenantID, firmwareStatusNotification) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'saveFirmwareStatusNotification');
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
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'saveFirmwareStatusNotification', uniqueTimerID);
  }

  static async saveStatusNotification(tenantID, statusNotificationToSave) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'saveStatusNotification');
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
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'saveStatusNotification', uniqueTimerID);
  }

  static async getConfigurationParamValue(tenantID, chargeBoxID, paramName) {
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
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'getConfigurationParamValue', uniqueTimerID);
    return value;
  }

  static async getConfiguration(tenantID, chargeBoxID) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'getConfiguration');
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
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'getConfiguration', uniqueTimerID);
    return configuration;
  }

  static async removeChargingStationsFromSiteArea(tenantID, siteAreaID, chargingStationIDs) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'removeChargingStationsFromSiteArea');
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
    Logging.traceEnd('ChargingStationStorage', 'removeChargingStationsFromSiteArea', uniqueTimerID, {
      siteAreaID,
      chargingStationIDs
    });
  }

  static async addChargingStationsToSiteArea(tenantID, siteAreaID, chargingStationIDs) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'addChargingStationsToSiteArea');
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
    Logging.traceEnd('ChargingStationStorage', 'addChargingStationsToSiteArea', uniqueTimerID, {
      siteAreaID,
      chargingStationIDs
    });
  }
}

module.exports = ChargingStationStorage;