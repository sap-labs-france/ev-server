import Constants from '../../utils/Constants';
import Utils from '../../utils/Utils';
import Database from '../../utils/Database';
import DatabaseUtils from './DatabaseUtils';
import Logging from '../../utils/Logging';
import BackendError from '../../exception/BackendError';
import ChargingStation from '../../entity/ChargingStation'; 
import SiteArea from '../../entity/SiteArea'; 
import Site from '../../entity/Site'; 
import Tenant from '../../entity/Tenant';
import TSGlobal from '../../types/GlobalType';
declare var global: TSGlobal;

export default class ChargingStationStorage {

  static async getChargingStation(tenantID, id): Promise<ChargingStation> {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'getChargingStation');
    // Check Tenant
    await Utils.checkTenant(tenantID);

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

  static async getChargingStations(tenantID, params: any = {}, limit?, skip?, sort?): Promise<{count: number, result: ChargingStation[]}> {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'getChargingStations');
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
      "$and": [{
        "$or": [
          { "deleted": { $exists: false } },
          { "deleted": null },
          { "deleted": false }
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
        "$or": [
          { "_id": { $regex: params.search, $options: 'i' } },
          { "chargePointModel": { $regex: params.search, $options: 'i' } },
          { "chargePointVendor": { $regex: params.search, $options: 'i' } }
        ]
      });
    }
    // Site Area
    if (params.siteAreaID) {
      filters.$and.push({
        "siteAreaID": Utils.convertToObjectID(params.siteAreaID)
      });
    }
    // No Site Area
    if (params.withNoSiteArea) {
      // Build filter
      filters.$and.push({
        "siteAreaID": null
      });
    } else {
      // With Site Area
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
      // With sites
      if (params.siteIDs && params.siteIDs.length > 0) {
        // Build filter
        filters.$and.push({
          "siteArea.siteID": {
            $in: params.siteIDs.map((siteID) => Utils.convertToObjectID(siteID))
          }
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
    // Limit records?
    if (!params.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.MAX_DB_RECORD_COUNT });
    }
    // Count Records
    const chargingStationsCountMDB = await global.database.getCollection(tenantID, 'chargingstations')
      .aggregate([...aggregation, {$count: "count", allowDiskUse: true}])
      .toArray();
    // Check if only the total count is requested
    if (params.onlyRecordCount) {
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
        },
        allowDiskUse: true
      })
      .toArray();
    const chargingStations = [];
    // Create
    for (const chargingStationMDB of chargingStationsMDB) {
      // Create the Charger
      const chargingStation = new ChargingStation(tenantID, chargingStationMDB);
      // Add the Site Area?
      if (chargingStationMDB.siteArea) {
        const siteArea = new SiteArea(tenantID, chargingStationMDB.siteArea);
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
      count: (chargingStationsCountMDB.length > 0 ?
        (chargingStationsCountMDB[0].count === Constants.MAX_DB_RECORD_COUNT ? -1 : chargingStationsCountMDB[0].count) : 0),
      result: chargingStations
    };
  }

