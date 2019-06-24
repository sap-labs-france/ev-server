import Constants from '../../utils/Constants';
import Utils from '../../utils/Utils';
import BackendError from '../../exception/BackendError';
import { ObjectID } from 'mongodb';
import DatabaseUtils from './DatabaseUtils';
import Logging from '../../utils/Logging';
import Site from '../../entity/Site';
import SiteArea from '../../types/SiteArea';
import ChargingStation from '../../entity/ChargingStation';
import TSGlobal from '../../types/GlobalType';
import DbParams from '../../types/database/DbParams';

declare const global: TSGlobal;

export default class SiteAreaStorage {

  public static async getSiteAreaImage(tenantID: string, id: string): Promise<{id: string; image: string}> {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteAreaStorage', 'getSiteAreaImage');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const siteAreaImagesMDB = await global.database.getCollection<{_id: string; image: string}>(tenantID, 'siteareaimages')
      .find({ _id: Utils.convertToObjectID(id) })
      .limit(1)
      .toArray();
    let siteAreaImage: {id: string; image: string} = null;
    // Set
    if (siteAreaImagesMDB && siteAreaImagesMDB.length > 0) {
      siteAreaImage = {
        id: siteAreaImagesMDB[0]._id,
        image: siteAreaImagesMDB[0].image
      };
    }
    // Debug
    Logging.traceEnd('SiteAreaStorage', 'getSiteAreaImage', uniqueTimerID, { id });
    return siteAreaImage;
  }

  public static async getSiteArea(tenantID: string, id: string,
    params: { withSite?: boolean; withChargeBoxes?: boolean; withImage?: boolean } = {}): Promise<SiteArea> {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteAreaStorage', 'getSiteArea');
    // Check Tenant
    await Utils.checkTenant(tenantID);

    const siteAreaResult = await SiteAreaStorage.getSiteAreas(
      tenantID, { search: id, onlyRecordCount: false, withImage: params.withImage,
        withSite: params.withSite, withChargeBoxes: params.withChargeBoxes, withAvailableChargers: true },
      { limit: 1, skip: 0 });

    // Debug
    Logging.traceEnd('SiteAreaStorage', 'getSiteArea', uniqueTimerID, { id, withChargeBoxes: params.withChargeBoxes, withSite: params.withSite });
    return siteAreaResult.result[0];
  }

  public static async saveSiteArea(tenantID: string, siteAreaToSave: SiteArea, saveImage = false): Promise<string> {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteAreaStorage', 'saveSiteArea');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Set
    const siteAreaMDB: any = {
      _id: !siteAreaToSave.id ? new ObjectID() : Utils.convertToObjectID(siteAreaToSave.id),
      name: siteAreaToSave.name,
      accessControl: siteAreaToSave.accessControl,
      siteID: Utils.convertToObjectID(siteAreaToSave.siteID)
    };
    if (siteAreaToSave.address) {
      siteAreaMDB.address = siteAreaToSave.address;
    }
    if (siteAreaToSave.maximumPower) {
      siteAreaMDB.maximumPower = siteAreaToSave.maximumPower;
    }
    if (siteAreaToSave.createdBy && siteAreaToSave.createdOn) {
      siteAreaMDB.createdBy = Utils.convertToObjectID(
        siteAreaToSave.createdBy.id ? siteAreaToSave.createdBy.id : siteAreaToSave.createdBy.getID()),
      siteAreaMDB.createdOn = siteAreaToSave.createdOn;
    }
    if (siteAreaToSave.lastChangedBy && siteAreaToSave.lastChangedOn) {
      siteAreaMDB.lastChangedBy = Utils.convertToObjectID(
        siteAreaToSave.lastChangedBy.id ? siteAreaToSave.lastChangedBy.id : siteAreaToSave.lastChangedBy.getID());
      siteAreaMDB.lastChangedOn = siteAreaToSave.lastChangedOn;
    }

    // Modify
    const result = await global.database.getCollection<SiteArea>(tenantID, 'siteareas').findOneAndUpdate(
      { _id: siteAreaMDB._id },
      { $set: siteAreaMDB },
      { upsert: true, returnOriginal: false }
    );

    if (!result.ok) {
      throw new BackendError(
        Constants.CENTRAL_SERVER,
        `Couldn't update SiteArea`,
        'SiteAreaStorage', 'saveSiteArea');
    }

    if (saveImage) {
      await SiteAreaStorage._saveSiteAreaImage(tenantID, siteAreaMDB._id.toHexString(), siteAreaToSave.image);
    }

    // Debug
    Logging.traceEnd('SiteAreaStorage', 'saveSiteArea', uniqueTimerID, { siteAreaToSave });

    return siteAreaMDB._id.toHexString();
  }

