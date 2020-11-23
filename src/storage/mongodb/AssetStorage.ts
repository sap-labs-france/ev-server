import global, { FilterParams } from '../../types/GlobalType';

import Asset from '../../types/Asset';
import { AssetInErrorType } from '../../types/InError';
import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import { ObjectID } from 'mongodb';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'AssetStorage';

export default class AssetStorage {
  public static async getAsset(tenantID: string, id: string = Constants.UNKNOWN_OBJECT_ID,
    params: { withSiteArea?: boolean} = {}, projectFields?: string[]): Promise<Asset> {
    const assetsMDB = await AssetStorage.getAssets(tenantID, {
      assetIDs: [id],
      withSiteArea: params.withSiteArea
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return assetsMDB.count === 1 ? assetsMDB.result[0] : null;
  }

  public static async getAssetImage(tenantID: string, id: string): Promise<{ id: string; image: string }> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getAssetImage');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const assetImageMDB = await global.database.getCollection<{ _id: ObjectID; image: string }>(tenantID, 'assetimages')
      .findOne({ _id: Utils.convertToObjectID(id) });
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'getAssetImage', uniqueTimerID, assetImageMDB);
    return {
      id: id,
      image: assetImageMDB ? assetImageMDB.image : null
    };
  }

  public static async saveAsset(tenantID: string, assetToSave: Asset, saveImage = true): Promise<string> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'saveAsset');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Set
    const assetMDB: any = {
      _id: assetToSave.id ? Utils.convertToObjectID(assetToSave.id) : new ObjectID(),
      name: assetToSave.name,
      siteAreaID: Utils.convertToObjectID(assetToSave.siteAreaID),
      coordinates: Utils.containsGPSCoordinates(assetToSave.coordinates) ? assetToSave.coordinates.map(
        (coordinate) => Utils.convertToFloat(coordinate)) : [],
      assetType: assetToSave.assetType,
      dynamicAsset: assetToSave.dynamicAsset,
      issuer: Utils.convertToBoolean(assetToSave.issuer),
      connectionID: assetToSave.connectionID,
      meterID: assetToSave.meterID,
      currentConsumptionWh: Utils.convertToFloat(assetToSave.currentConsumptionWh),
      currentInstantAmps: Utils.convertToFloat(assetToSave.currentInstantAmps),
      currentInstantAmpsL1: Utils.convertToFloat(assetToSave.currentInstantAmpsL1),
      currentInstantAmpsL2: Utils.convertToFloat(assetToSave.currentInstantAmpsL2),
      currentInstantAmpsL3: Utils.convertToFloat(assetToSave.currentInstantAmpsL3),
      currentInstantVolts: Utils.convertToFloat(assetToSave.currentInstantVolts),
      currentInstantVoltsL1: Utils.convertToFloat(assetToSave.currentInstantVoltsL1),
      currentInstantVoltsL2: Utils.convertToFloat(assetToSave.currentInstantVoltsL2),
      currentInstantVoltsL3: Utils.convertToFloat(assetToSave.currentInstantVoltsL3),
      currentInstantWatts: Utils.convertToFloat(assetToSave.currentInstantWatts),
      currentInstantWattsL1: Utils.convertToFloat(assetToSave.currentInstantWattsL1),
      currentInstantWattsL2: Utils.convertToFloat(assetToSave.currentInstantWattsL2),
      currentInstantWattsL3: Utils.convertToFloat(assetToSave.currentInstantWattsL3),
    };
    if (assetToSave.lastConsumption) {
      assetMDB.lastConsumption = {
        value: Utils.convertToFloat(assetToSave.lastConsumption.value),
        timestamp: Utils.convertToDate(assetToSave.lastConsumption.timestamp)
      };
    }
    // Add Last Changed/Created props
    DatabaseUtils.addLastChangedCreatedProps(assetMDB, assetToSave);
    // Modify
    await global.database.getCollection<Asset>(tenantID, 'assets').findOneAndUpdate(
      { _id: assetMDB._id },
      { $set: assetMDB },
      { upsert: true }
    );
    // Save Image
    if (saveImage) {
      await AssetStorage.saveAssetImage(tenantID, assetMDB._id.toHexString(), assetToSave.image);
    }
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'saveAsset', uniqueTimerID, assetMDB);
    return assetMDB._id.toHexString();
  }

  public static async getAssets(tenantID: string,
    params: { search?: string; assetIDs?: string[]; siteAreaIDs?: string[]; withSiteArea?: boolean;
      withNoSiteArea?: boolean; dynamicOnly?: boolean } = {},
    dbParams?: DbParams, projectFields?: string[]): Promise<DataResult<Asset>> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getAssets');
    // Check Tenant
    await Utils.checkTenant(tenantID);
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
    // Search
    if (params.search) {
      const searchRegex = Utils.escapeSpecialCharsInRegex(params.search);
      filters.$or = [
        { 'name': { $regex: searchRegex, $options: 'i' } },
      ];
    }
    // With no Site Area
    if (params.withNoSiteArea) {
      filters.siteAreaID = null;
    } else if (!Utils.isEmptyArray(params.siteAreaIDs)) {
      filters.siteAreaID = {
        $in: params.siteAreaIDs.map((id) => Utils.convertToObjectID(id))
      };
    }
    // Dynamic Asset
    if (params.dynamicOnly) {
      filters.dynamicAsset = true;
    }
    // Limit on Asset for Basic Users
    if (!Utils.isEmptyArray(params.assetIDs)) {
      // Build filter
      filters._id = {
        $in: params.assetIDs.map((assetID) => Utils.convertToObjectID(assetID))
      };
    }
    // Filters
    if (!Utils.isEmptyJSon(filters)) {
      aggregation.push({
        $match: filters
      });
    }
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const assetsCountMDB = await global.database.getCollection<DataResult<Asset>>(tenantID, 'assets')
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      // Return only the count
      Logging.traceEnd(tenantID, MODULE_NAME, 'getAssets', uniqueTimerID, assetsCountMDB);
      return {
        count: (assetsCountMDB.length > 0 ? assetsCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Sort
    if (!dbParams.sort) {
      dbParams.sort = { name: 1 };
    }
    aggregation.push({
      $sort: dbParams.sort
    });
    // Skip
    if (dbParams.skip > 0) {
      aggregation.push({ $skip: dbParams.skip });
    }
    // Limit
    aggregation.push({
      $limit: (dbParams.limit > 0 && dbParams.limit < Constants.DB_RECORD_COUNT_CEIL) ? dbParams.limit : Constants.DB_RECORD_COUNT_CEIL
    });
    // Site Area
    if (params.withSiteArea) {
      DatabaseUtils.pushSiteAreaLookupInAggregation({
        tenantID, aggregation, localField: 'siteAreaID', foreignField: '_id',
        asField: 'siteArea', oneToOneCardinality: true
      });
    }
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteAreaID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteArea.siteID');
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const assetsMDB = await global.database.getCollection<any>(tenantID, 'assets')
      .aggregate(aggregation, {
        collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 },
        allowDiskUse: true
      })
      .toArray();
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'getAssets', uniqueTimerID, assetsMDB);
    return {
      count: (assetsCountMDB.length > 0 ?
        (assetsCountMDB[0].count === Constants.DB_RECORD_COUNT_CEIL ? -1 : assetsCountMDB[0].count) : 0),
      result: assetsMDB
    };
  }

  public static async getAssetsInError(tenantID: string,
    params: { search?: string; siteAreaIDs?: string[]; errorType?: string[] } = {},
    dbParams?: DbParams, projectFields?: string[]): Promise<DataResult<Asset>> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getAssetsInError');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Set the filters
    const filters: FilterParams = {};
    if (params.search) {
      const searchRegex = Utils.escapeSpecialCharsInRegex(params.search);
      filters.$or = [
        { 'name': { $regex: searchRegex, $options: 'i' } },
      ];
    }
    if (!Utils.isEmptyArray(params.siteAreaIDs)) {
      filters.siteAreaID = { $in: params.siteAreaIDs.map((id) => Utils.convertToObjectID(id)) };
    }
    // Create Aggregation
    const aggregation = [];
    // Filters
    if (!Utils.isEmptyJSon(filters)) {
      aggregation.push({
        $match: filters
      });
    }
    // Build facets for each type of error if any
    const facets: any = { $facet: {} };
    if (!Utils.isEmptyArray(params.errorType)) {
      // Build facet only for one error type
      const array = [];
      params.errorType.forEach((type) => {
        array.push(`$${type}`);
        facets.$facet[type] = AssetStorage.getAssetInErrorFacet(type);
      });
      aggregation.push(facets);
      // Manipulate the results to convert it to an array of document on root level
      aggregation.push({ $project: { assetsInError: { $setUnion: array } } });
      aggregation.push({ $unwind: '$assetsInError' });
      aggregation.push({ $replaceRoot: { newRoot: '$assetsInError' } });
    }
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteAreaID');
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);
    // Sort
    if (!dbParams.sort) {
      dbParams.sort = { name: 1 };
    }
    aggregation.push({
      $sort: dbParams.sort
    });
    // Skip
    if (dbParams.skip > 0) {
      aggregation.push({ $skip: dbParams.skip });
    }
    // Limit
    aggregation.push({
      $limit: (dbParams.limit > 0 && dbParams.limit < Constants.DB_RECORD_COUNT_CEIL) ? dbParams.limit : Constants.DB_RECORD_COUNT_CEIL
    });
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const assetsMDB = await global.database.getCollection<any>(tenantID, 'assets')
      .aggregate(aggregation, {
        collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 },
        allowDiskUse: true
      })
      .toArray();
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'getAssetsInError', uniqueTimerID, assetsMDB);
    // Ok
    return {
      count: assetsMDB.length,
      result: assetsMDB
    };
  }

  public static async deleteAsset(tenantID: string, id: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'deleteAsset');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Delete the Asset
    await global.database.getCollection<Asset>(tenantID, 'assets')
      .findOneAndDelete({ '_id': Utils.convertToObjectID(id) });
    // Delete Image
    await global.database.getCollection<any>(tenantID, 'assetimages')
      .findOneAndDelete({ '_id': Utils.convertToObjectID(id) });
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'deleteAsset', uniqueTimerID, { id });
  }

  private static async saveAssetImage(tenantID: string, assetID: string, assetImageToSave: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'saveAssetImage');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Modify
    await global.database.getCollection<any>(tenantID, 'assetimages').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(assetID) },
      { $set: { image: assetImageToSave } },
      { upsert: true });
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'saveAssetImage', uniqueTimerID, assetImageToSave);
  }

  private static getAssetInErrorFacet(errorType: string) {
    switch (errorType) {
      case AssetInErrorType.MISSING_SITE_AREA:
        return [
          { $match: { $or: [{ 'siteAreaID': { $exists: false } }, { 'siteAreaID': null }] } },
          { $addFields: { 'errorCode': AssetInErrorType.MISSING_SITE_AREA } }
        ];
      default:
        return [];
    }
  }
}
