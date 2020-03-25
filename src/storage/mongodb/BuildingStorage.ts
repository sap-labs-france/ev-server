import { ObjectID } from 'mongodb';
import Building from '../../types/Building';
import DbParams from '../../types/database/DbParams';
import { DataResult } from '../../types/DataResult';
import global from '../../types/GlobalType';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import DatabaseUtils from './DatabaseUtils';

export default class BuildingStorage {

  public static async getBuilding(tenantID: string, id: string,
    params: { withSiteArea?: boolean} = {}): Promise<Building> {
    // Debug
    const uniqueTimerID = Logging.traceStart('BuildingStorage', 'getBuilding');
    // Reuse
    const buildingsMDB = await BuildingStorage.getBuildings(
      tenantID,
      {
        buildingID: id,
        withSiteArea: params.withSiteArea
      },
      Constants.DB_PARAMS_SINGLE_RECORD
    );
    let building: Building = null;
    // Check
    if (buildingsMDB && buildingsMDB.count > 0) {
      building = buildingsMDB.result[0];
    }
    // Debug
    Logging.traceEnd('BuildingStorage', 'getBuilding', uniqueTimerID,
      {
        id,
        withSiteArea: params.withSiteArea
      });
    return building;
  }

  public static async getBuildingImage(tenantID: string, id: string): Promise<{ id: string; image: string }> {
    // Debug
    const uniqueTimerID = Logging.traceStart('BuildingStorage', 'getBuildingImage');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const buildingImageMDB = await global.database.getCollection<{ _id: ObjectID; image: string }>(tenantID, 'buildingimages')
      .findOne({ _id: Utils.convertToObjectID(id) });
    // Debug
    Logging.traceEnd('BuildingStorage', 'getBuildingImage', uniqueTimerID, { id });
    return {
      id: id,
      image: buildingImageMDB ? buildingImageMDB.image : null
    };
  }

  public static async saveBuilding(tenantID: string, buildingToSave: Building, saveImage = true): Promise<string> {
    // Debug
    const uniqueTimerID = Logging.traceStart('BuildingStorage', 'saveBuilding');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Set
    const buildingMDB: any = {
      _id: !buildingToSave.id ? new ObjectID() : Utils.convertToObjectID(buildingToSave.id),
      name: buildingToSave.name,
      siteAreaID: !buildingToSave.siteAreaID ? new ObjectID() : Utils.convertToObjectID(buildingToSave.siteAreaID),
      issuer: buildingToSave.issuer,
    };
    if (buildingToSave.address) {
      buildingMDB.address = buildingToSave.address;
    }
    // Add Last Changed/Created props
    DatabaseUtils.addLastChangedCreatedProps(buildingMDB, buildingToSave);
    // Modify
    await global.database.getCollection<Building>(tenantID, 'buildings').findOneAndUpdate(
      { _id: buildingMDB._id },
      { $set: buildingMDB },
      { upsert: true }
    );
    // Save Image
    if (saveImage) {
      await BuildingStorage._saveBuildingImage(tenantID, buildingMDB._id.toHexString(), buildingToSave.image);
    }
    // Debug
    Logging.traceEnd('BuildingStorage', 'saveBuilding', uniqueTimerID, { buildingToSave });
    return buildingMDB._id.toHexString();
  }

