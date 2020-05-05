import Asset from '../../types/Asset';
import { AssetInErrorType } from '../../types/InError';
import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import { ObjectID } from 'mongodb';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

export default class AssetStorage {

  public static async getAsset(tenantID: string, id: string,
    params: { withSiteArea?: boolean} = {}): Promise<Asset> {
    // Debug
    const uniqueTimerID = Logging.traceStart('AssetStorage', 'getAsset');
    // Reuse
    const assetsMDB = await AssetStorage.getAssets(
      tenantID,
      {
        assetID: id,
        withSiteArea: params.withSiteArea
      },
      Constants.DB_PARAMS_SINGLE_RECORD
    );
    let asset: Asset = null;
    // Check
    if (assetsMDB && assetsMDB.count > 0) {
      asset = assetsMDB.result[0];
    }
    // Debug
    Logging.traceEnd('AssetStorage', 'getAsset', uniqueTimerID,
      {
        id,
        withSiteArea: params.withSiteArea
      });
    return asset;
  }

  public static async getAssetImage(tenantID: string, id: string): Promise<{ id: string; image: string }> {
    // Debug
    const uniqueTimerID = Logging.traceStart('AssetStorage', 'getAssetImage');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const assetImageMDB = await global.database.getCollection<{ _id: ObjectID; image: string }>(tenantID, 'assetimages')
      .findOne({ _id: Utils.convertToObjectID(id) });
    // Debug
    Logging.traceEnd('AssetStorage', 'getAssetImage', uniqueTimerID, { id });
    return {
      id: id,
      image: assetImageMDB ? assetImageMDB.image : null
    };
  }

  public static async saveAsset(tenantID: string, assetToSave: Asset, saveImage = true): Promise<string> {
    // Debug
    const uniqueTimerID = Logging.traceStart('AssetStorage', 'saveAsset');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Set
    const assetMDB: any = {
      _id: !assetToSave.id ? new ObjectID() : Utils.convertToObjectID(assetToSave.id),
      name: assetToSave.name,
      siteAreaID: !assetToSave.siteAreaID ? new ObjectID() : Utils.convertToObjectID(assetToSave.siteAreaID),
      coordinates: assetToSave.coordinates,
      assetType: assetToSave.assetType,
      issuer: assetToSave.issuer,
    };
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
    Logging.traceEnd('AssetStorage', 'saveAsset', uniqueTimerID, { assetToSave });
    return assetMDB._id.toHexString();
  }

