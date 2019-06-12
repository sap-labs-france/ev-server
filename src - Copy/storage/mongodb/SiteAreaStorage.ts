import Constants from '../../utils/Constants';
import Database from '../../utils/Database';
import Utils from '../../utils/Utils';
import BackendError from '../../exception/BackendError';
import { ObjectID } from 'mongodb';
import DatabaseUtils from './DatabaseUtils';
import Logging from '../../utils/Logging';
import Site from '../../entity/Site';
import SiteArea from '../../entity/SiteArea';
import ChargingStation from '../../entity/ChargingStation';
import TSGlobal from '../../types/GlobalType';

declare var global: TSGlobal;

export default class SiteAreaStorage {
  static async getSiteAreaImage(tenantID, id) {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteAreaStorage', 'getSiteAreaImage');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const siteAreaImagesMDB = await global.database.getCollection<any>(tenantID, 'siteareaimages')
      .find({ _id: Utils.convertToObjectID(id) })
      .limit(1)
      .toArray();
    let siteAreaImage = null;
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

  static async getSiteArea(tenantID, id, withChargeBoxes, withSite) {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteAreaStorage', 'getSiteArea');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: { _id: Utils.convertToObjectID(id) }
    });
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);
    // Charging Station
    if (withChargeBoxes) {
      // Add
      aggregation.push({
        $lookup: {
          from: DatabaseUtils.getCollectionName(tenantID, "chargingstations"),
          localField: "_id",
          foreignField: "siteAreaID",
          as: "chargingStations"
        }
      });
    }
    // Site
    if (withSite) {
      // Add
      aggregation.push({
        $lookup: {
          from: DatabaseUtils.getCollectionName(tenantID, "sites"),
          localField: "siteID",
          foreignField: "_id",
          as: "site"
        }
      });
      // Add
      aggregation.push({
        $unwind: { "path": "$site", "preserveNullAndEmptyArrays": true }
      });
    }
    // Read DB
    const siteAreasMDB = await global.database.getCollection<any>(tenantID, 'siteareas')
      .aggregate(aggregation, { allowDiskUse: true })
      .toArray();
    let siteArea = null;
    // Create
    if (siteAreasMDB && siteAreasMDB.length > 0) {
      // Create
      siteArea = new SiteArea(tenantID, siteAreasMDB[0]);
      // Set Charging Station
      if (siteAreasMDB[0].chargingStations) {
        // Sort Charging Stations
        siteAreasMDB[0].chargingStations.sort((cb1, cb2) => {
          return cb1._id.localeCompare(cb2._id);
        });
        // Set
        siteArea.setChargingStations(siteAreasMDB[0].chargingStations.map((chargingStation) => {
          // Create the Charging Station
          const chargingStationObj = new ChargingStation(tenantID, chargingStation);
          // Set the Site Area to it
          chargingStationObj.setSiteArea(new SiteArea(tenantID, siteArea.getModel())); // To avoid circular deps Charger -> Site Area -> Charger
          // Return
          return chargingStationObj;
        }));
      }
      // Set Site
      if (siteAreasMDB[0].site) {
        siteArea.setSite(new Site(tenantID, siteAreasMDB[0].site));
      }
    }
    // Debug
    Logging.traceEnd('SiteAreaStorage', 'getSiteArea', uniqueTimerID, { id, withChargeBoxes, withSite });
    return siteArea;
  }

  static async saveSiteArea(tenantID, siteAreaToSave) {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteAreaStorage', 'saveSiteArea');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check if ID/Name is provided
    if (!siteAreaToSave.id && !siteAreaToSave.name) {
      // ID must be provided!
      throw new BackendError(
        Constants.CENTRAL_SERVER,
        `Site Area has no ID and no Name`,
        "SiteAreaStorage", "saveSiteArea");
    }
    const siteAreaFilter: any = {};
    // Build Request
    if (siteAreaToSave.id) {
      siteAreaFilter._id = Utils.convertToObjectID(siteAreaToSave.id);
    } else {
      siteAreaFilter._id = new ObjectID();
    }
    // Check Created By/On
    siteAreaToSave.createdBy = Utils.convertUserToObjectID(siteAreaToSave.createdBy);
    siteAreaToSave.lastChangedBy = Utils.convertUserToObjectID(siteAreaToSave.lastChangedBy);
    // Transfer
    const siteArea: any = {};
    Database.updateSiteArea(siteAreaToSave, siteArea, false);
    // Modify
    const result = await global.database.getCollection<any>(tenantID, 'siteareas').findOneAndUpdate(
      siteAreaFilter,
      { $set: siteArea },
      { upsert: true, returnOriginal: false });
    // Debug
    Logging.traceEnd('SiteAreaStorage', 'saveSiteArea', uniqueTimerID, { siteAreaToSave });
    // Create
    return new SiteArea(tenantID, result.value);
  }

  static async saveSiteAreaImage(tenantID, siteAreaImageToSave) {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteAreaStorage', 'saveSiteAreaImage');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check if ID is provided
    if (!siteAreaImageToSave.id) {
      // ID must be provided!
      throw new BackendError(
        Constants.CENTRAL_SERVER,
        `Site Area Image has no ID`,
        "SiteAreaStorage", "saveSiteAreaImage");
    }
    // Modify
    await global.database.getCollection<any>(tenantID, 'siteareaimages').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(siteAreaImageToSave.id) },
      { $set: { image: siteAreaImageToSave.image } },
      { upsert: true, returnOriginal: false });
    // Debug
    Logging.traceEnd('SiteAreaStorage', 'saveSiteAreaImage', uniqueTimerID);
  }

  static async getSiteAreas(tenantID, params: any = {}, limit?, skip?, sort?) {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteAreaStorage', 'getSiteAreas');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check Limit
    limit = Utils.checkRecordLimit(limit);
    // Check Skip
    skip = Utils.checkRecordSkip(skip);
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
          siteID: { $in: params.siteIDs.map((siteID) => Utils.convertToObjectID(siteID)) }
        }
      });
    }
    // Limit records?
    if (!params.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.MAX_DB_RECORD_COUNT });
    }
    // Count Records
    const siteAreasCountMDB = await global.database.getCollection<any>(tenantID, 'siteareas')
      .aggregate([...aggregation, { $count: "count"}], { allowDiskUse: true })
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
      // Add Sites
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
      // Add Charging Stations
      aggregation.push({
        $lookup: {
          from: DatabaseUtils.getCollectionName(tenantID, "chargingstations"),
          localField: "_id",
          foreignField: "siteAreaID",
          as: "chargeBoxes"
        }
      });
    }
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
    const siteAreasMDB = await global.database.getCollection<any>(tenantID, 'siteareas')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 }, allowDiskUse: true })
      .toArray();
    const siteAreas = [];
    // Check
    if (siteAreasMDB && siteAreasMDB.length > 0) {
      // Create
      for (const siteAreaMDB of siteAreasMDB) {
        // Create
        const siteArea = new SiteArea(tenantID, siteAreaMDB);
        // Set Site Areas
        if (params.withChargeBoxes && siteAreaMDB.chargeBoxes) {
          siteArea.setChargingStations(siteAreaMDB.chargeBoxes.map((chargeBox) => {
            return new ChargingStation(tenantID, chargeBox);
          }));
        }
        // Count Available/Occupied Chargers/Connectors
        if (params.withAvailableChargers) {
          let availableChargers = 0, totalChargers = 0, availableConnectors = 0, totalConnectors = 0;
          // Chargers
          for (const chargeBox of siteAreaMDB.chargeBoxes) {
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
          // Set
          siteArea.setAvailableChargers(availableChargers);
          siteArea.setTotalChargers(totalChargers);
          siteArea.setAvailableConnectors(availableConnectors);
          siteArea.setTotalConnectors(totalConnectors);
        }
        // Set Site
        if (params.withSite && siteAreaMDB.site) {
          // Set
          siteArea.setSite(new Site(tenantID, siteAreaMDB.site));
        }
        // Add
        siteAreas.push(siteArea);
      }
    }
    // Debug
    Logging.traceEnd('SiteAreaStorage', 'getSiteAreas', uniqueTimerID, { params, limit, skip, sort });
    // Ok
    return {
      count: (siteAreasCountMDB.length > 0 ?
        (siteAreasCountMDB[0].count === Constants.MAX_DB_RECORD_COUNT ? -1 : siteAreasCountMDB[0].count) : 0),
      result: siteAreas
    };
  }

  static async deleteSiteArea(tenantID, id) {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteAreaStorage', 'deleteSiteArea');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Remove Charging Station's Site Area
    await global.database.getCollection<any>(tenantID, 'chargingstations').updateMany(
      { siteAreaID: Utils.convertToObjectID(id) },
      { $set: { siteAreaID: null } },
      { upsert: false });
    // Delete Site
    await global.database.getCollection<any>(tenantID, 'siteareas')
      .findOneAndDelete({ '_id': Utils.convertToObjectID(id) });
    // Delete Image
    await global.database.getCollection<any>(tenantID, 'sitesareaimages')
      .findOneAndDelete({ '_id': Utils.convertToObjectID(id) });
    // Debug
    Logging.traceEnd('SiteAreaStorage', 'deleteSiteArea', uniqueTimerID, { id });
  }
}
