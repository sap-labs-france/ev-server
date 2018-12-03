
const Constants = require('../../utils/Constants');
const Database = require('../../utils/Database');
const Utils = require('../../utils/Utils');
const SiteAreaStorage = require('./SiteAreaStorage');
const BackendError = require('../../exception/BackendError');
const ObjectID = require('mongodb').ObjectID;
const DatabaseUtils = require('./DatabaseUtils');
const Logging = require('../../utils/Logging');

class SiteStorage {
  static async getSite(tenantID, id, withCompany, withUsers) {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteStorage', 'getSite');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const Site = require('../../entity/Site'); // Avoid fucking circular deps!!!
    const Company = require('../../entity/Company'); // Avoid fucking circular deps!!!
    const SiteArea = require('../../entity/SiteArea'); // Avoid fucking circular deps!!!
    const User = require('../../entity/User'); // Avoid fucking circular deps!!!
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: {_id: Utils.convertToObjectID(id)}
    });
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID,aggregation);
    // User
    if (withUsers) {
      // Add
      aggregation.push({
        $lookup: {
          from: DatabaseUtils.getCollectionName(tenantID, "siteusers"),
          localField: "_id",
          foreignField: "siteID",
          as: "siteusers"
        }
      });
      // Add
      aggregation.push({
        $lookup: {
          from: DatabaseUtils.getCollectionName(tenantID, "users"),
          localField: "siteusers.userID",
          foreignField: "_id",
          as: "users"
        }
      });
    }
    // Add SiteAreas
    aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenantID, "siteareas"),
        localField: "_id",
        foreignField: "siteID",
        as: "siteAreas"
      }
    });
    if (withCompany) {
      // Add Company
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
        $unwind: {"path": "$company", "preserveNullAndEmptyArrays": true}
      });
    }
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
      // Set Company
      if (withCompany) {
        site.setCompany(new Company(tenantID, sitesMDB[0].company));
      }
      // Set users
      if (withUsers && sitesMDB[0].users) {
        // Create Users
        sitesMDB[0].users = sitesMDB[0].users.map((user) => {
          return new User(tenantID, user);
        });
        site.setUsers(sitesMDB[0].users)
      }
    }
    // Debug
    Logging.traceEnd('SiteStorage', 'getSite', uniqueTimerID);
    return site;
  }

  static async getSiteImage(tenantID, id) {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteStorage', 'getSiteImage');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const siteImagesMDB = await global.database.getCollection(tenantID, 'siteimages')
      .find({_id: Utils.convertToObjectID(id)})
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
    Logging.traceEnd('SiteStorage', 'getSiteImage', uniqueTimerID);
    return siteImage;
  }

  static async getSiteImages(tenantID) {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteStorage', 'getSiteImages');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const siteImagesMDB = await global.database.getCollection(tenantID, 'siteimages')
      .find({})
      .toArray();
    const siteImages = [];
    // Set
    if (siteImagesMDB && siteImagesMDB.length > 0) {
      // Add
      for (const siteImageMDB of siteImagesMDB) {
        siteImages.push({
          id: siteImageMDB._id,
          image: siteImageMDB.image
        });
      }
    }
    // Debug
    Logging.traceEnd('SiteStorage', 'getSiteImages', uniqueTimerID);
    return siteImages;
  }

  static async saveSite(tenantID, siteToSave) {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteStorage', 'saveSite');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const Site = require('../../entity/Site'); // Avoid fucking circular deps!!!
    // Check if ID/Name is provided
    if (!siteToSave.id && !siteToSave.name) {
      // ID must be provided!
      throw new BackendError(
        Constants.CENTRAL_SERVER,
        `Site has no ID and no Name`,
        "SiteStorage", "saveSite");
    }
    const siteFilter = {};
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
    const site = {};
    Database.updateSite(siteToSave, site, false);
    // Modify
    const result = await global.database.getCollection(tenantID, 'sites').findOneAndUpdate(
      siteFilter,
      {$set: site},
      {upsert: true, new: true, returnOriginal: false});
    // Create
    const updatedSite = new Site(tenantID, result.value);
    // Update Users?`
    if (siteToSave.users) {
      // Delete first
      await global.database.getCollection(tenantID, 'siteusers')
        .deleteMany({'siteID': Utils.convertToObjectID(updatedSite.getID())});
      // At least one?
      if (siteToSave.users.length > 0) {
        const siteUsersMDB = [];
        // Create the list
        for (const user of siteToSave.users) {
          // Add
          siteUsersMDB.push({
            "siteID": Utils.convertToObjectID(updatedSite.getID()),
            "userID": Utils.convertToObjectID(user.id)
          });
        }
        // Execute
        await global.database.getCollection(tenantID, 'siteusers').insertMany(siteUsersMDB);
      }
    }
    // Debug
    Logging.traceEnd('SiteStorage', 'saveSite', uniqueTimerID);
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
      {'_id': Utils.convertToObjectID(siteImageToSave.id)},
      {$set: {image: siteImageToSave.image}},
      {upsert: true, new: true, returnOriginal: false});
    // Debug
    Logging.traceEnd('SiteStorage', 'saveSiteImage', uniqueTimerID);
  }

  static async getSites(tenantID, params = {}, limit, skip, sort) {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteStorage', 'getSites');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const ChargingStation = require('../../entity/ChargingStation'); // Avoid fucking circular deps!!!
    const Company = require('../../entity/Company'); // Avoid fucking circular deps!!!
    const Site = require('../../entity/Site'); // Avoid fucking circular deps!!!
    const SiteArea = require('../../entity/SiteArea'); // Avoid fucking circular deps!!!
    const User = require('../../entity/User'); // Avoid fucking circular deps!!!
    // Check Limit
    limit = Utils.checkRecordLimit(limit);
    // Check Skip
    skip = Utils.checkRecordSkip(skip);
    // Set the filters
    const filters = {};
    // Source?
    if (params.search) {
      // Build filter
      filters.$or = [
        {"name": {$regex: params.search, $options: 'i'}}
      ];
    }
    // Set Company?
    if (params.companyID) {
      filters.companyID = Utils.convertToObjectID(params.companyID);
    }
    // Create Aggregation
    const aggregation = [];
    // Set User?
    if (params.withUsers || params.userID || params.excludeSitesOfUserID) {
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
        filters["siteusers.userID"] = {$ne: Utils.convertToObjectID(params.excludeSitesOfUserID)};
      }
      if (params.withUsers) {
        // Add
        aggregation.push({
          $lookup: {
            from: DatabaseUtils.getCollectionName(tenantID, "users"),
            localField: "siteusers.userID",
            foreignField: "_id",
            as: "users"
          }
        });
      }
    }
    if (params.withSiteAreas || params.withChargeBoxes || params.withAvailableChargers) {
      // Add SiteAreas
      aggregation.push({
        $lookup: {
          from: DatabaseUtils.getCollectionName(tenantID, "siteareas"),
          localField: "_id",
          foreignField: "siteID",
          as: "siteAreas"
        }
      });
    }
    // With Chargers?
    if (params.withChargeBoxes || params.withAvailableChargers) {
      aggregation.push({
        $lookup: {
          from: DatabaseUtils.getCollectionName(tenantID, "chargingstations"),
          localField: "siteAreas._id",
          foreignField: "siteAreaID",
          as: "chargeBoxes"
        }
      });
    }
    // Filters
    if (filters) {
      aggregation.push({
        $match: filters
      });
    }
    // Count Records
    const sitesCountMDB = await global.database.getCollection(tenantID, 'sites')
      .aggregate([...aggregation, {$count: "count"}])
      .toArray();
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID,aggregation);
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
        $unwind: {"path": "$company", "preserveNullAndEmptyArrays": true}
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
        $sort: {name: 1}
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
      .aggregate(aggregation, {collation: {locale: Constants.DEFAULT_LOCALE, strength: 2}})
      .toArray();
    const sites = [];
    // Check
    if (sitesMDB && sitesMDB.length > 0) {
      // Create
      for (const siteMDB of sitesMDB) {
        // Create
        const site = new Site(tenantID, siteMDB);
        // Set Users
        if ((params.userID || params.withUsers) && siteMDB.users) {
          // Set Users
          site.setUsers(siteMDB.users.map((user) => new User(tenantID, user)));
        }
        // Count Available Charger
        if (params.withAvailableChargers) {
          let availableChargers = 0;
          // Chargers
          for (const chargeBox of siteMDB.chargeBoxes) {
            // Connectors
            for (const connector of chargeBox.connectors) {
              // Check if Available
              if (connector.status === Constants.CONN_STATUS_AVAILABLE) {
                // Add 1
                availableChargers++;
                break;
              }
            }
          }
          // Set
          site.setAvailableChargers(availableChargers);
        }
        // Set Site Areas
        if ((params.withChargeBoxes || params.withSiteAreas) && siteMDB.siteAreas) {
          // Sort Site Areas
          siteMDB.siteAreas.sort((cb1, cb2) => {
            return cb1.name.localeCompare(cb2.name);
          });
          // Set
          site.setSiteAreas(siteMDB.siteAreas.map((siteArea) => {
            const siteAreaObj = new SiteArea(tenantID, siteArea);
            // Set Site Areas
            if (siteMDB.chargeBoxes) {
              // Filter with Site Area`
              const chargeBoxesPerSiteArea = siteMDB.chargeBoxes.filter((chargeBox) => {
                return !chargeBox.deleted && chargeBox.siteAreaID.toString() == siteArea._id;
              });
              // Sort Charging Stations
              chargeBoxesPerSiteArea.sort((cb1, cb2) => {
                return cb1._id.localeCompare(cb2._id);
              });
              // Set Charger to Site Area
              siteAreaObj.setChargingStations(chargeBoxesPerSiteArea.map((chargeBoxPerSiteArea) => {
                // Create the Charger
                const chargingStation = new ChargingStation(tenantID, chargeBoxPerSiteArea);
                // Set Site Area to Charger
                chargingStation.setSiteArea(new SiteArea(tenantID, siteAreaObj.getModel())); // To avoid circular deps Charger -> Site Area -> Charger
                // Return
                return chargingStation;
              }));
            }
            return siteAreaObj;
          }));
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
    Logging.traceEnd('SiteStorage', 'getSites', uniqueTimerID);
    // Ok
    return {
      count: (sitesCountMDB.length > 0 ? sitesCountMDB[0].count : 0),
      result: sites
    };
  }

  static async deleteSite(tenantID, id) {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteStorage', 'deleteSite');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Delete Site Areas
    const siteAreas = await SiteAreaStorage.getSiteAreas(tenantID, {'siteID': id})
    // Delete
    for (const siteArea of siteAreas.result) {
      //	Delete Site Area
      await siteArea.delete();
    }
    // Delete Site
    await global.database.getCollection(tenantID, 'sites')
      .findOneAndDelete({'_id': Utils.convertToObjectID(id)});
    // Delete Image
    await global.database.getCollection(tenantID, 'siteimages')
      .findOneAndDelete({'_id': Utils.convertToObjectID(id)});
    // Delete Site's Users
    await global.database.getCollection(tenantID, 'siteusers')
      .deleteMany({'siteID': Utils.convertToObjectID(id)});
    // Debug
    Logging.traceEnd('SiteStorage', 'deleteSite', uniqueTimerID);
  }
}

module.exports = SiteStorage;
