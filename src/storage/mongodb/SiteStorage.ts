import Constants from '../../utils/Constants';
import Utils from '../../utils/Utils';
import SiteAreaStorage from './SiteAreaStorage';
import BackendError from '../../exception/BackendError';
import { ObjectID } from 'mongodb';
import DatabaseUtils from './DatabaseUtils';
import Logging from '../../utils/Logging';
import Site from '../../types/Site';
import crypto from 'crypto';
import User from '../../entity/User';
import global from '../../types/GlobalType';
import SiteUserWrapper from '../../types/SiteUserWrapper';
import CreatedUpdatedProps from '../../types/CreatedUpdatedProps';


export default class SiteStorage {

  public static async getSite(tenantID: string, id: string): Promise<Site> {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteStorage', 'getSite');

    const sitesMDB = await SiteStorage.getSites(tenantID, {search: id}, 1, 0, null); //TODO care about whether SiteAreas are already there or not
    
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

  public static async getUsers(tenantID: string, siteID: string, limit: number, skip: number, sort:any = null): Promise<{count: number, result: SiteUserWrapper[]}> {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteStorage', 'getUsers');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check Limit
    limit = Utils.checkRecordLimit(limit);
    // Check Skip
    skip = Utils.checkRecordSkip(skip);
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
    //aggregation.push({
    //  $unwind: { "path": "$user", "preserveNullAndEmptyArrays": true }
    //});
    // Filter deleted users
    aggregation.push({
      $match: {
        "$or": [
          {
            "user.deleted": {
              "$exists": false
            }
          },
          {
            "user.deleted": false
          },
          {
            "user.deleted": null
          }
        ]
      }
    });

    // Count Records
    const usersCountMDB = await global.database.getCollection<any>(tenantID, 'siteusers')
      .aggregate([...aggregation, { $count: "count" }], { allowDiskUse: true })
      .toArray();
    // Sort
    if (sort) {
      // Sort
      aggregation.push({
        $sort: sort
      });
    } else {
      // Default
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
    const siteusersMDB = await global.database.getCollection<any>(tenantID, 'siteusers')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 }, allowDiskUse: true })
      .toArray();
    const users: SiteUserWrapper[] = [];
    // Create
    for (const siteuserMDB of siteusersMDB) {
      if (siteuserMDB.user) {
        users.push({user: siteuserMDB.user, siteAdmin: !siteuserMDB.siteAdmin?false:siteuserMDB.siteAdmin, siteID: siteID});
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

  public static async saveSite(tenantID: string, siteToSave: Optional<Site, 'id'>, saveImage=true): Promise<string> {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteStorage', 'saveSite');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check if ID/Name is provided
    if (!siteToSave.name) {
      // ID must be provided!
      throw new BackendError(
        Constants.CENTRAL_SERVER,
        `Site has no Name`,
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
    let createdProps = {} as {createdBy: ObjectID, createdOn: Date, lastChangedBy: ObjectID, lastChangedOn: Date};
    DatabaseUtils.optionalMongoCreatedPropsCopy(createdProps, siteToSave);
    let mongoSite: Omit<Site, 'id'|'createdBy'|'lastChangedBy'|'createdOn'|'lastChangedOn'>&{_id: string, createdBy: ObjectID, lastChangedBy: ObjectID} = {
      _id: siteFilter._id,
      address: siteToSave.address,
      companyID: Utils.convertToObjectID(siteToSave.companyID),
      allowAllUsersToStopTransactions: siteToSave.allowAllUsersToStopTransactions,
      autoUserSiteAssignment: siteToSave.autoUserSiteAssignment,
      name: siteToSave.name,
      ...createdProps
    };

    // Modify
    const result = await global.database.getCollection<any>(tenantID, 'sites').findOneAndUpdate(
      siteFilter,
      { $set: mongoSite },
      { upsert: true, returnOriginal: false });
    
    
    if(! result.ok ) {
      throw new BackendError(
        Constants.CENTRAL_SERVER,
        `Couldn't update Site`,
        'SiteStorage', 'saveSite');
    }
    let newId = siteFilter._id.toHexString();

    if(saveImage) {
      SiteStorage.saveSiteImage(tenantID, {id: newId, image: siteToSave.image});
    }

    // Debug
    Logging.traceEnd('SiteStorage', 'saveSite', uniqueTimerID, { siteToSave });
    return newId;
  }

  public static async saveSiteImage(tenantID: string, siteImageToSave: {id: string, image: string}): Promise<void> {
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
    await global.database.getCollection<{_id: string, image: string}>(tenantID, 'siteimages').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(siteImageToSave.id) },
      { $set: { image: siteImageToSave.image } },
      { upsert: true, returnOriginal: false });
    // Debug
    Logging.traceEnd('SiteStorage', 'saveSiteImage', uniqueTimerID);
  }

  public static async getSites(tenantID: string, params: {search?: string, companyID?: string, withAutoUserAssignment?: boolean, siteIDs?: string[], 
      userID?: string, excludeSitesOfUserID?: boolean, onlyRecordCount?: boolean, withAvailableChargers?: boolean, withCompany?: boolean} = {},
      limit: number = Constants.MAX_DB_RECORD_COUNT, skip: number = 0, sort: any = null): Promise<{count: number; result: Site[]}> {
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
      if (ObjectID.isValid(params.search)) {
        filters._id = Utils.convertToObjectID(params.search);
      } else {
        filters.$or = [
          { "name": { $regex: params.search, $options: 'i' } }
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
    const sitesCountMDB = await global.database.getCollection<any>(tenantID, 'sites')
      .aggregate([...aggregation, { $count: "count" }], { allowDiskUse: true })
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
      DatabaseUtils.pushSiteAreaJoinInAggregation(tenantID, aggregation, '_id', 'siteID', 'siteAreas', ['address', 'allowUsersToStopTransaction, autoUserSiteAssignement', 'companyID', 'name'], 'manual', false);
      aggregation.push({
        $lookup: {
          from: DatabaseUtils.getCollectionName(tenantID, "chargingstations"),
          localField: "siteAreas.id",
          foreignField: "siteAreaID",
          as: "chargeBoxes"
        }
      });//TODO change when typed
    }

    // Add Company?
    if (params.withCompany) {
      DatabaseUtils.pushCompanyWOSWOIJoinInAggregation(tenantID, aggregation, 'companyID', '_id', 'company', ['chargeBoxes', 'address', 'allowUsersToStopTransaction, autoUserSiteAssignement', 'companyID', 'name'], 'manual');
    }
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);

    aggregation.push({$addFields: {
      id: {$toString: '$_id'}
    }});

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
    const sitesMDB = await global.database.getCollection<Site&{chargeBoxes: any}>(tenantID, 'sites')
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
      .deleteMany({_id: {$in: cids}});
    // Delete Image
    await global.database.getCollection<any>(tenantID, 'siteimages')
      .deleteMany({ '_id': {$in: cids}});
    // Delete Site's Users
    await global.database.getCollection<any>(tenantID, 'siteusers')
      .deleteMany({ 'siteID': {$in: cids}});                        // TODO: Is this wanted behavior?
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
    if (!result) {
      return false;
    }
    // Debug
    Logging.traceEnd('SiteStorage', 'deleteCompanySites', uniqueTimerID, { siteID });
    return true;
  }

}
