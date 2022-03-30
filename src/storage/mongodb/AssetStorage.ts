import { ObjectId, UpdateResult } from 'mongodb';
import global, { DatabaseCount, FilterParams, Image } from '../../types/GlobalType';

import Asset from '../../types/Asset';
import { AssetInErrorType } from '../../types/InError';
import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'AssetStorage';

export default class AssetStorage {
  public static async getAsset(tenant: Tenant, id: string = Constants.UNKNOWN_OBJECT_ID,
      params: { withSiteArea?: boolean, siteIDs?: string[], issuer?: boolean } = {}, projectFields?: string[]): Promise<Asset> {
    const assetsMDB = await AssetStorage.getAssets(tenant, {
      assetIDs: [id],
      withSiteArea: params.withSiteArea,
      siteIDs: params.siteIDs,
      issuer: params.issuer
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return assetsMDB.count === 1 ? assetsMDB.result[0] : null;
  }

  public static async getAssetImage(tenant: Tenant, id: string): Promise<{ id: string; image: string }> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Read DB
    const assetImageMDB = await global.database.getCollection<any>(tenant.id, 'assetimages')
      .findOne({ _id: DatabaseUtils.convertToObjectID(id) }) as Image;
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getAssetImage', startTime, { id }, assetImageMDB);
    return {
      id: id,
      image: assetImageMDB ? assetImageMDB.image : null
    };
  }

  public static async saveAsset(tenant: Tenant, assetToSave: Asset, saveImage = true): Promise<string> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Set
    const assetMDB: any = {
      _id: assetToSave.id ? DatabaseUtils.convertToObjectID(assetToSave.id) : new ObjectId(),
      name: assetToSave.name,
      companyID: DatabaseUtils.convertToObjectID(assetToSave.companyID),
      siteID: DatabaseUtils.convertToObjectID(assetToSave.siteID),
      siteAreaID: DatabaseUtils.convertToObjectID(assetToSave.siteAreaID),
      coordinates: Utils.hasValidGpsCoordinates(assetToSave.coordinates) ? assetToSave.coordinates.map(
        (coordinate) => Utils.convertToFloat(coordinate)) : [],
      assetType: assetToSave.assetType,
      excludeFromSmartCharging: Utils.convertToBoolean(assetToSave.excludeFromSmartCharging),
      variationThresholdPercent: Utils.convertToFloat(assetToSave.variationThresholdPercent),
      powerWattsLastSmartChargingRun: Utils.convertToFloat(assetToSave.powerWattsLastSmartChargingRun),
      fluctuationPercent: Utils.convertToFloat(assetToSave.fluctuationPercent),
      staticValueWatt: Utils.convertToFloat(assetToSave.staticValueWatt),
      dynamicAsset: Utils.convertToBoolean(assetToSave.dynamicAsset),
      usesPushAPI: Utils.convertToBoolean(assetToSave.usesPushAPI),
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
      currentStateOfCharge: Utils.convertToFloat(assetToSave.currentStateOfCharge),
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
    await global.database.getCollection<any>(tenant.id, 'assets').findOneAndUpdate(
      { _id: assetMDB._id },
      { $set: assetMDB },
      { upsert: true }
    );
    // Save Image
    if (saveImage) {
      await AssetStorage.saveAssetImage(tenant, assetMDB._id.toString(), assetToSave.image);
    }
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveAsset', startTime, assetMDB);
    return assetMDB._id.toString();
  }

  public static async getAssets(tenant: Tenant,
      params: { search?: string; assetIDs?: string[]; siteAreaIDs?: string[]; siteIDs?: string[]; withSiteArea?: boolean;
        withSite?: boolean; withNoSiteArea?: boolean; dynamicOnly?: boolean; issuer?: boolean; } = {},
      dbParams?: DbParams, projectFields?: string[]): Promise<DataResult<Asset>> {
    const startTime = Logging.traceDatabaseRequestStart();
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
    // Search
    if (params.search) {
      filters.$or = [
        { 'name': { $regex: params.search, $options: 'i' } },
      ];
      if (DatabaseUtils.isObjectID(params.search)) {
        filters.$or.push({ '_id': DatabaseUtils.convertToObjectID(params.search) });
      }
    }
    // With no Site Area
    if (params.withNoSiteArea) {
      filters.siteAreaID = null;
    } else if (!Utils.isEmptyArray(params.siteAreaIDs)) {
      filters.siteAreaID = {
        $in: params.siteAreaIDs.map((id) => DatabaseUtils.convertToObjectID(id))
      };
    }
    // Issuer
    if (Utils.objectHasProperty(params, 'issuer') && Utils.isBoolean(params.issuer)) {
      filters.issuer = params.issuer;
    }
    // Sites
    if (!Utils.isEmptyArray(params.siteIDs)) {
      filters.siteID = {
        $in: params.siteIDs.map((siteID) => DatabaseUtils.convertToObjectID(siteID))
      };
    }
    // Dynamic Asset
    if (params.dynamicOnly && Utils.isBoolean(params.dynamicOnly)) {
      filters.dynamicAsset = params.dynamicOnly;
    }
    // Limit on Asset for Basic Users
    if (!Utils.isEmptyArray(params.assetIDs)) {
      filters._id = {
        $in: params.assetIDs.map((assetID) => DatabaseUtils.convertToObjectID(assetID))
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
    const assetsCountMDB = await global.database.getCollection<any>(tenant.id, 'assets')
      .aggregate([...aggregation, { $count: 'count' }], DatabaseUtils.buildAggregateOptions())
      .toArray() as DatabaseCount[];
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      // Return only the count
      await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getAssets', startTime, aggregation, assetsCountMDB);
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
      $limit: dbParams.limit
    });
    // Site Area
    if (params.withSiteArea) {
      DatabaseUtils.pushSiteAreaLookupInAggregation({
        tenantID: tenant.id, aggregation, localField: 'siteAreaID', foreignField: '_id',
        asField: 'siteArea', oneToOneCardinality: true
      });
    }
    // Site
    if (params.withSite) {
      DatabaseUtils.pushSiteLookupInAggregation({
        tenantID: tenant.id, aggregation: aggregation, localField: 'siteID', foreignField: '_id',
        asField: 'site', oneToOneCardinality: true
      });
    }
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteAreaID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteArea.siteID');
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenant.id, aggregation);
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const assetsMDB = await global.database.getCollection<any>(tenant.id, 'assets')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as Asset[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getAssets', startTime, aggregation, assetsMDB);
    return {
      count: DatabaseUtils.getCountFromDatabaseCount(assetsCountMDB[0]),
      result: assetsMDB
    };
  }

  public static async updateAssetsWithOrganizationIDs(tenant: Tenant, companyID: string, siteID: string, siteAreaID?: string): Promise<number> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    let result: UpdateResult;
    if (siteAreaID) {
      result = await global.database.getCollection<any>(tenant.id, 'assets').updateMany(
        {
          siteAreaID: DatabaseUtils.convertToObjectID(siteAreaID),
        },
        {
          $set: {
            siteID: DatabaseUtils.convertToObjectID(siteID),
            companyID: DatabaseUtils.convertToObjectID(companyID)
          }
        }) as UpdateResult;
    } else {
      result = await global.database.getCollection<any>(tenant.id, 'assets').updateMany(
        {
          siteID: DatabaseUtils.convertToObjectID(siteID),
        },
        {
          $set: {
            companyID: DatabaseUtils.convertToObjectID(companyID)
          }
        }) as UpdateResult;
    }
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'updateAssetsWithOrganizationIDs', startTime, { siteID, companyID });
    return result.modifiedCount;
  }

  public static async getAssetsInError(tenant: Tenant,
      params: { search?: string; siteAreaIDs?: string[]; siteIDs?: string[]; errorType?: string[]; issuer?: boolean } = {},
      dbParams?: DbParams, projectFields?: string[]): Promise<DataResult<Asset>> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Set the filters
    const filters: FilterParams = {};
    if (params.search) {
      filters.$or = [
        { 'name': { $regex: params.search, $options: 'i' } },
      ];
    }
    if (!Utils.isEmptyArray(params.siteAreaIDs)) {
      filters.siteAreaID = { $in: params.siteAreaIDs.map((id) => DatabaseUtils.convertToObjectID(id)) };
    }
    if (!Utils.isEmptyArray(params.siteIDs)) {
      filters.siteID = { $in: params.siteIDs.map((id) => DatabaseUtils.convertToObjectID(id)) };
    }
    if (Utils.objectHasProperty(params, 'issuer') && Utils.isBoolean(params.issuer)) {
      filters.issuer = params.issuer;
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
      for (const type of params.errorType) {
        array.push(`$${type}`);
        facets.$facet[type] = AssetStorage.getAssetInErrorFacet(type);
      }
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
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenant.id, aggregation);
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
      $limit: dbParams.limit
    });
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const assetsMDB = await global.database.getCollection<any>(tenant.id, 'assets')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as Asset[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getAssetsInError', startTime, aggregation, assetsMDB);
    return {
      count: assetsMDB.length,
      result: assetsMDB
    };
  }

  public static async deleteAsset(tenant: Tenant, id: string): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Delete the Asset
    await global.database.getCollection<any>(tenant.id, 'assets')
      .findOneAndDelete({ '_id': DatabaseUtils.convertToObjectID(id) });
    // Delete Image
    await global.database.getCollection<any>(tenant.id, 'assetimages')
      .findOneAndDelete({ '_id': DatabaseUtils.convertToObjectID(id) });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'deleteAsset', startTime, { id });
  }

  private static async saveAssetImage(tenant: Tenant, assetID: string, assetImageToSave: string): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Modify
    await global.database.getCollection<any>(tenant.id, 'assetimages').findOneAndUpdate(
      { '_id': DatabaseUtils.convertToObjectID(assetID) },
      { $set: { image: assetImageToSave } },
      { upsert: true });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveAssetImage', startTime, assetImageToSave);
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