  private static async _saveSiteAreaImage(tenantID: string, siteAreaID: string, siteAreaImageToSave: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteAreaStorage', 'saveSiteAreaImage');
    // Check Tenant
    await Utils.checkTenant(tenantID);

    // Modify
    await global.database.getCollection<any>(tenantID, 'siteareaimages').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(siteAreaID) },
      { $set: { image: siteAreaImageToSave } },
      { upsert: true, returnOriginal: false });

    // Debug
    Logging.traceEnd('SiteAreaStorage', 'saveSiteAreaImage', uniqueTimerID);
  }

  public static async getSiteAreas(tenantID: string,
    params: {search?: string; withImage?: boolean; siteID?: string; siteIDs?: string[]; onlyRecordCount?: boolean; withSite?: boolean; withChargeBoxes?: boolean; withAvailableChargers?: boolean} = {},
    dbParams?: DbParams): Promise<{count: number; result: SiteArea[]}> {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteAreaStorage', 'getSiteAreas');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check Limit
    const limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    const skip = Utils.checkRecordSkip(dbParams.skip);
    // Set the filters
    const filters: any = {};
    // Build filter
    if (params.search) {
      if (ObjectID.isValid(params.search)) {
        filters._id = Utils.convertToObjectID(params.search);
      } else {
        filters.$or = [
          { "name": { $regex: params.search, $options: 'i' } }
        ];
      }
    }
    // Set Site?
    if (params.siteID) {
      filters.siteID = Utils.convertToObjectID(params.siteID);
    }
    // Create Aggregation
    const aggregation = [];
    // Filters
    if (filters) {
      aggregation.push({
        $match: filters
      });
    }
    // Limit on Site Area for Basic Users
    if (params.siteIDs && params.siteIDs.length > 0) {
      // Build filter
      aggregation.push({
        $match: {
          siteID: { $in: params.siteIDs.map((siteID) => {
            return Utils.convertToObjectID(siteID);
          }) }
        }
      });
    }
    // Limit records?
    if (!params.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.MAX_DB_RECORD_COUNT });
    }
    // Count Records
    const siteAreasCountMDB = await global.database.getCollection<{count: number}>(tenantID, 'siteareas')
      .aggregate([...aggregation, { $count: "count" }], { allowDiskUse: true })
      .toArray();
    // Check if only the total count is requested
    if (params.onlyRecordCount) {
      // Return only the count
      return {
        count: (siteAreasCountMDB.length > 0 ? siteAreasCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Sites
    if (params.withSite) {
      // Add Sites TODO change this when typing sites
      aggregation.push({
        $lookup: {
          from: DatabaseUtils.getCollectionName(tenantID, "sites"),
          localField: "siteID",
          foreignField: "_id",
          as: "site"
        }
      });
      // Single Record
      aggregation.push({
        $unwind: { "path": "$site", "preserveNullAndEmptyArrays": true }
      });
    }

    // Charging Stations
    if (params.withChargeBoxes || params.withAvailableChargers) {
      // Add Charging Stations TODO change when typing charging stations
      aggregation.push({
        $lookup: {
          from: DatabaseUtils.getCollectionName(tenantID, "chargingstations"),
          localField: "_id",
          foreignField: "siteAreaID",
          as: "chargingStations"
        }
      });
    }

    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);

    // Add site area image
    if (params.withImage) {
      aggregation.push({ $lookup: {
        from: tenantID + '.siteareaimages',
        localField: '_id',
        foreignField: '_id',
        as: 'image' }
      },
      { $unwind: {
        'path': '$image',
        'preserveNullAndEmptyArrays': true }
      },
      { $project: {
        image: '$image.image',
        id: { $toString: '$_id' },
        _id: 0,
        createdBy: 1,
        createdOn: 1,
        lastChangedBy: 1,
        lastChangedOn: 1,
        name: 1,
        address: 1,
        maximumPower: 1,
        siteID: 1,
        accessControl: 1,
        chargingStations: 1,
        site: 1
      }
      }
      );
    } else {
      aggregation.push({ $project: {
        id: { $toString: '$_id' },
        _id: 0,
        createdBy: 1,
        createdOn: 1,
        lastChangedBy: 1,
        lastChangedOn: 1,
        name: 1,
        address: 1,
        maximumPower: 1,
        siteID: 1,
        accessControl: 1,
        chargingStations: 1,
        site: 1
      }
      });
    }
    // Sort
    if (dbParams.sort) {
      // Sort
      aggregation.push({
        $sort: dbParams.sort
      });
    } else {
      // Default
      aggregation.push({
        $sort: { name: 1 }
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
    const incompleteSiteAreas = await global.database.getCollection<Omit<SiteArea, 'chargingStations'|'site'>&{chargingStations: any; site: any}>(tenantID, 'siteareas')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 }, allowDiskUse: true })
      .toArray();

    const siteAreas: SiteArea[] = [];
    // Check
    if (incompleteSiteAreas && incompleteSiteAreas.length > 0) {
      // Create
      for (const incompleteSiteArea of incompleteSiteAreas) {

        let site: Site;
        let chargingStations: ChargingStation[];
        let availableChargers = 0, totalChargers = 0, availableConnectors = 0, totalConnectors = 0;

        // Chargers
        if (params.withChargeBoxes && incompleteSiteArea.chargingStations) {
          chargingStations = incompleteSiteArea.chargingStations.map((chargeBox) => {
            return new ChargingStation(tenantID, chargeBox);
          });
        }
        // Count Available/Occupied Chargers/Connectors
        if (params.withAvailableChargers) {
          // Chargers
          for (const chargeBox of incompleteSiteArea.chargingStations) {
            // Check not deleted
            if (chargeBox.deleted) {
              // Forget
              continue;
            }
            totalChargers++;
            // Handle Connectors
            for (const connector of chargeBox.connectors) {
              totalConnectors++;
              // Check if Available
              if (connector.status === Constants.CONN_STATUS_AVAILABLE) {
                // Add
                availableConnectors++;
              }
            }
            // Handle Chargers
            for (const connector of chargeBox.connectors) {
              // Check if Available
              if (connector.status === Constants.CONN_STATUS_AVAILABLE) {
                // Add
                availableChargers++;
                break;
              }
            }
          }
        }
        // Set Site
        if (params.withSite && incompleteSiteArea.site) {
          site = new Site(tenantID, incompleteSiteArea.site);
        }
        // Add
        siteAreas.push({
          id: incompleteSiteArea.id,
          address: incompleteSiteArea.address,
          accessControl: incompleteSiteArea.accessControl,
          maximumPower: incompleteSiteArea.maximumPower,
          image: incompleteSiteArea.image,
          name: incompleteSiteArea.name,
          siteID: incompleteSiteArea.siteID,
          site: site,
          chargingStations: chargingStations,
          availableChargers: availableChargers,
          availableConnectors: availableConnectors,
          totalChargers: totalChargers,
          totalConnectors: totalConnectors,
          createdBy: incompleteSiteArea.createdBy,
          createdOn: incompleteSiteArea.createdOn,
          lastChangedBy: incompleteSiteArea.lastChangedBy,
          lastChangedOn: incompleteSiteArea.lastChangedOn
        });
      }
    }
    // Debug
    Logging.traceEnd('SiteAreaStorage', 'getSiteAreas', uniqueTimerID,
      { params, limit: dbParams.limit, skip: dbParams.skip, sort: dbParams.sort });
    // Ok
    return {
      count: (siteAreasCountMDB.length > 0 ?
        (siteAreasCountMDB[0].count === Constants.MAX_DB_RECORD_COUNT ? -1 : siteAreasCountMDB[0].count) : 0),
      result: siteAreas
    };
  }

  public static async deleteSiteArea(tenantID: string, id: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteAreaStorage', 'deleteSiteArea');

    // Delete singular site area
    await SiteAreaStorage.deleteSiteAreas(tenantID, [id]);

    // Debug
    Logging.traceEnd('SiteAreaStorage', 'deleteSiteArea', uniqueTimerID, { id });
  }

  public static async deleteSiteAreas(tenantID: string, siteAreaIDs: string[]) {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteAreaStorage', 'deleteSiteAreas');

    // Check Tenant
    await Utils.checkTenant(tenantID);

    // Remove Charging Station's Site Area
    await global.database.getCollection<any>(tenantID, 'chargingstations').updateMany(
      { siteAreaID: { $in: siteAreaIDs.map((ID) => {
        return Utils.convertToObjectID(ID);
      }) } },
      { $set: { siteAreaID: null } },
      { upsert: false });

    // Delete SiteArea
    await global.database.getCollection<any>(tenantID, 'siteareas')
      .deleteMany({ '_id': { $in: siteAreaIDs.map((ID) => {
        return Utils.convertToObjectID(ID);
      }) } });

    // Delete Image
    await global.database.getCollection<any>(tenantID, 'sitesareaimages')
      .deleteMany({ '_id': { $in: siteAreaIDs.map((ID) => {
        return Utils.convertToObjectID(ID);
      }) } });

    // Debug
    Logging.traceEnd('SiteAreaStorage', 'deleteSiteAreas', uniqueTimerID, { siteAreaIDs });
  }

  public static async deleteSiteAreasFromSites(tenantID: string, siteIDs: string[]) {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteAreaStorage', 'deleteSiteAreasFromSites');

    // Check Tenant
    await Utils.checkTenant(tenantID);

    // Find site areas to delete
    const siteareas: string[] = (await global.database.getCollection<any>(tenantID, 'siteareas')
      .find({ siteID: { $in: siteIDs.map((id) => {
        return Utils.convertToObjectID(id);
      }) } }).project({ _id: 1 }).toArray()).map((idWrapper) => {
      return idWrapper._id.toHexString();
    });

    // Delete site areas
    const result = await SiteAreaStorage.deleteSiteAreas(tenantID, siteareas);

    // Debug
    Logging.traceEnd('SiteAreaStorage', 'deleteSiteAreasFromSites', uniqueTimerID, { siteIDs });
  }
}
