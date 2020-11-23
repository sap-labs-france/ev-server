import global, { FilterParams, Image } from '../../types/GlobalType';

import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import { ObjectID } from 'mongodb';
import SiteArea from '../../types/SiteArea';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'SiteAreaStorage';

export default class SiteAreaStorage {
  public static async addAssetsToSiteArea(tenantID: string, siteAreaID: string, assetIDs: string[]): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'addAssetsToSiteArea');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Site Area provided?
    if (siteAreaID) {
      // At least one Asset
      if (assetIDs && assetIDs.length > 0) {
        // Update all assets
        await global.database.getCollection<any>(tenantID, 'assets').updateMany(
          { '_id': { $in: assetIDs.map((assetID) => Utils.convertToObjectID(assetID)) } },
          {
            $set: { siteAreaID: Utils.convertToObjectID(siteAreaID) }
          });
      }
    }
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'addAssetsToSiteArea', uniqueTimerID, assetIDs);
  }

  public static async removeAssetsFromSiteArea(tenantID: string, siteAreaID: string, assetIDs: string[]): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'removeAssetsFromSiteArea');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Site Area provided?
    if (siteAreaID) {
      // At least one Asset
      if (assetIDs && assetIDs.length > 0) {
        // Update all assets
        await global.database.getCollection<any>(tenantID, 'assets').updateMany(
          { '_id': { $in: assetIDs.map((assetID) => Utils.convertToObjectID(assetID)) } },
          {
            $set: { siteAreaID: null }
          });
      }
    }
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'removeAssetsFromSiteArea', uniqueTimerID, assetIDs);
  }

  public static async getSiteAreaImage(tenantID: string, id: string): Promise<Image> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getSiteAreaImage');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const siteAreaImageMDB = await global.database.getCollection<{ _id: ObjectID; image: string }>(tenantID, 'siteareaimages')
      .findOne({ _id: Utils.convertToObjectID(id) });
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'getSiteAreaImage', uniqueTimerID, siteAreaImageMDB);
    return {
      id: id, image: siteAreaImageMDB ? siteAreaImageMDB.image : null
    };
  }

  public static async getSiteArea(tenantID: string, id: string = Constants.UNKNOWN_OBJECT_ID,
    params: { withSite?: boolean; withChargingStations?: boolean } = {}, projectFields?: string[]): Promise<SiteArea> {
    const siteAreasMDB = await SiteAreaStorage.getSiteAreas(tenantID, {
      siteAreaIDs: [id],
      withSite: params.withSite,
      withChargingStations: params.withChargingStations,
      withAvailableChargingStations: true,
      withImage: true,
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return siteAreasMDB.count === 1 ? siteAreasMDB.result[0] : null;
  }

  public static async saveSiteArea(tenantID: string, siteAreaToSave: SiteArea, saveImage = false): Promise<string> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'saveSiteArea');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Set
    const siteAreaMDB: any = {
      _id: !siteAreaToSave.id ? new ObjectID() : Utils.convertToObjectID(siteAreaToSave.id),
      name: siteAreaToSave.name,
      issuer: siteAreaToSave.issuer,
      accessControl: Utils.convertToBoolean(siteAreaToSave.accessControl),
      smartCharging: Utils.convertToBoolean(siteAreaToSave.smartCharging),
      siteID: Utils.convertToObjectID(siteAreaToSave.siteID),
      maximumPower: Utils.convertToFloat(siteAreaToSave.maximumPower),
      voltage: Utils.convertToInt(siteAreaToSave.voltage),
      numberOfPhases: Utils.convertToInt(siteAreaToSave.numberOfPhases),
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
        coordinates: Utils.containsGPSCoordinates(siteAreaToSave.address.coordinates) ? siteAreaToSave.address.coordinates.map(
          (coordinate) => Utils.convertToFloat(coordinate)) : [],
      };
    }
    // Add Last Changed/Created props
    DatabaseUtils.addLastChangedCreatedProps(siteAreaMDB, siteAreaToSave);
    // Modify
    await global.database.getCollection<SiteArea>(tenantID, 'siteareas').findOneAndUpdate(
      { _id: siteAreaMDB._id },
      { $set: siteAreaMDB },
      { upsert: true, returnOriginal: false }
    );
    if (saveImage) {
      await SiteAreaStorage.saveSiteAreaImage(tenantID, siteAreaMDB._id.toHexString(), siteAreaToSave.image);
    }
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'saveSiteArea', uniqueTimerID, siteAreaMDB);
    return siteAreaMDB._id.toHexString();
  }

  public static async getSiteAreas(tenantID: string,
    params: {
      siteAreaIDs?: string[]; search?: string; siteIDs?: string[]; withSite?: boolean; issuer?: boolean;
      withChargingStations?: boolean; withOnlyChargingStations?: boolean; withAvailableChargingStations?: boolean;
      locCoordinates?: number[]; locMaxDistanceMeters?: number; smartCharging?: boolean; withImage?: boolean;
    } = {},
    dbParams: DbParams, projectFields?: string[]): Promise<DataResult<SiteArea>> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getSiteAreas');
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
    // Position coordinates
    if (Utils.containsGPSCoordinates(params.locCoordinates)) {
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
        { 'name': { $regex: Utils.escapeSpecialCharsInRegex(params.search), $options: 'i' } }
      ];
    }
    // Site Area
    if (!Utils.isEmptyArray(params.siteAreaIDs)) {
      filters._id = {
        $in: params.siteAreaIDs.map((siteAreaID) => Utils.convertToObjectID(siteAreaID))
      };
    }
    // Site
    if (!Utils.isEmptyArray(params.siteIDs)) {
      filters.siteID = {
        $in: params.siteIDs.map((siteID) => Utils.convertToObjectID(siteID))
      };
    }
    if (Utils.objectHasProperty(params, 'issuer') && Utils.isBooleanValue(params.issuer)) {
      filters.issuer = params.issuer;
    }
    if (params.smartCharging === true || params.smartCharging === false) {
      filters.smartCharging = params.smartCharging;
    }
    // Filters
    if (filters) {
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
    const siteAreasCountMDB = await global.database.getCollection<DataResult<SiteArea>>(tenantID, 'siteareas')
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      // Return only the count
      Logging.traceEnd(tenantID, MODULE_NAME, 'getSiteAreas', uniqueTimerID, siteAreasCountMDB);
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
    if (Utils.containsGPSCoordinates(params.locCoordinates)) {
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
        tenantID, aggregation, localField: 'siteID', foreignField: '_id',
        asField: 'site', oneToOneCardinality: true
      });
    }
    // Charging Stations
    if (params.withChargingStations || params.withOnlyChargingStations || params.withAvailableChargingStations) {
      DatabaseUtils.pushChargingStationLookupInAggregation({
        tenantID, aggregation, localField: '_id', foreignField: 'siteAreaID',
        asField: 'chargingStations'
      });
    }
    // Site Area Image
    if (params.withImage) {
      aggregation.push({
        $addFields: {
          image: {
            $concat: [
              `${Utils.buildRestServerURL()}/client/util/SiteAreaImage?ID=`,
              { $toString: '$_id' },
              `&TenantID=${tenantID}&LastChangedOn=`,
              { $toString: '$lastChangedOn' }
            ]
          }
        }
      });
    }
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteID');
    // Add Last Changed / Created
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Project
    if (projectFields) {
      DatabaseUtils.projectFields(aggregation,
        [...projectFields, 'chargingStations.id', 'chargingStations.connectors', 'chargingStations.lastSeen',
          'chargingStations.deleted', 'chargingStations.cannotChargeInParallel', 'chargingStations.public', 'chargingStations.inactive']);
    }
    // Read DB
    const siteAreasMDB = await global.database.getCollection<SiteArea>(tenantID, 'siteareas')
      .aggregate(aggregation, {
        collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 },
        allowDiskUse: true
      })
      .toArray();
    const siteAreas: SiteArea[] = [];
    // TODO: Handle this coding into the MongoDB request
    if (siteAreasMDB && siteAreasMDB.length > 0) {
      // Create
      for (const siteAreaMDB of siteAreasMDB) {
        // Skip site area with no charging stations if asked
        if (params.withOnlyChargingStations && Utils.isEmptyArray(siteAreaMDB.chargingStations)) {
          continue;
        }
        // Add counts of Available/Occupied Chargers/Connectors
        if (params.withAvailableChargingStations) {
          // Set the Charging Stations' Connector statuses
          siteAreaMDB.connectorStats = Utils.getConnectorStatusesFromChargingStations(siteAreaMDB.chargingStations);
        }
        // Charging stations
        if (!params.withChargingStations && siteAreaMDB.chargingStations) {
          delete siteAreaMDB.chargingStations;
        }
        // Add
        siteAreas.push(siteAreaMDB);
      }
    }
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'getSiteAreas', uniqueTimerID, siteAreasMDB);
    // Ok
    return {
      count: (siteAreasCountMDB.length > 0 ?
        (siteAreasCountMDB[0].count === Constants.DB_RECORD_COUNT_CEIL ? -1 : siteAreasCountMDB[0].count) : 0),
      result: siteAreas
    };
  }

  public static async addChargingStationsToSiteArea(tenantID: string, siteAreaID: string, chargingStationIDs: string[]): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'addChargingStationsToSiteArea');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Site provided?
    if (siteAreaID) {
      // At least one ChargingStation
      if (chargingStationIDs && chargingStationIDs.length > 0) {
        // Update all chargers
        await global.database.getCollection<any>(tenantID, 'chargingstations').updateMany(
          { '_id': { $in: chargingStationIDs } },
          {
            $set: { siteAreaID: Utils.convertToObjectID(siteAreaID) }
          });
      }
    }
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'addChargingStationsToSiteArea', uniqueTimerID, chargingStationIDs);
  }

  public static async removeChargingStationsFromSiteArea(tenantID: string, siteAreaID: string, chargingStationIDs: string[]): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'removeChargingStationsFromSiteArea');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Site provided?
    if (siteAreaID) {
      // At least one ChargingStation
      if (chargingStationIDs && chargingStationIDs.length > 0) {
        // Update all chargers
        await global.database.getCollection<any>(tenantID, 'chargingstations').updateMany(
          { '_id': { $in: chargingStationIDs } },
          {
            $set: { siteAreaID: null }
          });
      }
    }
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'removeChargingStationsFromSiteArea', uniqueTimerID, chargingStationIDs);
  }

  public static async deleteSiteArea(tenantID: string, id: string): Promise<void> {
    await SiteAreaStorage.deleteSiteAreas(tenantID, [id]);
  }

  public static async deleteSiteAreas(tenantID: string, siteAreaIDs: string[]): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'deleteSiteAreas');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Remove Charging Station's Site Area
    await global.database.getCollection<any>(tenantID, 'chargingstations').updateMany(
      { siteAreaID: { $in: siteAreaIDs.map((ID) => Utils.convertToObjectID(ID)) } },
      { $set: { siteAreaID: null } }
    );
    // Remove Asset's Site Area
    await global.database.getCollection<any>(tenantID, 'assets').updateMany(
      { siteAreaID: { $in: siteAreaIDs.map((ID) => Utils.convertToObjectID(ID)) } },
      { $set: { siteAreaID: null } }
    );
    // Delete SiteArea
    await global.database.getCollection<any>(tenantID, 'siteareas').deleteMany(
      { '_id': { $in: siteAreaIDs.map((ID) => Utils.convertToObjectID(ID)) } }
    );
    // Delete Image
    await global.database.getCollection<any>(tenantID, 'sitesareaimages').deleteMany(
      { '_id': { $in: siteAreaIDs.map((ID) => Utils.convertToObjectID(ID)) } }
    );
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'deleteSiteAreas', uniqueTimerID, siteAreaIDs);
  }

  public static async deleteSiteAreasFromSites(tenantID: string, siteIDs: string[]): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'deleteSiteAreasFromSites');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Find site areas to delete
    const siteareas: string[] = (await global.database.getCollection<any>(tenantID, 'siteareas')
      .find({ siteID: { $in: siteIDs.map((id) => Utils.convertToObjectID(id)) } })
      .project({ _id: 1 }).toArray()).map((idWrapper): string => idWrapper._id.toHexString());
    // Delete site areas
    await SiteAreaStorage.deleteSiteAreas(tenantID, siteareas);
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'deleteSiteAreasFromSites', uniqueTimerID, siteIDs);
  }

  private static async saveSiteAreaImage(tenantID: string, siteAreaID: string, siteAreaImageToSave: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'saveSiteAreaImage');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Modify
    await global.database.getCollection<any>(tenantID, 'siteareaimages').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(siteAreaID) },
      { $set: { image: siteAreaImageToSave } },
      { upsert: true, returnOriginal: false }
    );
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'saveSiteAreaImage', uniqueTimerID, siteAreaImageToSave);
  }
}
