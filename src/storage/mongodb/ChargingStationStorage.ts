import BackendError from '../../exception/BackendError';
import ChargingStation from '../../types/ChargingStation';
import Constants from '../../utils/Constants';
import Database from '../../utils/Database';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import global from '../../types/GlobalType';
import Logging from '../../utils/Logging';
import SiteArea from '../../types/SiteArea';
import Tenant from '../../entity/Tenant';
import Utils from '../../utils/Utils';
import Connector from '../../types/Connector';
import { ObjectID } from 'bson';

export default class ChargingStationStorage {

  public static async getChargingStation(tenantID: string, id: string): Promise<ChargingStation> {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'getChargingStation');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Query single Charging Station
    const result = await ChargingStationStorage.getChargingStations(tenantID, {
      chargeBoxID: id
    }, Constants.DB_PARAMS_SINGLE_RECORD);
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'getChargingStation', uniqueTimerID);
    return result.count>0 ? result.result[0] : null;
  }

  public static async getChargingStations(tenantID: string, params:
    {search?:string,siteAreaID?:string,withNoSiteArea?:boolean,siteIDs?:string[],withSite?:boolean,chargeBoxID?:string,
      errorType?:'missingSettings'|'connectionBroken'|'connectorError'|'missingSiteArea'|'all',includeDeleted?:boolean},
    { limit, skip, sort, onlyRecordCount }: DbParams, projectFields?: string[]): Promise<{count: number, result: ChargingStation[]}> {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'getChargingStations');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check Limit
    limit = Utils.checkRecordLimit(limit);
    // Check Skip
    skip = Utils.checkRecordSkip(skip);
    // Create Aggregation
    let aggregation = [];
    let siteAreaJoin = [];
    let siteJoin = [];
    // Set the filters
    const filters: any = {
      $and: [{
        $or: DatabaseUtils.getNotDeletedFilter()
      }]
    };
    // Include deleted charging stations if requested
    if (params.includeDeleted) {
      filters.$and[0].$or.push({
        'deleted': true
      });
    }
    // Charger
    // TODO: Review for logical correctness: Moved up; why let aggregation stages process many chargers if we're only getting one anyway
    if (params.chargeBoxID) {
      filters.$and.push({
        '_id': params.chargeBoxID
      });
    }
    // Source?
    if (params.search) {
      // Build filter
      filters.$and.push({
        '$or': [
          { '_id': { $regex: params.search, $options: 'i' } },
          { 'chargePointModel': { $regex: params.search, $options: 'i' } },
          { 'chargePointVendor': { $regex: params.search, $options: 'i' } }
        ]
      });
    }
    // Query by siteAreaID
    if (params.siteAreaID) {
      // Build filter
      filters.$and.push({
        'siteAreaID': Utils.convertToObjectID(params.siteAreaID)
      });
    }
    // With no Site Area
    if (params.withNoSiteArea) {
      // Build filter
      filters.$and.push({
        'siteAreaID': null
      });
    } else {
      // Site Area
      DatabaseUtils.pushSiteAreaLookupInAggregation(
        { tenantID, aggregation: siteAreaJoin, localField: 'siteAreaID', foreignField: '_id',
          asField: 'siteArea', oneToOneCardinality: true });
    }
    // Check Site ID
    if (params.siteIDs && Array.isArray(params.siteIDs) && params.siteIDs.length > 0) {
      // If sites but no site area, no results can be found - return early.
      // TODO: Please review for logical correctness
      if(params.withNoSiteArea)
        return {count: 0, result: []};
      // Build filter
      filters.$and.push({
        'siteArea.siteID': {
          $in: params.siteIDs // TODO: Only string cuz has previously been converted to string
        }
      });
    }
    if (params.withSite && !params.withNoSiteArea) {
      // Site
      DatabaseUtils.pushSiteLookupInAggregation(
        { tenantID, aggregation: siteJoin, localField: 'siteArea.siteID', foreignField: '_id',
          asField: 'siteArea.site', oneToOneCardinality: true });
      // TODO: Might not work because siteID is already a string and not objectId. site should be removed tbh...
    }
    // Build facets meaning each different error scenario
    let facets: any = {$facet:{}};
    if (params.errorType && params.errorType !== 'all') {
      // Check allowed
      if (!(await Tenant.getTenant(tenantID)).isComponentActive(Constants.COMPONENTS.ORGANIZATION) && params.errorType === 'missingSiteArea') {
        throw new BackendError(null, 'Organization is not active whereas filter is on missing site.',
          'ChargingStationStorage', 'getChargingStationsInError');
      }
      // Build facet only for one error type
      facets.$facet = {};
      facets.$facet[params.errorType] = ChargingStationStorage._buildChargerInErrorFacet(params.errorType);
    } else if(params.errorType && params.errorType === 'all') {
      facets = {
        '$facet':
        {
          'missingSettings': ChargingStationStorage._buildChargerInErrorFacet('missingSettings'),
          'connectionBroken': ChargingStationStorage._buildChargerInErrorFacet('connectionBroken'),
          'connectorError': ChargingStationStorage._buildChargerInErrorFacet('connectorError'),
        }
      };
      if ((await Tenant.getTenant(tenantID)).isComponentActive(Constants.COMPONENTS.ORGANIZATION)) {
        // Add facet for missing Site Area ID
        facets.$facet.missingSiteArea = ChargingStationStorage._buildChargerInErrorFacet('missingSiteArea');
      }
    }
    // Merge in each facet the join for sitearea and siteareaid
    const project = [];
    for (const facet in facets.$facet) {
      if (siteAreaJoin.length > 0) {
        facets.$facet[facet] = [...facets.$facet[facet], ...siteAreaJoin];
      }
      if (siteJoin.length > 0) {
        facets.$facet[facet] = [...facets.$facet[facet], ...siteJoin];
        // Filters
        facets.$facet[facet].push({
          $match: filters
        });
      }
      project.push(`$${facet}`);
    }
    if(params.errorType) {
      aggregation.push(facets);
      // Manipulate the results to convert it to an array of document on root level
      aggregation.push({ $project: { 'allItems': { $concatArrays: project } } });
      aggregation.push({ $unwind: { 'path': '$allItems' } });
      aggregation.push({ $replaceRoot: { newRoot: '$allItems' } });
      // Add a unique identifier as we may have the same charger several time
      aggregation.push({ $addFields: { 'uniqueId': { $concat: ['$_id', '#', '$errorCode'] } } });
    } else {
      aggregation = aggregation.concat(siteAreaJoin).concat(siteJoin);
    }
    // Limit records?
    if (!onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const chargingStationsCountMDB = await global.database.getCollection<any>(tenantID, 'chargingstations')
      .aggregate([...aggregation, { $count: 'count' }])
      .toArray();
    // Check if only the total count is requested
    if (onlyRecordCount) {
      // Return only the count
      return {
        count: (chargingStationsCountMDB.length > 0 ? chargingStationsCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Change ID
    DatabaseUtils.renameDatabaseID(aggregation);
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
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
          id: 1
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
    const chargingStationsFacetMDB = await global.database.getCollection<ChargingStation>(tenantID, 'chargingstations')
      .aggregate(aggregation, {
        collation: {
          locale: Constants.DEFAULT_LOCALE,
          strength: 2
        }
      })
      .toArray();
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'getChargingStations', uniqueTimerID);
    // Ok
    return {
      count: (chargingStationsCountMDB.length > 0 ?
        (chargingStationsCountMDB[0].count === Constants.DB_RECORD_COUNT_CEIL ? -1 : chargingStationsCountMDB[0].count) : 0),
      result: chargingStationsFacetMDB
    };
  }

  private static _buildChargerInErrorFacet(errorType:'missingSettings'|'connectionBroken'|'connectorError'|'missingSiteArea') {
    switch (errorType) {
      case 'missingSettings':
        return [{
          $match: {
            $or: [
              { 'maximumPower': { $exists: false } }, { 'maximumPower': { $lte: 0 } }, { 'maximumPower': null },
              { 'chargePointModel': { $exists: false } }, { 'chargePointModel': { $eq: '' } },
              { 'chargePointVendor': { $exists: false } }, { 'chargePointVendor': { $eq: '' } },
              { 'numberOfConnectedPhase': { $exists: false } }, { 'numberOfConnectedPhase': null }, { 'numberOfConnectedPhase': { $nin: [0, 1, 3] } },
              { 'powerLimitUnit': { $exists: false } }, { 'powerLimitUnit': null }, { 'powerLimitUnit': { $nin: ['A', 'W'] } },
              { 'chargingStationURL': { $exists: false } }, { 'chargingStationURL': null }, { 'chargingStationURL': { $eq: '' } },
              { 'cannotChargeInParallel': { $exists: false } }, { 'cannotChargeInParallel': null },
              { 'connectors.type': { $exists: false } }, { 'connectors.type': null }, { 'connectors.type': { $eq: '' } },
              { 'connectors.power': { $exists: false } }, { 'connectors.power': null }, { 'connectors.power': { $lte: 0 } }
            ]
          }
        },
        { $addFields: { 'errorCode': 'missingSettings' } }
        ];
      case 'connectionBroken': {
        const inactiveDate = new Date(new Date().getTime() - 3 * 60 * 1000);
        return [
          { $match: { 'lastHeartBeat': { $lte: inactiveDate } } },
          { $addFields: { 'errorCode': 'connectionBroken' } }
        ];
      }
      case 'connectorError':
        return [
          { $match: { $or: [{ 'connectors.errorCode': { $ne: 'NoError' } }, { 'connectors.status': { $eq: 'Faulted' } }] } },
          { $addFields: { 'errorCode': 'connectorError' } }
        ];
      case 'missingSiteArea':
        return [
          { $match: { $or: [{ 'siteAreaID': { $exists: false } }, { 'siteAreaID': null }] } },
          { $addFields: { 'errorCode': 'missingSiteArea' } }
        ];
      default:
        return [];
    }
  }

  public static async saveChargingStation(tenantID: string, chargingStationToSave: Partial<ChargingStation>): Promise<string> {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'saveChargingStation');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check if ID is provided
    if(!chargingStationToSave.id) {
      throw new BackendError(
        Constants.CENTRAL_SERVER,
        'ChargingStation has no ID',
        'ChargingStationStorage', 'saveChargingStation');
    }
    // Build Request
    const chargingStationFilter = {
      _id: chargingStationToSave.id
    };
    // Properties to save
    const chargingStationMDB = {
      _id: chargingStationToSave.id,
      createdBy: chargingStationToSave.createdBy ? chargingStationToSave.createdBy.id : null,
      lastChangedBy: chargingStationToSave.lastChangedBy ? chargingStationToSave.lastChangedBy : null,
      siteAreaID: chargingStationToSave.siteArea ? chargingStationToSave.siteArea.id : null, // TODO: what if chARging station queried wo SA
      ...chargingStationToSave
    };
    // Clean up mongo request
    delete chargingStationMDB.id;
    delete chargingStationMDB.siteArea;
    // Convert Created/LastChanged By
    DatabaseUtils.addLastChangedCreatedProps(chargingStationMDB, chargingStationMDB);
    // Modify and return the modified document
    const result = await global.database.getCollection<any>(tenantID, 'chargingstations').findOneAndUpdate(
    chargingStationFilter,
    { $set: chargingStationMDB },
    { upsert: true });
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'saveChargingStation', uniqueTimerID);
    return chargingStationMDB._id;
  }

  public static async saveChargingStationConnector(tenantID: string, chargingStation: ChargingStation, connector: Connector): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'saveChargingStationConnector');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const updatedFields: any = {};
    updatedFields['connectors.' + (connector.connectorId - 1)] = connector;
    // Update model
    chargingStation.connectors[connector.connectorId - 1] = connector;
    // Modify and return the modified document
    const result = await global.database.getCollection<any>(tenantID, 'chargingstations').findOneAndUpdate({
      '_id': chargingStation.id
    }, {
      $set: updatedFields
    }, {
      upsert: true
    });
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'saveChargingStationConnector', uniqueTimerID);
  }

  // TODO: Could be removed and just handled in saveChargingStation (the update), right?
  public static async saveChargingStationHeartBeat(tenantID: string, chargingStation: ChargingStation): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'saveChargingStationHeartBeat');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const updatedFields: any = {};
    updatedFields['lastHeartBeat'] = Utils.convertToDate(chargingStation.lastHeartBeat);
    // Modify and return the modified document
    await global.database.getCollection<any>(tenantID, 'chargingstations').findOneAndUpdate({
      '_id': chargingStation.id
    }, {
      $set: updatedFields
    }, {
      upsert: true
    });
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'saveChargingStationHeartBeat', uniqueTimerID);
  }

  public static async deleteChargingStation(tenantID: string, id: string) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'deleteChargingStation');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Delete Configuration
    await global.database.getCollection<any>(tenantID, 'configurations')
      .findOneAndDelete({ '_id': id });
    // Delete Charger
    await global.database.getCollection<any>(tenantID, 'chargingstations')
      .findOneAndDelete({ '_id': id });
    // Keep the rest (bootnotif, authorize...)
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'deleteChargingStation', uniqueTimerID);
  }

  public static async getConfigurationParamValue(tenantID: string, chargeBoxID: string, paramName: string) {
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
        }
        // Continue
        return true;
      });
    }
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'getConfigurationParamValue', uniqueTimerID);
    return value;
  }

  public static async getConfiguration(tenantID: string, chargeBoxID: string) { // TODO: Typing configuration would be hard because of the setting variations
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'getConfiguration');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const configurationsMDB = await global.database.getCollection<any>(tenantID, 'configurations')
      .findOne({
        '_id': chargeBoxID
      });
    // Found?
    let configuration = null;
    if (configurationsMDB && configurationsMDB.length > 0) {
      // Set values
      configuration = {
        id: configurationsMDB._id.toHexString(),
        timestamp: Utils.convertToDate(configurationsMDB.timestamp),
        configuration: configurationsMDB.configuration
      };
    }
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'getConfiguration', uniqueTimerID);
    return configuration;
  }

  public static async removeChargingStationsFromSiteArea(tenantID: string, siteAreaID: string, chargingStationIDs: string[]): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'removeChargingStationsFromSiteArea');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Site provided?
    if (siteAreaID) {
      // At least one User
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
    Logging.traceEnd('ChargingStationStorage', 'removeChargingStationsFromSiteArea', uniqueTimerID, {
      siteAreaID,
      chargingStationIDs
    });
  }

  public static async addChargingStationsToSiteArea(tenantID: string, siteAreaID: string, chargingStationIDs: string[]): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('ChargingStationStorage', 'addChargingStationsToSiteArea');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Site provided?
    if (siteAreaID) {
      // At least one User
      if (chargingStationIDs && chargingStationIDs.length > 0) {
        // Update all chargers
        await global.database.getCollection<any>(tenantID, 'chargingstations').updateMany({
          $and: [
            { '_id': { $in: chargingStationIDs } },
            { 'siteAreaID': null }
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