  static async getChargingStationsInError(tenantID, params: any = {}, limit?, skip?, sort?) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'getChargingStations');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check Limit
    limit = Utils.checkRecordLimit(limit);
    // Check Skip
    skip = Utils.checkRecordSkip(skip);
    // Create Aggregation
    const aggregation = [];
    let siteAreaIdJoin = null;
    let siteAreaJoin = null;
    // Set the filters
    const basicFilters: any = {
      $and: [{
        $or: [
          { "deleted": { $exists: false } },
          { "deleted": null },
          { "deleted": false }
        ]
      }]
    };
    // Source?
    if (params.search) {
      // Build filter
      basicFilters.$and.push({
        "$or": [
          { "_id": { $regex: params.search, $options: 'i' } },
          { "chargePointModel": { $regex: params.search, $options: 'i' } },
          { "chargePointVendor": { $regex: params.search, $options: 'i' } }
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
        }
      },
      {
        $unwind: {
          "path": "$siteArea",
          "preserveNullAndEmptyArrays": true
        }
      }];
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
        }
      }, {
        $unwind: {
          "path": "$site",
          "preserveNullAndEmptyArrays": true
        }
      }
      ];
    }
    // Charger
    if (params.chargeBoxID) {
      basicFilters.$and.push({
        "_id": params.chargeBoxId
      });
    }
    // Build facets meaning each different error scenario
    let facets: any = {};
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
    aggregation.push({ $project: { "allItems": { $concatArrays: project } } });
    aggregation.push({ $unwind: { "path": "$allItems" } });
    aggregation.push({ $replaceRoot: { newRoot: "$allItems" } });
    // Add a unique identifier as we may have the same charger several time
    aggregation.push({ $addFields: { "uniqueId": { $concat: ["$_id", "#", "$errorCode"] } } });

    // Limit records?
    if (!params.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.MAX_DB_RECORD_COUNT });
    }
    // Count Records
    const chargingStationsCountMDB = await global.database.getCollection(tenantID, 'chargingstations')
      .aggregate([...aggregation, { $count: "count" }])
      .toArray();
    // Check if only the total count is requested
    if (params.onlyRecordCount) {
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
        const siteArea = new SiteArea(tenantID, chargingStationMDB.siteArea);
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
      count: (chargingStationsCountMDB.length > 0 ?
        (chargingStationsCountMDB[0].count === Constants.MAX_DB_RECORD_COUNT ? -1 : chargingStationsCountMDB[0].count) : 0),
      result: chargingStations
    };
  }

  static builChargerInErrorFacet(errorType) {
    switch (errorType) {
      case 'missingSettings':
        return [{
          $match: {
            $or: [
              { "maximumPower": { $exists: false } }, { "maximumPower": { $lte: 0 } }, { "maximumPower": null },
              { "chargePointModel": { $exists: false } }, { "chargePointModel": { $eq: "" } },
              { "chargePointVendor": { $exists: false } }, { "chargePointVendor": { $eq: "" } },
              { "numberOfConnectedPhase": { $exists: false } }, { "numberOfConnectedPhase": null }, { "numberOfConnectedPhase": { $nin: [0, 1, 3] } },
              { "powerLimitUnit": { $exists: false } }, { "powerLimitUnit": null }, { "powerLimitUnit": { $nin: ["A", "W"] } },
              { "chargingStationURL": { $exists: false } }, { "chargingStationURL": null }, { "chargingStationURL": { $eq: "" } },
              { "cannotChargeInParallel": { $exists: false } }, { "cannotChargeInParallel": null },
              { "connectors.type": { $exists: false } }, { "connectors.type": null }, { "connectors.type": { $eq: "" } },
              { "connectors.power": { $exists: false } }, { "connectors.power": null }, { "connectors.power": { $lte: 0 } }
            ]
          }
        },
        { $addFields: { "errorCode": "missingSettings" } }
        ];
      case 'connectionBroken':
      {
        const inactiveDate = new Date(new Date().getTime() - 3 * 60 * 1000);
        return [
          { $match: { "lastHeartBeat": { $lte: inactiveDate } } },
          { $addFields: { "errorCode": "connectionBroken" } }
        ];
      }
      case 'connectorError':
        return [
          { $match: { $or: [{ "connectors.errorCode": { $ne: "NoError" } }, { "connectors.status": { $eq: "Faulted" } }] } },
          { $addFields: { "errorCode": "connectorError" } }
        ];
      case 'missingSiteArea':
        return [
          { $match: { $or: [{ "siteAreaID": { $exists: false } }, { "siteAreaID": null }] } },
          { $addFields: { "errorCode": "missingSiteArea" } }
        ];
      default:
        return [];
    }
  }

  static async saveChargingStation(tenantID, chargingStationToSave) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'saveChargingStation');
    // Check Tenant
    await Utils.checkTenant(tenantID);
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
    const chargingStation: any = {};
    Database.updateChargingStation(chargingStationToSave, chargingStation, false);
    // Modify and return the modified document
    const result = await global.database.getCollection(tenantID, 'chargingstations').findOneAndUpdate({
      "_id": chargingStationToSave.id
    }, {
      $set: chargingStation
    }, {
      upsert: true,
      returnOriginal: false
    });
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'saveChargingStation', uniqueTimerID);
    return new ChargingStation(tenantID, result.value);
  }

  static async saveChargingStationConnector(tenantID, chargingStation, connector) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'saveChargingStationConnector');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const updatedFields: any = {};
    updatedFields["connectors." + (connector.connectorId - 1)] = connector;
    // Modify and return the modified document
    const result = await global.database.getCollection(tenantID, 'chargingstations').findOneAndUpdate({
      "_id": chargingStation.id
    }, {
      $set: updatedFields
    }, {
      upsert: true,
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
    const updatedFields: any = {};
    updatedFields["lastHeartBeat"] = Utils.convertToDate(chargingStation.lastHeartBeat);
    // Modify and return the modified document
    const result = await global.database.getCollection(tenantID, 'chargingstations').findOneAndUpdate({
      "_id": chargingStation.id
    }, {
      $set: updatedFields
    }, {
      upsert: true,
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
    const updatedFields: any = {};
    updatedFields["siteAreaID"] = (chargingStation.siteArea ? Utils.convertToObjectID(chargingStation.siteArea.id) : null);
    // Check Last Changed By
    if (chargingStation.lastChangedBy && typeof chargingStation.lastChangedBy === "object") {
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
      .findOneAndDelete({ '_id': id });
    // Delete Charger
    await global.database.getCollection(tenantID, 'chargingstations')
      .findOneAndDelete({ '_id': id });
    // Keep the rest (bootnotif, authorize...)
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'deleteChargingStation', uniqueTimerID);
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
          $and: [
            { "_id": { $in: chargingStationIDs } },
            { "siteAreaID": Utils.convertToObjectID(siteAreaID) }
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
          $and: [
            { "_id": { $in: chargingStationIDs } },
            { "siteAreaID": null }
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
}
