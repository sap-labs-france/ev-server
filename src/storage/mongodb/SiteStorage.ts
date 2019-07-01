import crypto from 'crypto';
import { ObjectID } from 'mongodb';
import BackendError from '../../exception/BackendError';
import Constants from '../../utils/Constants';
import DatabaseUtils from './DatabaseUtils';
import global from '../../types/GlobalType';
import Logging from '../../utils/Logging';
import Site from '../../types/Site';
import SiteAreaStorage from './SiteAreaStorage';
import Utils from '../../utils/Utils';
import DbParams from '../../types/database/DbParams';
import UserSite from '../../types/UserSite';

export default class SiteStorage {

  public static async getSite(tenantID: string, id: string): Promise<Site> {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteStorage', 'getSite');
    // Get
    const sitesMDB = await SiteStorage.getSites(tenantID, {
      search: id,
      withCompany: true,
    }, { limit: 1, skip: 0 });
    // Debug
    Logging.traceEnd('SiteStorage', 'getSite', uniqueTimerID, { id });
    return sitesMDB.result[0];
  }

  public static async getSiteImage(tenantID: string, id: string): Promise<{id: string, image: string}> {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteStorage', 'getSiteImage');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const siteImagesMDB = await global.database.getCollection<{_id: string, image: string}>(tenantID, 'siteimages')
      .find({ _id: Utils.convertToObjectID(id) })
      .limit(1)
      .toArray();

    let siteImage: {id: string, image: string} = null;
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

  public static async removeUsersFromSite(tenantID: string, siteID: string, userIDs: string[]): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteStorage', 'removeUsersFromSite');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Site provided?
    if (siteID) {
      // At least one User
      if (userIDs && userIDs.length > 0) {
        // Execute
        await global.database.getCollection<any>(tenantID, 'siteusers').deleteMany({
          "userID": { $in: userIDs.map(userID => Utils.convertToObjectID(userID)) },
          "siteID": Utils.convertToObjectID(siteID)
        });
      }
    }
    // Debug
    Logging.traceEnd('SiteStorage', 'removeUsersFromSite', uniqueTimerID, { siteID, userIDs });
  }