  public static async getBuildings(tenantID: string,
    params: { search?: string; buildingID?: string; buildingIDs?: string[]; siteAreaIDs?: string[]; withSiteArea?: boolean;
      withNoSiteArea?: boolean; } = {},
    dbParams?: DbParams, projectFields?: string[]): Promise<DataResult<Building>> {
    // Debug
    const uniqueTimerID = Logging.traceStart('BuildingStorage', 'getBuildings');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check Limit
    const limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    const skip = Utils.checkRecordSkip(dbParams.skip);
    // Set the filters
    const filters: ({ _id?: ObjectID; $or?: any[]; $and?: any[]; } | undefined) = {};
    // Build filter
    if (params.buildingID) {
      filters._id = Utils.convertToObjectID(params.buildingID);
    } else if (params.search) {
      const searchRegex = Utils.escapeSpecialCharsInRegex(params.search);
      filters.$or = [
        { 'name': { $regex: searchRegex, $options: 'i' } },
        { 'address.city': { $regex: searchRegex, $options: 'i' } },
        { 'address.country': { $regex: searchRegex, $options: 'i' } }
      ];
    }
    // With no Site Area
    if (params.withNoSiteArea) {
      filters.$and = [
        { 'siteAreaID': null }
      ];
    } else if (params.siteAreaIDs && Array.isArray(params.siteAreaIDs) && params.siteAreaIDs.length > 0) {
      filters.$and = [
        { 'siteAreaID': { $in: params.siteAreaIDs.map((id) => Utils.convertToObjectID(id)) } }
      ];
    }
    // Create Aggregation
    const aggregation = [];
    // Limit on Building for Basic Users
    if (params.buildingIDs && params.buildingIDs.length > 0) {
      // Build filter
      aggregation.push({
        $match: {
          _id: { $in: params.buildingIDs.map((buildingID) => Utils.convertToObjectID(buildingID)) }
        }
      });
    }
    // Filters
    if (filters) {
      aggregation.push({
        $match: filters
      });
    }
    // Site Area
    if (params.withSiteArea) {
      DatabaseUtils.pushSiteAreaLookupInAggregation(
        {
          tenantID, aggregation, localField: 'siteAreaID', foreignField: '_id',
          asField: 'siteArea', oneToOneCardinality: true
        });
    }
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const buildingsCountMDB = await global.database.getCollection<DataResult<Building>>(tenantID, 'buildings')
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      // Return only the count
      return {
        count: (buildingsCountMDB.length > 0 ? buildingsCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Sort
    if (dbParams.sort) {
      aggregation.push({
        $sort: dbParams.sort
      });
    } else {
      aggregation.push({
        $sort: { name: 1 }
      });
    }
    // Skip
    if (skip > 0) {
      aggregation.push({ $skip: skip });
    }
    // Limit
    aggregation.push({
      $limit: (limit > 0 && limit < Constants.DB_RECORD_COUNT_CEIL) ? limit : Constants.DB_RECORD_COUNT_CEIL
    });
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const buildings = await global.database.getCollection<any>(tenantID, 'buildings')
      .aggregate(aggregation, {
        collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 },
        allowDiskUse: true
      })
      .toArray();
    // Debug
    Logging.traceEnd('BuildingStorage', 'getBuildings', uniqueTimerID,
      { params, limit: dbParams.limit, skip: dbParams.skip, sort: dbParams.sort });
    // Ok
    return {
      count: (buildingsCountMDB.length > 0 ?
        (buildingsCountMDB[0].count === Constants.DB_RECORD_COUNT_CEIL ? -1 : buildingsCountMDB[0].count) : 0),
      result: buildings
    };
  }

  public static async deleteBuilding(tenantID: string, id: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('BuildingStorage', 'deleteBuilding');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Delete the Building
    await global.database.getCollection<Building>(tenantID, 'buildings')
      .findOneAndDelete({ '_id': Utils.convertToObjectID(id) });
    // Delete Image
    await global.database.getCollection<any>(tenantID, 'buildingimages')
      .findOneAndDelete({ '_id': Utils.convertToObjectID(id) });
    // Debug
    Logging.traceEnd('BuildingStorage', 'deleteBuilding', uniqueTimerID, { id });
  }

  public static async addBuildingsToSiteArea(tenantID: string, siteAreaID: string, buildingIDs: string[]): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('BuildingStorage', 'addBuildingsToSiteArea');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Site Area provided?
    if (siteAreaID) {
      // At least one Building
      if (buildingIDs && buildingIDs.length > 0) {
        // Update all buildings
        await global.database.getCollection<any>(tenantID, 'buildings').updateMany({
          $and: [
            { '_id': { $in: buildingIDs.map((buildingID) => Utils.convertToObjectID(buildingID)) } }
          ]
        }, {
          $set: { siteAreaID: Utils.convertToObjectID(siteAreaID) }
        }, {
          upsert: false
        });
      }
    }
    // Debug
    Logging.traceEnd('BuildingStorage', 'addBuildingsToSiteArea', uniqueTimerID, {
      siteAreaID,
      buildingIDs
    });
  }

  public static async removeBuildingsFromSiteArea(tenantID: string, siteAreaID: string, buildingIDs: string[]): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('BuildingStorage', 'removeBuildingsFromSiteArea');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Site Area provided?
    if (siteAreaID) {
      // At least one Building
      if (buildingIDs && buildingIDs.length > 0) {
        // Update all buildings
        await global.database.getCollection<any>(tenantID, 'buildings').updateMany({
          $and: [
            { '_id': { $in: buildingIDs.map((buildingID) => Utils.convertToObjectID(buildingID)) } },
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
    Logging.traceEnd('BuildingStorage', 'removeBuildingsFromSiteArea', uniqueTimerID, {
      siteAreaID,
      buildingIDs
    });
  }

  private static async _saveBuildingImage(tenantID: string, buildingID: string, buildingImageToSave: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('BuildingStorage', 'saveBuildingImage');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Modify
    await global.database.getCollection<any>(tenantID, 'buildingimages').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(buildingID) },
      { $set: { image: buildingImageToSave } },
      { upsert: true });
    // Debug
    Logging.traceEnd('BuildingStorage', 'saveBuildingImage', uniqueTimerID, {});
  }
}