  public static async getAssets(tenantID: string,
    params: { search?: string; assetID?: string; assetIDs?: string[]; siteAreaIDs?: string[]; withSiteArea?: boolean;
      withNoSiteArea?: boolean; } = {},
    dbParams?: DbParams, projectFields?: string[]): Promise<DataResult<Asset>> {
    // Debug
    const uniqueTimerID = Logging.traceStart('AssetStorage', 'getAssets');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check Limit
    const limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    const skip = Utils.checkRecordSkip(dbParams.skip);
    // Set the filters
    const filters: ({ _id?: ObjectID; $or?: any[]; $and?: any[] } | undefined) = {};
    // Build filter
    if (params.assetID) {
      filters._id = Utils.convertToObjectID(params.assetID);
    } else if (params.search) {
      const searchRegex = Utils.escapeSpecialCharsInRegex(params.search);
      filters.$or = [
        { 'name': { $regex: searchRegex, $options: 'i' } },
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
    // Limit on Asset for Basic Users
    if (params.assetIDs && params.assetIDs.length > 0) {
      // Build filter
      aggregation.push({
        $match: {
          _id: { $in: params.assetIDs.map((assetID) => Utils.convertToObjectID(assetID)) }
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
    const assetsCountMDB = await global.database.getCollection<DataResult<Asset>>(tenantID, 'assets')
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      // Return only the count
      return {
        count: (assetsCountMDB.length > 0 ? assetsCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteAreaID');
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);
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
    const assets = await global.database.getCollection<any>(tenantID, 'assets')
      .aggregate(aggregation, {
        collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 },
        allowDiskUse: true
      })
      .toArray();
    // Debug
    Logging.traceEnd('AssetStorage', 'getAssets', uniqueTimerID,
      { params, limit: dbParams.limit, skip: dbParams.skip, sort: dbParams.sort });
    // Ok
    return {
      count: (assetsCountMDB.length > 0 ?
        (assetsCountMDB[0].count === Constants.DB_RECORD_COUNT_CEIL ? -1 : assetsCountMDB[0].count) : 0),
      result: assets
    };
  }

  public static async getAssetsInError(tenantID: string,
    params: { search?: string; siteAreaIDs?: string[]; errorType?: string[] } = {},
    dbParams?: DbParams, projectFields?: string[]): Promise<DataResult<Asset>> {
    // Debug
    const uniqueTimerID = Logging.traceStart('AssetStorage', 'getAssetsInError');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check Limit
    const limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    const skip = Utils.checkRecordSkip(dbParams.skip);
    // Set the filters
    const filters: ({ _id?: ObjectID; $or?: any[]; $and?: any[] } | undefined) = {};
    if (params.search) {
      const searchRegex = Utils.escapeSpecialCharsInRegex(params.search);
      filters.$or = [
        { 'name': { $regex: searchRegex, $options: 'i' } },
      ];
    }
    if (params.siteAreaIDs && Array.isArray(params.siteAreaIDs) && params.siteAreaIDs.length > 0) {
      filters.$and = [
        { 'siteAreaID': { $in: params.siteAreaIDs.map((id) => Utils.convertToObjectID(id)) } }
      ];
    }
    // Create Aggregation
    const aggregation = [];
    // Filters
    if (filters) {
      aggregation.push({
        $match: filters
      });
    }
    // Build facets for each type of error if any
    const facets: any = { $facet: {} };
    if (params.errorType && Array.isArray(params.errorType) && params.errorType.length > 0) {
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
    const assetsMDB = await global.database.getCollection<any>(tenantID, 'assets')
      .aggregate(aggregation, {
        collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 },
        allowDiskUse: true
      })
      .toArray();
    // Debug
    Logging.traceEnd('AssetStorage', 'getAssetsInError', uniqueTimerID,
      { params, limit: dbParams.limit, skip: dbParams.skip, sort: dbParams.sort });
    // Ok
    return {
      count: assetsMDB.length,
      result: assetsMDB
    };
  }

  public static async deleteAsset(tenantID: string, id: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('AssetStorage', 'deleteAsset');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Delete the Asset
    await global.database.getCollection<Asset>(tenantID, 'assets')
      .findOneAndDelete({ '_id': Utils.convertToObjectID(id) });
    // Delete Image
    await global.database.getCollection<any>(tenantID, 'assetimages')
      .findOneAndDelete({ '_id': Utils.convertToObjectID(id) });
    // Debug
    Logging.traceEnd('AssetStorage', 'deleteAsset', uniqueTimerID, { id });
  }

  public static async addAssetsToSiteArea(tenantID: string, siteAreaID: string, assetIDs: string[]): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('AssetStorage', 'addAssetsToSiteArea');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Site Area provided?
    if (siteAreaID) {
      // At least one Asset
      if (assetIDs && assetIDs.length > 0) {
        // Update all assets
        await global.database.getCollection<any>(tenantID, 'assets').updateMany({
          $and: [
            { '_id': { $in: assetIDs.map((assetID) => Utils.convertToObjectID(assetID)) } }
          ]
        }, {
          $set: { siteAreaID: Utils.convertToObjectID(siteAreaID) }
        }, {
          upsert: false
        });
      }
    }
    // Debug
    Logging.traceEnd('AssetStorage', 'addAssetsToSiteArea', uniqueTimerID, {
      siteAreaID,
      assetIDs
    });
  }

  public static async removeAssetsFromSiteArea(tenantID: string, siteAreaID: string, assetIDs: string[]): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('AssetStorage', 'removeAssetsFromSiteArea');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Site Area provided?
    if (siteAreaID) {
      // At least one Asset
      if (assetIDs && assetIDs.length > 0) {
        // Update all assets
        await global.database.getCollection<any>(tenantID, 'assets').updateMany({
          $and: [
            { '_id': { $in: assetIDs.map((assetID) => Utils.convertToObjectID(assetID)) } },
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
    Logging.traceEnd('AssetStorage', 'removeAssetsFromSiteArea', uniqueTimerID, {
      siteAreaID,
      assetIDs
    });
  }

  private static async saveAssetImage(tenantID: string, assetID: string, assetImageToSave: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('AssetStorage', 'saveAssetImage');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Modify
    await global.database.getCollection<any>(tenantID, 'assetimages').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(assetID) },
      { $set: { image: assetImageToSave } },
      { upsert: true });
    // Debug
    Logging.traceEnd('AssetStorage', 'saveAssetImage', uniqueTimerID, {});
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