  public static async addUsersToSite(tenantID: string, siteID: string, userIDs: string[]): Promise<void> {
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
            "_id": crypto.createHash('sha256').update(`${siteID}~${userID}`).digest("hex"),
            "userID": Utils.convertToObjectID(userID),
            "siteID": Utils.convertToObjectID(siteID),
            "siteAdmin": false
          });
        }
        // Execute
        await global.database.getCollection<any>(tenantID, 'siteusers').insertMany(siteUsers);
      }
    }
    // Debug
    Logging.traceEnd('SiteStorage', 'addUsersToSite', uniqueTimerID, { siteID, userIDs });
  }

  public static async getUsers(tenantID: string, siteID: string, dbParams: DbParams): Promise<{count: number, result: UserSite[]}> {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteStorage', 'getUsers');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check Limit
    const limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    const skip = Utils.checkRecordSkip(dbParams.skip);
    // Create Aggregation
    const aggregation: any[] = [];
    // Filter
    aggregation.push({
      $match: {
        siteID: Utils.convertToObjectID(siteID)
      }
    });

    // Get users
    aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenantID, "users"),
        localField: "userID",
        foreignField: "_id",
        as: "user"
      }
    });
    // Single Record
    aggregation.push({
      $unwind: { "path": "$user", "preserveNullAndEmptyArrays": true }
    });
    // Filter deleted users
    aggregation.push({
      $match: {
        '$or': [
          { "user.deleted": { "$exists": false } },
          { "user.deleted": false },
          { "user.deleted": null }
        ]
      }
    });
    // Count Records
    const usersCountMDB = await global.database.getCollection<{count: number}>(tenantID, 'siteusers')
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
    // Sort
    if (dbParams.sort) {
      aggregation.push({
        $sort: dbParams.sort
      });
    } else {
      aggregation.push({
        $sort: { "user.name": 1, "user.firstName": 1 }
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
    const siteUsersMDB = await global.database.getCollection<any>(tenantID, 'siteusers')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 }, allowDiskUse: true })
      .toArray();
    const users: UserSite[] = [];
    // Create
    for (const siteUserMDB of siteUsersMDB) {
      if (siteUserMDB.user) {
        siteUserMDB.user.id = siteUserMDB.user._id;
        users.push({user: siteUserMDB.user, siteAdmin: !siteUserMDB.siteAdmin ? false : siteUserMDB.siteAdmin, siteID: siteID});
      }
    }
    // Debug
    Logging.traceEnd('SiteStorage', 'getUsers', uniqueTimerID, { siteID: siteID });
    // Ok
    return {
      count: (usersCountMDB.length > 0 ?
        (usersCountMDB[0].count === Constants.MAX_DB_RECORD_COUNT ? -1 : usersCountMDB[0].count) : 0),
      result: users
    };
  }

  public static async updateSiteUserAdmin(tenantID: string, siteID: string, userID: string, siteAdmin: boolean): Promise<void> {
    const uniqueTimerID = Logging.traceStart('SiteStorage', 'updateSiteUserAdmin');
    await Utils.checkTenant(tenantID);

    await global.database.getCollection<any>(tenantID, 'siteusers').updateOne(
      {
        siteID: Utils.convertToObjectID(siteID),
        userID: Utils.convertToObjectID(userID)
      },
      {
        $set: { siteAdmin }
      });
    Logging.traceEnd('SiteStorage', 'updateSiupdateSiteUserAdminteUserRole', uniqueTimerID, { siteID, userID, siteAdmin });
  }

  public static async saveSite(tenantID: string, siteToSave: Site, saveImage=true): Promise<string> {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteStorage', 'saveSite');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const siteFilter: any = {};
    // Build Request
    if (siteToSave.id) {
      siteFilter._id = Utils.convertUserToObjectID(siteToSave.id);
    } else {
      siteFilter._id = new ObjectID();
    }
    // Check Created By/On
    const siteMDB: any = {
      _id: siteFilter._id,
      address: siteToSave.address,
      companyID: Utils.convertToObjectID(siteToSave.companyID),
      allowAllUsersToStopTransactions: siteToSave.allowAllUsersToStopTransactions,
      autoUserSiteAssignment: siteToSave.autoUserSiteAssignment,
      name: siteToSave.name,
    };
    // Add Last Changed/Created props
    DatabaseUtils.mongoConvertLastChangedCreatedProps(siteMDB, siteToSave);

    // Modify
    const result = await global.database.getCollection<any>(tenantID, 'sites').findOneAndUpdate(
      siteFilter,
      { $set: siteMDB },
      { upsert: true, returnOriginal: false });


    if(!result.ok) {
      throw new BackendError(
        Constants.CENTRAL_SERVER,
        `Couldn't update Site`,
        'SiteStorage', 'saveSite');
    }

    if(saveImage) {
      SiteStorage.saveSiteImage(tenantID, siteFilter._id.toHexString(), siteToSave.image);
    }

    // Debug
    Logging.traceEnd('SiteStorage', 'saveSite', uniqueTimerID, { siteToSave });
    return siteFilter._id.toHexString();
  }

  public static async saveSiteImage(tenantID: string, siteID: string, siteImageToSave: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteStorage', 'saveSiteImage');

    // Check Tenant
    await Utils.checkTenant(tenantID);

    // Modify
    await global.database.getCollection<{_id: string, image: string}>(tenantID, 'siteimages').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(siteID) },
      { $set: { image: siteImageToSave } },
      { upsert: true, returnOriginal: false });

      // Debug
    Logging.traceEnd('SiteStorage', 'saveSiteImage', uniqueTimerID);
  }

  public static async getSites(tenantID: string,
      params: {search?: string, companyID?: string, withAutoUserAssignment?: boolean, siteIDs?: string[],
        userID?: string, excludeSitesOfUserID?: boolean, onlyRecordCount?: boolean, withAvailableChargers?: boolean, withCompany?: boolean} = {},
      dbParams: DbParams): Promise<{count: number; result: Site[]}> {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteStorage', 'getSites');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check Limit
    const limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    const skip = Utils.checkRecordSkip(dbParams.skip);
    // Set the filters
    const filters: any = {};
    // Source?
    if (params.search) {
      if (ObjectID.isValid(params.search)) {
        filters._id = Utils.convertToObjectID(params.search);
      } else {
        filters.$or = [
          { 'name': { $regex: params.search, $options: 'i' } }
        ];
      }
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
        } //TODO convert when User is getting typed as well
      });
      // User ID filter
      if (params.userID) {
        filters['siteusers.userID'] = Utils.convertToObjectID(params.userID);
      }
      // Exclude User ID filter
      if (params.excludeSitesOfUserID) {
        filters['siteusers.userID'] = { $ne: Utils.convertToObjectID(params.excludeSitesOfUserID) };
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
    const sitesCountMDB = await global.database.getCollection<any>(tenantID, 'sites')
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
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

    // Add Chargers
    if (params.withAvailableChargers) {
      DatabaseUtils.pushSiteAreaJoinInAggregation(tenantID, aggregation, '_id', 'siteID', 'siteAreas', ['address', 'allowAllUsersToStopTransactions', 'autoUserSiteAssignement', 'companyID', 'name'], 'manual', false);
      aggregation.push({
        $lookup: {
          from: DatabaseUtils.getCollectionName(tenantID, 'chargingstations'),
          localField: 'siteAreas.id',
          foreignField: 'siteAreaID',
          as: 'chargeBoxes'
        }
      });//TODO change when typed
    }

    // Add Company?
    if (params.withCompany) {
      DatabaseUtils.pushCompanyWOSWOIJoinInAggregation(tenantID, aggregation, 'companyID', '_id', 'company', ['chargeBoxes', 'siteAreas', 'address', 'allowAllUsersToStopTransactions', 'autoUserSiteAssignement', 'companyID', 'name'], 'manual');
    }
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);

    aggregation.push({$addFields: {
      id: {$toString: '$_id'}
    }});

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
    aggregation.push({
      $skip: skip
    });
    // Limit
    aggregation.push({
      $limit: limit
    });

    // Read DB
    const sitesMDB = await global.database.getCollection<any>(tenantID, 'sites')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 }, allowDiskUse: true }) //TODO change this method when typed ChargingStation...
      .toArray();
    const sites = [];
    // Check
    if (sitesMDB && sitesMDB.length > 0) {
      // Create
      for (const site of sitesMDB) {
        // Count Available/Occupied Chargers/Connectors
        if (params.withAvailableChargers) {
          let availableChargers = 0, totalChargers = 0, availableConnectors = 0, totalConnectors = 0;
          // Chargers
          for (const chargeBox of site.chargeBoxes) {
            // Check not deleted
            if (chargeBox.deleted) {
              continue;
            }
            totalChargers++;
            // Handle Connectors
            for (const connector of chargeBox.connectors) {
              totalConnectors++;
              // Check Available
              if (connector.status === Constants.CONN_STATUS_AVAILABLE) {
                availableConnectors++;
              }
            }
            // Handle Chargers
            for (const connector of chargeBox.connectors) {
              // Check Available
              if (connector.status === Constants.CONN_STATUS_AVAILABLE) {
                availableChargers++;
                break;
              }
            }
          }
          // Set
          site.availableChargers = availableChargers;
          site.totalChargers = totalChargers;
          site.availableConnectors = availableConnectors;
          site.totalConnectors = totalConnectors;
        }
        if(!site.allowAllUsersToStopTransactions)
          site.allowAllUsersToStopTransactions = false;
        if(!site.autoUserSiteAssignment)
          site.autoUserSiteAssignment = false;
        // Add
        sites.push(site);
      }
    }
    // Debug
    Logging.traceEnd('SiteStorage', 'getSites', uniqueTimerID, { params, limit, skip, sort: dbParams.sort });
    // Ok
    return {
      count: (sitesCountMDB.length > 0 ?
        (sitesCountMDB[0].count === Constants.MAX_DB_RECORD_COUNT ? -1 : sitesCountMDB[0].count) : 0),
      result: sites
    };
  }

  public static async deleteSite(tenantID: string, id: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteStorage', 'deleteSite');

    SiteStorage.deleteSites(tenantID, [id]);

    // Debug
    Logging.traceEnd('SiteStorage', 'deleteSite', uniqueTimerID, { id });
  }

  public static async deleteSites(tenantID: string, ids: string[]): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteStorage', 'deleteSites');
    // Check Tenant
    await Utils.checkTenant(tenantID);

    SiteAreaStorage.deleteSiteAreasFromSites(tenantID, ids);

    const cids: ObjectID[] = ids.map(id => Utils.convertToObjectID(id));

    // Delete Site
    await global.database.getCollection<any>(tenantID, 'sites')
      .deleteMany({'_id': {$in: cids}});
    // Delete Image
    await global.database.getCollection<any>(tenantID, 'siteimages')
      .deleteMany({'_id': {$in: cids}});
    // Delete Site's Users
    await global.database.getCollection<any>(tenantID, 'siteusers')
      .deleteMany({'siteID': {$in: cids}});
    // Debug
    Logging.traceEnd('SiteStorage', 'deleteSites', uniqueTimerID, { ids });
  }

  public static async deleteCompanySites(tenantID: string, companyID: string) {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteStorage', 'deleteCompanySites');
    // Check Tenant
    await Utils.checkTenant(tenantID);

    // Get sites to fetch IDs in order to delete site areas
    const siteIDs: string[] = (await global.database.getCollection<{_id: ObjectID}>(tenantID, 'sites')
      .find({ companyID: Utils.convertToObjectID(companyID) })
      .project({_id: 1})
      .toArray())
      .map((site) => {
        return site._id.toHexString();
      });

    // Delete site areas
    SiteAreaStorage.deleteSiteAreasFromSites(tenantID, siteIDs);

    // Delete sites
    SiteStorage.deleteSites(tenantID, siteIDs);

    // Debug
    Logging.traceEnd('SiteStorage', 'deleteCompanySites', uniqueTimerID, { companyID });
  }

  public static async siteExists(tenantID: string, siteID: string): Promise<boolean> {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteStorage', 'deleteCompanySites');
    // Check Tenant
    await Utils.checkTenant(tenantID);

    const result = await global.database.getCollection<any>(tenantID, 'sites').findOne({ _id: Utils.convertToObjectID(siteID) });

    // Debug
    Logging.traceEnd('SiteStorage', 'deleteCompanySites', uniqueTimerID, { siteID });

    // Check
    if (!result) {
      return false;
    }
    return true;
  }

  public static async siteHasUser(tenantID: string, siteID: string, userID: string): Promise<boolean> {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteStorage', 'siteHasUser');
    // Check Tenant
    await Utils.checkTenant(tenantID);

    const result = await global.database.getCollection<any>(tenantID, 'siteusers').findOne(
      { siteID: Utils.convertToObjectID(siteID), userID: Utils.convertToObjectID(userID) });

    // Debug
    Logging.traceEnd('SiteStorage', 'deleteCompanySites', uniqueTimerID, { siteID });

    // Check
    if (!result) {
      return false;
    }
    return true;
  }
}
