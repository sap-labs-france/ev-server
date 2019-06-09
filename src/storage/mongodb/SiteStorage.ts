import Constants from '../../utils/Constants';
import Database from '../../utils/Database';
import Utils from '../../utils/Utils';
import SiteAreaStorage from './SiteAreaStorage';
import BackendError from '../../exception/BackendError';
const ObjectID = require('mongodb').ObjectID;
import DatabaseUtils from './DatabaseUtils';
import Logging from '../../utils/Logging';
import Site from '../../entity/Site';
import Company from '../../entity/Company';
import SiteArea from '../../entity/SiteArea';
import User from '../../entity/User';
import TSGlobal from '../../types/GlobalType';
import ChargingStation from '../../entity/ChargingStation';
let var global: TSGlobal;

export default class SiteStorage {
  static async getSite(tenantID, id) {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteStorage', 'getSite');
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
    
    // Add SiteAreas
    aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenantID, "siteareas"),
        localField: "_id",
        foreignField: "siteID",
        as: "siteAreas"
      }
    });
    
    // Read DB
    const sitesMDB = await global.database.getCollection(tenantID, 'sites')
      .aggregate(aggregation)
      .toArray();
    let site = null;
    // Create
    if (sitesMDB && sitesMDB.length > 0) {
      // Create
      site = new Site(tenantID, sitesMDB[0]);
      // Set Site Areas
      site.setSiteAreas(sitesMDB[0].siteAreas.map((siteArea) => {
        return new SiteArea(tenantID, siteArea);
      }));
    }
    // Debug
    Logging.traceEnd('SiteStorage', 'getSite', uniqueTimerID, { id });
    return site;
  }

  static async getSiteImage(tenantID, id) {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteStorage', 'getSiteImage');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const siteImagesMDB = await global.database.getCollection(tenantID, 'siteimages')
      .find({ _id: Utils.convertToObjectID(id) })
      .limit(1)
      .toArray();
    let siteImage = null;
    // Set
    if (siteImagesMDB && siteImagesMDB.length > 0) {
      siteImage = {
        id: siteImagesMDB[0]._id,
        image: siteImagesMDB[0].image
      };
    }
    // Debug
    Logging.traceEnd('SiteStorage', 'getSiteImage', uniqueTimerID, { id });
    return siteImage;
  }

  static async removeUsersFromSite(tenantID, siteID, userIDs) {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteStorage', 'removeUsersFromSite');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Site provided?
    if (siteID) {
      // At least one User
      if (userIDs && userIDs.length > 0) {
        // Create the list
        for (const userID of userIDs) {
          // Execute
          await global.database.getCollection(tenantID, 'siteusers').deleteMany({
            "userID": Utils.convertToObjectID(userID),
            "siteID": Utils.convertToObjectID(siteID)
          });
        }
      }
    }
    // Debug
    Logging.traceEnd('SiteStorage', 'removeUsersFromSite', uniqueTimerID, { siteID, userIDs });
  }

  static async addUsersToSite(tenantID, siteID, userIDs) {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteStorage', 'addUsersToSite');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Site provided?
    if (siteID) {
      // At least one User
      if (userIDs && userIDs.length > 0) {
        const siteUsers = [];
        // Create the list
        for (const userID of userIDs) {
          // Add
          siteUsers.push({
            "userID": Utils.convertToObjectID(userID),
            "siteID": Utils.convertToObjectID(siteID)
          });
        }
        // Execute
        await global.database.getCollection(tenantID, 'siteusers').insertMany(siteUsers);
      }
    }
    // Debug
    Logging.traceEnd('SiteStorage', 'addUsersToSite', uniqueTimerID, { siteID, userIDs });
  }

  static async saveSite(tenantID, siteToSave) {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteStorage', 'saveSite');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check if ID/Name is provided
    if (!siteToSave.id && !siteToSave.name) {
      // ID must be provided!
      throw new BackendError(
        Constants.CENTRAL_SERVER,
        `Site has no ID and no Name`,
        "SiteStorage", "saveSite");
    }
    const siteFilter: any = {};
    // Build Request
    if (siteToSave.id) {
      siteFilter._id = Utils.convertUserToObjectID(siteToSave.id);
    } else {
      siteFilter._id = new ObjectID();
    }
    // Check Created By/On
    siteToSave.createdBy = Utils.convertUserToObjectID(siteToSave.createdBy);
    siteToSave.lastChangedBy = Utils.convertUserToObjectID(siteToSave.lastChangedBy);
    // Transfer
    const site: any = {};
    Database.updateSite(siteToSave, site, false);
    // Modify
    const result = await global.database.getCollection(tenantID, 'sites').findOneAndUpdate(
      siteFilter,
      { $set: site },
      { upsert: true, returnOriginal: false });
    // Create
    const updatedSite = new Site(tenantID, result.value);

    // Debug
    Logging.traceEnd('SiteStorage', 'saveSite', uniqueTimerID, { siteToSave });
    return updatedSite;
  }

  static async saveSiteImage(tenantID, siteImageToSave) {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteStorage', 'saveSiteImage');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check if ID is provided
    if (!siteImageToSave.id) {
      // ID must be provided!
      throw new BackendError(
        Constants.CENTRAL_SERVER,
        `Site Image has no ID`,
        "SiteStorage", "saveSiteImage");
    }
    // Modify
    await global.database.getCollection(tenantID, 'siteimages').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(siteImageToSave.id) },
      { $set: { image: siteImageToSave.image } },
      { upsert: true, returnOriginal: false });
    // Debug
    Logging.traceEnd('SiteStorage', 'saveSiteImage', uniqueTimerID);
  }

  static async getSites(tenantID, params: any = {}, limit?, skip?, sort?) {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteStorage', 'getSites');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check Limit
    limit = Utils.checkRecordLimit(limit);
    // Check Skip
    skip = Utils.checkRecordSkip(skip);
    // Set the filters
    const filters: any = {};
    // Source?
    if (params.search) {
      filters.$or = [
        { "name": { $regex: params.search, $options: 'i' } }
      ];
    }
    // Set Company?
    if (params.companyID) {
      filters.companyID = Utils.convertToObjectID(params.companyID);
    }
    // Auto User Site Assignment
    if (params.withAutoUserAssignment) {
      filters.autoUserSiteAssignment = true;
    }
    // Create Aggregation
    const aggregation = [];
    // Limit on Site for Basic Users
    if (params.siteIDs && params.siteIDs.length > 0) {
      // Build filter
      aggregation.push({
        $match: {
          _id: { $in: params.siteIDs.map((siteID) => Utils.convertToObjectID(siteID)) }
        }
      });
    }
    // Set User?
    if (params.userID || params.excludeSitesOfUserID) {
      // Add Users
      aggregation.push({
        $lookup: {
          from: DatabaseUtils.getCollectionName(tenantID, "siteusers"),
          localField: "_id",
          foreignField: "siteID",
          as: "siteusers"
        }
      });
      // User ID filter
      if (params.userID) {
        filters["siteusers.userID"] = Utils.convertToObjectID(params.userID);
      }
      // Exclude User ID filter
      if (params.excludeSitesOfUserID) {
        filters["siteusers.userID"] = { $ne: Utils.convertToObjectID(params.excludeSitesOfUserID) };
      }
      
    }
    // Filters
    if (filters) {
      aggregation.push({
        $match: filters
      });
    }
    // Limit records?
    if (!params.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.MAX_DB_RECORD_COUNT });
    }
    // Count Records
    const sitesCountMDB = await global.database.getCollection(tenantID, 'sites')
      .aggregate([...aggregation, { $count: "count" }])
      .toArray();
    // Check if only the total count is requested
    if (params.onlyRecordCount) {
      // Return only the count
      return {
        count: (sitesCountMDB.length > 0 ? sitesCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();

    if (params.withAvailableChargers) {
      aggregation.push({
        $lookup: {
          from: DatabaseUtils.getCollectionName(tenantID, "siteareas"),
          localField: "_id",
          foreignField: "siteID",
          as: "siteAreas"
        }
      });
    }
    // Add Chargers
    if (params.withAvailableChargers) {
      aggregation.push({
        $lookup: {
          from: DatabaseUtils.getCollectionName(tenantID, "chargingstations"),
          localField: "siteAreas._id",
          foreignField: "siteAreaID",
          as: "chargeBoxes"
        }
      });
    }

    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);
    // Add Company?
    if (params.withCompany) {
      aggregation.push({
        $lookup: {
          from: DatabaseUtils.getCollectionName(tenantID, "companies"),
          localField: "companyID",
          foreignField: "_id",
          as: "company"
        }
      });
      // Single Record
      aggregation.push({
        $unwind: { "path": "$company", "preserveNullAndEmptyArrays": true }
      });
    }
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
    const sitesMDB = await global.database.getCollection(tenantID, 'sites')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 } })
      .toArray();
    const sites = [];
    // Check
    if (sitesMDB && sitesMDB.length > 0) {
      // Create
      for (const siteMDB of sitesMDB) {
        // Create
        const site = new Site(tenantID, siteMDB);
        // Set Users
        if (params.userID && siteMDB.users) {
          // Set Users
          site.setUsers(siteMDB.users.map((user) => new User(tenantID, user)));
        }
        // Count Available/Occupied Chargers/Connectors
        if (params.withAvailableChargers) {
          let availableChargers = 0, totalChargers = 0, availableConnectors = 0, totalConnectors = 0;
          // Chargers
          for (const chargeBox of siteMDB.chargeBoxes) {
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
          site.setAvailableChargers(availableChargers);
          site.setTotalChargers(totalChargers);
          site.setAvailableConnectors(availableConnectors);
          site.setTotalConnectors(totalConnectors);
        }
        
        // Set Company?
        if (siteMDB.company) {
          site.setCompany(new Company(tenantID, siteMDB.company));
        }
        // Add
        sites.push(site);
      }
    }
    // Debug
    Logging.traceEnd('SiteStorage', 'getSites', uniqueTimerID, { params, limit, skip, sort });
    // Ok
    return {
      count: (sitesCountMDB.length > 0 ?
        (sitesCountMDB[0].count === Constants.MAX_DB_RECORD_COUNT ? -1 : sitesCountMDB[0].count) : 0),
      result: sites
    };
  }

  static async deleteSite(tenantID, id) {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteStorage', 'deleteSite');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Delete Site Areas
    const siteAreas = await SiteAreaStorage.getSiteAreas(tenantID, { 'siteID': id });
    // Delete
    for (const siteArea of siteAreas.result) {
      //	Delete Site Area
      await siteArea.delete();
    }
    // Delete Site
    await global.database.getCollection(tenantID, 'sites')
      .findOneAndDelete({ '_id': Utils.convertToObjectID(id) });
    // Delete Image
    await global.database.getCollection(tenantID, 'siteimages')
      .findOneAndDelete({ '_id': Utils.convertToObjectID(id) });
    // Delete Site's Users
    await global.database.getCollection(tenantID, 'siteusers')
      .deleteMany({ 'siteID': Utils.convertToObjectID(id) });
    // Debug
    Logging.traceEnd('SiteStorage', 'deleteSite', uniqueTimerID, { id });
  }
}
