import { ObjectId, UpdateResult } from 'mongodb';
import SiteArea, { SiteAreaOcpiData } from '../../types/SiteArea';
import global, { DatabaseCount, FilterParams, Image } from '../../types/GlobalType';

import AssetStorage from './AssetStorage';
import { ChargePointStatus } from '../../types/ocpp/OCPPServer';
import ChargingStationStorage from './ChargingStationStorage';
import Constants from '../../utils/Constants';
import ConsumptionStorage from './ConsumptionStorage';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TransactionStorage from './TransactionStorage';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'SiteAreaStorage';

export default class SiteAreaStorage {
  public static async updateEntitiesWithOrganizationIDs(tenant: Tenant, companyID: string, siteID: string, siteAreaID: string): Promise<number> {
    const startTime = Logging.traceDatabaseRequestStart();
    // Update Charging Stations
    let updated = await ChargingStationStorage.updateChargingStationsWithOrganizationIDs(tenant, companyID, siteID, siteAreaID);
    // Update Transactions
    updated += await TransactionStorage.updateTransactionsWithOrganizationIDs(tenant, companyID, siteID, siteAreaID);
    // Update Assets
    updated += await AssetStorage.updateAssetsWithOrganizationIDs(tenant, companyID, siteID, siteAreaID);
    // Update Consumptions
    updated += await ConsumptionStorage.updateConsumptionsWithOrganizationIDs(tenant, siteID, siteAreaID);
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'updateEntitiesWithOrganizationIDs', startTime, { companyID, siteID, siteAreaID });
    return updated;
  }

  public static async attachSiteAreaChildrenToNewParent(tenant: Tenant, oldParentSiteAreaID: string, newParentSiteAreaID: string): Promise<number> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    const result = await global.database.getCollection<any>(tenant.id, 'siteareas').updateMany(
      {
        parentSiteAreaID: DatabaseUtils.convertToObjectID(oldParentSiteAreaID),
      },
      {
        $set: {
          parentSiteAreaID: DatabaseUtils.convertToObjectID(newParentSiteAreaID),
        }
      }) as UpdateResult;
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'attachSiteAreaChildrenToNewParent', startTime, { oldParentSiteAreaID, newParentSiteAreaID });
    return result.modifiedCount;
  }

  public static async updateSmartCharging(tenant: Tenant, siteAreaID: string, smartCharging: boolean): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    await global.database.getCollection<any>(tenant.id, 'siteareas').updateOne(
      { _id: DatabaseUtils.convertToObjectID(siteAreaID) },
      {
        $set: { smartCharging: Utils.convertToBoolean(smartCharging) }
      });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'updateSmartCharging', startTime, { siteAreaID, smartCharging });
  }

  public static async updateSiteID(tenant: Tenant, siteAreaID: string, siteID: string): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    const result = await global.database.getCollection<any>(tenant.id, 'siteareas').updateOne(
      { _id: DatabaseUtils.convertToObjectID(siteAreaID) },
      {
        $set: { siteID: DatabaseUtils.convertToObjectID(siteID) }
      });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'updateSiteID', startTime, { siteAreaID, siteID });
  }

  public static async addAssetsToSiteArea(tenant: Tenant, siteAreaID: string, siteID: string, companyID: string, assetIDs: string[]): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // At least one Asset
    if (!Utils.isEmptyArray(assetIDs)) {
      // Update all assets
      await global.database.getCollection<any>(tenant.id, 'assets').updateMany(
        { '_id': { $in: assetIDs.map((assetID) => DatabaseUtils.convertToObjectID(assetID)) } },
        {
          $set: {
            siteAreaID: DatabaseUtils.convertToObjectID(siteAreaID),
            siteID: DatabaseUtils.convertToObjectID(siteID),
            companyID: DatabaseUtils.convertToObjectID(companyID)
          }
        });
    }
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'addAssetsToSiteArea', startTime, assetIDs);
  }

  public static async removeAssetsFromSiteArea(tenant: Tenant, siteAreaID: string, assetIDs: string[]): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Site Area provided?
    if (siteAreaID) {
      // At least one Asset
      if (assetIDs && assetIDs.length > 0) {
        // Update all assets
        await global.database.getCollection<any>(tenant.id, 'assets').updateMany(
          { '_id': { $in: assetIDs.map((assetID) => DatabaseUtils.convertToObjectID(assetID)) } },
          {
            $set: {
              siteAreaID: null,
              siteID: null,
              companyID: null
            }
          });
      }
    }
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'removeAssetsFromSiteArea', startTime, assetIDs);
  }

  public static async getSiteAreaImage(tenant: Tenant, id: string): Promise<Image> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Read DB
    const siteAreaImageMDB = await global.database.getCollection<{ _id: ObjectId; image: string }>(tenant.id, 'siteareaimages')
      .findOne({ _id: DatabaseUtils.convertToObjectID(id) });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getSiteAreaImage', startTime, { id }, siteAreaImageMDB);
    return {
      id: id, image: siteAreaImageMDB ? siteAreaImageMDB.image : null
    };
  }

  public static async getSiteAreaByOcpiLocationUid(tenant: Tenant, ocpiLocationID: string = Constants.UNKNOWN_STRING_ID, projectFields?: string[]): Promise<SiteArea> {
    const siteAreaMDB = await SiteAreaStorage.getSiteAreas(tenant, {
      ocpiLocationID,
      withSite: true,
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    // No unique key on OCPI Location (avoid create several Site Area with the same location ID)
    if (siteAreaMDB.count > 1) {
      await Logging.logWarning({
        tenantID: tenant.id,
        action: ServerAction.UNKNOWN_ACTION,
        module: MODULE_NAME, method: 'getSiteAreaByOcpiLocationUid',
        message: `Multiple Site Area with same OCPI Location ID '${ocpiLocationID}'`,
        detailedMessages: { ocpiLocationID, siteAreas: siteAreaMDB.result }
      });
    }
    return siteAreaMDB.count >= 1 ? siteAreaMDB.result[0] : null;
  }

  public static async getSiteArea(tenant: Tenant, id: string = Constants.UNKNOWN_OBJECT_ID,
      params: { withSite?: boolean; withChargingStations?: boolean; withAvailableChargingStations?: boolean; withImage?: boolean;
        siteIDs?: string[]; issuer?: boolean; withParentSiteArea?: boolean; } = {},
      projectFields?: string[]): Promise<SiteArea> {
    const siteAreasMDB = await SiteAreaStorage.getSiteAreas(tenant, {
      siteAreaIDs: [id],
      withSite: params.withSite,
      withParentSiteArea: params.withParentSiteArea,
      withChargingStations: params.withChargingStations,
      withAvailableChargingStations: params.withAvailableChargingStations,
      withImage: params.withImage,
      siteIDs: params.siteIDs,
      issuer: params.issuer,
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return siteAreasMDB.count === 1 ? siteAreasMDB.result[0] : null;
  }

  public static async saveSiteArea(tenant: Tenant, siteAreaToSave: SiteArea, saveImage = false): Promise<string> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Set
    const siteAreaMDB: any = {
      _id: !siteAreaToSave.id ? new ObjectId() : DatabaseUtils.convertToObjectID(siteAreaToSave.id),
      name: siteAreaToSave.name,
      issuer: siteAreaToSave.issuer,
      accessControl: Utils.convertToBoolean(siteAreaToSave.accessControl),
      smartCharging: Utils.convertToBoolean(siteAreaToSave.smartCharging),
      siteID: DatabaseUtils.convertToObjectID(siteAreaToSave.siteID),
      parentSiteAreaID: DatabaseUtils.convertToObjectID(siteAreaToSave.parentSiteAreaID),
      maximumPower: Utils.convertToFloat(siteAreaToSave.maximumPower),
      voltage: Utils.convertToInt(siteAreaToSave.voltage),
      numberOfPhases: Utils.convertToInt(siteAreaToSave.numberOfPhases),
      tariffID: siteAreaToSave.tariffID,
    };
    if (siteAreaToSave.address) {
      siteAreaMDB.address = {
        address1: siteAreaToSave.address.address1,
        address2: siteAreaToSave.address.address2,
        postalCode: siteAreaToSave.address.postalCode,
        city: siteAreaToSave.address.city,
        department: siteAreaToSave.address.department,
        region: siteAreaToSave.address.region,
        country: siteAreaToSave.address.country,
        coordinates: Utils.hasValidGpsCoordinates(siteAreaToSave.address.coordinates) ? siteAreaToSave.address.coordinates.map(
          (coordinate) => Utils.convertToFloat(coordinate)) : [],
      };
    }
    if (siteAreaToSave.smartChargingSessionParameters) {
      siteAreaMDB.smartChargingSessionParameters = {
        departureTime: siteAreaToSave.smartChargingSessionParameters.departureTime ?? null,
        carStateOfCharge: siteAreaToSave.smartChargingSessionParameters.carStateOfCharge ?
          Utils.convertToInt(siteAreaToSave.smartChargingSessionParameters.carStateOfCharge) : null,
        targetStateOfCharge: siteAreaToSave.smartChargingSessionParameters.targetStateOfCharge ?
          Utils.convertToInt(siteAreaToSave.smartChargingSessionParameters.targetStateOfCharge) : null,
      };
    }
    // Add Last Changed/Created props
    DatabaseUtils.addLastChangedCreatedProps(siteAreaMDB, siteAreaToSave);
    // Modify
    await global.database.getCollection<any>(tenant.id, 'siteareas').findOneAndUpdate(
      { _id: siteAreaMDB._id },
      { $set: siteAreaMDB },
      { upsert: true, returnDocument: 'after' }
    );
    if (saveImage) {
      await SiteAreaStorage.saveSiteAreaImage(tenant, siteAreaMDB._id.toString(), siteAreaToSave.image);
    }
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveSiteArea', startTime, siteAreaMDB);
    return siteAreaMDB._id.toString();
  }

  public static async saveSiteAreaOcpiData(tenant: Tenant, id: string, ocpiData: SiteAreaOcpiData): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Modify document
    await global.database.getCollection<any>(tenant.id, 'siteareas').findOneAndUpdate(
      { '_id': DatabaseUtils.convertToObjectID(id) },
      {
        $set: {
          ocpiData
        }
      },
      { upsert: false });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveSiteAreaOcpiData', startTime, ocpiData);
  }

  public static async getSiteAreas(tenant: Tenant,
      params: {
        siteAreaIDs?: string[]; search?: string; siteIDs?: string[]; parentSiteAreaIDs?: string[]; companyIDs?: string[]; withSite?: boolean; withParentSiteArea?: boolean;
        issuer?: boolean; name?: string; withChargingStations?: boolean; withOnlyChargingStations?: boolean; withAvailableChargingStations?: boolean;
        chargingStationConnectorStatuses?: ChargePointStatus[]; locCoordinates?: number[]; locMaxDistanceMeters?: number; smartCharging?: boolean; withImage?: boolean;
        ocpiLocationID?: string; withAssets?: boolean; withNoParentSiteArea?: boolean; excludeSiteAreaIDs?: string[];
      } = {},
      dbParams: DbParams, projectFields?: string[]): Promise<DataResult<SiteArea>> {
    const startTime = Logging.traceDatabaseRequestStart();
    let withChargingStations = params.withChargingStations || params.withOnlyChargingStations || params.withAvailableChargingStations;
    DatabaseUtils.checkTenantObject(tenant);
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Create Aggregation
    const aggregation = [];
    // Position coordinates
    if (Utils.hasValidGpsCoordinates(params.locCoordinates)) {
      aggregation.push({
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: params.locCoordinates
          },
          distanceField: 'distanceMeters',
          maxDistance: params.locMaxDistanceMeters > 0 ? params.locMaxDistanceMeters : Constants.MAX_GPS_DISTANCE_METERS,
          spherical: true
        }
      });
    }
    // Set the filters
    const filters: FilterParams = {};
    // Otherwise check if search is present
    if (params.search) {
      filters.$or = [
        { 'name': { $regex: params.search, $options: 'i' } },
        { 'address.address1': { $regex: params.search, $options: 'i' } },
        { 'address.postalCode': { $regex: params.search, $options: 'i' } },
        { 'address.city': { $regex: params.search, $options: 'i' } },
        { 'address.region': { $regex: params.search, $options: 'i' } },
        { 'address.country': { $regex: params.search, $options: 'i' } },
        { 'ocpiData.location.id': { $regex: params.search, $options: 'im' } },
      ];
      if (DatabaseUtils.isObjectID(params.search)) {
        filters.$or.push({ '_id': DatabaseUtils.convertToObjectID(params.search) });
      }
    }
    // Site Area
    if (!Utils.isEmptyArray(params.siteAreaIDs)) {
      filters._id = {
        $in: params.siteAreaIDs.map((siteAreaID) => DatabaseUtils.convertToObjectID(siteAreaID))
      };
    }
    // Exclude Site Area
    if (!Utils.isEmptyArray(params.excludeSiteAreaIDs)) {
      filters._id = {
        $nin: params.excludeSiteAreaIDs.map((siteAreaID) => DatabaseUtils.convertToObjectID(siteAreaID))
      };
    }
    // Parent Site Area
    if (!Utils.isEmptyArray(params.parentSiteAreaIDs)) {
      filters.parentSiteAreaID = {
        $in: params.parentSiteAreaIDs.map((parentSiteAreaID) => DatabaseUtils.convertToObjectID(parentSiteAreaID))
      };
    }
    // Site
    if (!Utils.isEmptyArray(params.siteIDs)) {
      filters.siteID = {
        $in: params.siteIDs.map((siteID) => DatabaseUtils.convertToObjectID(siteID))
      };
    }
    // Company
    if (!Utils.isEmptyArray(params.companyIDs)) {
      DatabaseUtils.pushSiteLookupInAggregation({
        tenantID: tenant.id, aggregation, localField: 'siteID', foreignField: '_id',
        asField: 'site', oneToOneCardinality: true
      });
      filters['site.companyID'] = {
        $in: params.companyIDs.map((companyID) => companyID)
      };
      params.withSite = false;
    }
    // Issuer
    if (Utils.objectHasProperty(params, 'issuer') && Utils.isBoolean(params.issuer)) {
      filters.issuer = params.issuer;
    }
    // Smart Charging
    if (Utils.objectHasProperty(params, 'smartCharging') && Utils.isBoolean(params.smartCharging)) {
      filters.smartCharging = params.smartCharging;
    }
    // OCPI Location ID
    if (params.ocpiLocationID) {
      filters['ocpiData.location.id'] = params.ocpiLocationID;
    }
    // Name
    if (params.name) {
      filters.name = params.name;
    }
    if (params.withNoParentSiteArea) {
      const noParentFilter = {
        $or: [
          { parentSiteAreaID: { $exists: false } },
          { parentSiteAreaID: { $eq: null } },
        ]
      };
      if (filters.$and) {
        filters.$and.push(noParentFilter);
      } else {
        filters.$and = [ noParentFilter ];
      }
    }
    // Filters
    if (filters) {
      aggregation.push({
        $match: filters
      });
    }
    // Connector statuses
    if (!Utils.isEmptyArray(params.chargingStationConnectorStatuses)) {
      if (withChargingStations) {
        DatabaseUtils.pushChargingStationLookupInAggregation({
          tenantID: tenant.id, aggregation, localField: '_id', foreignField: 'siteAreaID',
          asField: 'chargingStations' });
      }
      // Filter
      DatabaseUtils.push2ArraysFilterInAggregation(aggregation, 'chargingStations', 'chargingStations.id', 'chargingStations.connectors',
        { 'chargingStations.connectors.status' : { $in: params.chargingStationConnectorStatuses } });
      withChargingStations = false;
    }
    // Charging Station Connnector stats
    if (params.withAvailableChargingStations) {
      DatabaseUtils.addConnectorStatsInOrg(tenant, aggregation, 'siteAreaID', withChargingStations);
      withChargingStations = false;
    }
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const siteAreasCountMDB = await global.database.getCollection<any>(tenant.id, 'siteareas')
      .aggregate([...aggregation, { $count: 'count' }], DatabaseUtils.buildAggregateOptions())
      .toArray() as DatabaseCount[];
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      // Return only the count
      await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getSiteAreas', startTime, aggregation, siteAreasCountMDB);
      return {
        count: (siteAreasCountMDB.length > 0 ? siteAreasCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Add Sort
    if (!dbParams.sort) {
      dbParams.sort = { name: 1 };
    }
    // Position coordinates
    if (Utils.hasValidGpsCoordinates(params.locCoordinates)) {
      dbParams.sort = { distanceMeters: 1 };
    }
    aggregation.push({
      $sort: dbParams.sort
    });
    // Skip
    aggregation.push({
      $skip: dbParams.skip
    });
    // Limit
    aggregation.push({
      $limit: dbParams.limit
    });
    // Sites
    if (params.withSite) {
      DatabaseUtils.pushSiteLookupInAggregation({
        tenantID: tenant.id, aggregation, localField: 'siteID', foreignField: '_id',
        asField: 'site', oneToOneCardinality: true
      });
    }
    // Site Area Parent
    if (params.withParentSiteArea) {
      DatabaseUtils.pushSiteAreaLookupInAggregation({
        tenantID: tenant.id, aggregation, localField: 'parentSiteAreaID', foreignField: '_id',
        asField: 'parentSiteArea', oneToOneCardinality: true
      });
    }
    // Charging Stations
    if (withChargingStations) {
      DatabaseUtils.pushChargingStationLookupInAggregation({
        tenantID: tenant.id, aggregation, localField: '_id', foreignField: 'siteAreaID',
        asField: 'chargingStations'
      });
    }
    // Assets
    if (params.withAssets) {
      DatabaseUtils.pushAssetLookupInAggregation({
        tenantID: tenant.id, aggregation, localField: '_id', foreignField: 'siteAreaID',
        asField: 'assets'
      });
    }
    // Site Area Image
    if (params.withImage) {
      aggregation.push({
        $addFields: {
          image: {
            $concat: [
              `${Utils.buildRestServerURL()}/v1/util/site-areas/`,
              { $toString: '$_id' },
              '/image',
              `?TenantID=${tenant.id}`,
              {
                $ifNull: [{ $concat: ['&LastChangedOn=', { $toString: '$lastChangedOn' }] }, ''] // Only concat 'lastChangedOn' if not null
              }
            ]
          }
        }
      });
    }
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'parentSiteAreaID');
    // Add Last Changed / Created
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenant.id, aggregation);
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const siteAreasMDB = await global.database.getCollection<any>(tenant.id, 'siteareas')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as SiteArea[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getSiteAreas', startTime, aggregation, siteAreasMDB);
    return {
      projectFields: projectFields,
      count: DatabaseUtils.getCountFromDatabaseCount(siteAreasCountMDB[0]),
      result: siteAreasMDB
    };
  }

  public static async addChargingStationsToSiteArea(tenant: Tenant, siteAreaID: string, siteID: string, companyID: string, chargingStationIDs: string[]): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // At least one ChargingStation
    if (!Utils.isEmptyArray(chargingStationIDs)) {
      // Update all chargers
      await global.database.getCollection<any>(tenant.id, 'chargingstations').updateMany(
        { '_id': { $in: chargingStationIDs } },
        {
          $set: {
            siteAreaID: DatabaseUtils.convertToObjectID(siteAreaID),
            siteID: DatabaseUtils.convertToObjectID(siteID),
            companyID: DatabaseUtils.convertToObjectID(companyID),
          }
        });
    }
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'addChargingStationsToSiteArea', startTime, chargingStationIDs);
  }

  public static async removeChargingStationsFromSiteArea(tenant: Tenant, siteAreaID: string, chargingStationIDs: string[]): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Site provided?
    if (siteAreaID) {
      // At least one ChargingStation
      if (chargingStationIDs && chargingStationIDs.length > 0) {
        // Update all chargers
        await global.database.getCollection<any>(tenant.id, 'chargingstations').updateMany(
          { '_id': { $in: chargingStationIDs } },
          {
            $set: {
              companyID: null,
              siteID: null,
              siteAreaID: null,
            }
          });
      }
    }
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'removeChargingStationsFromSiteArea', startTime, chargingStationIDs);
  }

  public static async deleteSiteArea(tenant: Tenant, id: string): Promise<void> {
    await SiteAreaStorage.deleteSiteAreas(tenant, [id]);
  }

  public static async deleteSiteAreas(tenant: Tenant, siteAreaIDs: string[]): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Remove Charging Station's Site Area
    await global.database.getCollection<any>(tenant.id, 'chargingstations').updateMany(
      { siteAreaID: { $in: siteAreaIDs.map((ID) => DatabaseUtils.convertToObjectID(ID)) } },
      { $set: { siteAreaID: null } }
    );
    // Remove Asset's Site Area
    await global.database.getCollection<any>(tenant.id, 'assets').updateMany(
      { siteAreaID: { $in: siteAreaIDs.map((ID) => DatabaseUtils.convertToObjectID(ID)) } },
      { $set: { siteAreaID: null } }
    );
    // Delete SiteArea
    await global.database.getCollection<any>(tenant.id, 'siteareas').deleteMany(
      { '_id': { $in: siteAreaIDs.map((ID) => DatabaseUtils.convertToObjectID(ID)) } }
    );
    // Delete Image
    await global.database.getCollection<any>(tenant.id, 'sitesareaimages').deleteMany(
      { '_id': { $in: siteAreaIDs.map((ID) => DatabaseUtils.convertToObjectID(ID)) } }
    );
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'deleteSiteAreas', startTime, siteAreaIDs);
  }

  public static async deleteSiteAreasFromSites(tenant: Tenant, siteIDs: string[]): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Find site areas to delete
    const siteareas: string[] = (await global.database.getCollection<any>(tenant.id, 'siteareas')
      .find({ siteID: { $in: siteIDs.map((id) => DatabaseUtils.convertToObjectID(id)) } })
      .project({ _id: 1 }).toArray()).map((idWrapper): string => idWrapper._id.toString());
    // Delete site areas
    await SiteAreaStorage.deleteSiteAreas(tenant, siteareas);
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'deleteSiteAreasFromSites', startTime, siteIDs);
  }

  private static async saveSiteAreaImage(tenant: Tenant, siteAreaID: string, siteAreaImageToSave: string): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Modify
    await global.database.getCollection<any>(tenant.id, 'siteareaimages').findOneAndUpdate(
      { '_id': DatabaseUtils.convertToObjectID(siteAreaID) },
      { $set: { image: siteAreaImageToSave } },
      { upsert: true, returnDocument: 'after' }
    );
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveSiteAreaImage', startTime, siteAreaImageToSave);
  }
}
