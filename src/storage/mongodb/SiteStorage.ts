import crypto from 'crypto';
import { ObjectID } from 'mongodb';
import BackendError from '../../exception/BackendError';
import Constants from '../../utils/Constants';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import global from '../../types/GlobalType';
import Logging from '../../utils/Logging';
import Site from '../../types/Site';
import SiteAreaStorage from './SiteAreaStorage';
import UserSite from '../../types/User';
import Utils from '../../utils/Utils';
import ChargingStationStorage from './ChargingStationStorage';

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

  public static async getSiteImage(tenantID: string, id: string): Promise<{id: string; image: string}> {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteStorage', 'getSiteImage');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const siteImagesMDB = await global.database.getCollection<{_id: string; image: string}>(tenantID, 'siteimages')
      .find({ _id: Utils.convertToObjectID(id) })
      .limit(1)
      .toArray();
    let siteImage: {id: string; image: string} = null;
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
          'userID': { $in: userIDs.map((userID) => {
            return Utils.convertToObjectID(userID);
          }) },
          'siteID': Utils.convertToObjectID(siteID)
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
            '_id': crypto.createHash('sha256').update(`${siteID}~${userID}`).digest('hex'),
            'userID': Utils.convertToObjectID(userID),
            'siteID': Utils.convertToObjectID(siteID),
            'siteAdmin': false
          });
        }
        // Execute
        await global.database.getCollection<any>(tenantID, 'siteusers').insertMany(siteUsers);
      }
    }
    // Debug
    Logging.traceEnd('SiteStorage', 'addUsersToSite', uniqueTimerID, { siteID, userIDs });
  }

  public static async getUsers(tenantID: string,
      params: { siteID: string; onlyRecordCount?: boolean },
      dbParams: DbParams, projectFields?: string[]): Promise<{count: number; result: UserSite[]}> {
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
        siteID: Utils.convertToObjectID(params.siteID)
      }
    });
    // Get users
    DatabaseUtils.pushUserLookupInAggregation(
      { tenantID, aggregation, localField: 'userID', foreignField: '_id',
        asField: 'user', oneToOneCardinality: true, oneToOneCardinalityNotNull: true });
    // Filter deleted users
    aggregation.push({
      $match: {
        '$or': DatabaseUtils.getNotDeletedFilter('user')
      }
    });
    // Convert IDs to String
    DatabaseUtils.convertObjectIDToString(aggregation, "userID");
    DatabaseUtils.convertObjectIDToString(aggregation, "siteID");
    // Limit records?
    if (!params.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.MAX_DB_RECORD_COUNT });
    }
    // Count Records
    const usersCountMDB = await global.database.getCollection<{count: number}>(tenantID, 'siteusers')
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
    // Check if only the total count is requested
    if (params.onlyRecordCount) {
      return {
        count: (usersCountMDB.length > 0 ? usersCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Sort
    if (dbParams.sort) {
      aggregation.push({
        $sort: dbParams.sort
      });
    } else {
      aggregation.push({
        $sort: { 'user.name': 1, 'user.firstName': 1 }
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
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const siteUsersMDB = await global.database.getCollection<any>(tenantID, 'siteusers')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 }, allowDiskUse: true })
      .toArray();
    const users: UserSite[] = [];
    // Convert to typed object
    for (const siteUserMDB of siteUsersMDB) {
      users.push({ user: siteUserMDB.user, siteAdmin: !siteUserMDB.siteAdmin ? false : siteUserMDB.siteAdmin, siteID: params.siteID });
    }
    // Debug
    Logging.traceEnd('SiteStorage', 'getUsers', uniqueTimerID, { siteID: params.siteID });
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

  public static async saveSite(tenantID: string, siteToSave: Site, saveImage = true): Promise<string> {
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
    DatabaseUtils.addLastChangedCreatedProps(siteMDB, siteToSave);
    // Modify
    const result = await global.database.getCollection<any>(tenantID, 'sites').findOneAndUpdate(
      siteFilter,
      { $set: siteMDB },
      { upsert: true, returnOriginal: false }
    );
    if (!result.ok) {
      throw new BackendError(
        Constants.CENTRAL_SERVER,
        'Couldn\'t update Site',
        'SiteStorage', 'saveSite');
    }
    if (saveImage) {
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
    await global.database.getCollection<{_id: string; image: string}>(tenantID, 'siteimages').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(siteID) },
      { $set: { image: siteImageToSave } },
      { upsert: true, returnOriginal: false }
    );
    // Debug
    Logging.traceEnd('SiteStorage', 'saveSiteImage', uniqueTimerID);
  }

  public static async getSites(tenantID: string,
    params: {
      search?: string; companyID?: string; withAutoUserAssignment?: boolean; siteIDs?: string[];
      userID?: string; excludeSitesOfUserID?: boolean; onlyRecordCount?: boolean;
      withAvailableChargers?: boolean; withCompany?: boolean; } = {},
    dbParams: DbParams, projectFields?: string[]): Promise<{count: number; result: Site[]}> {
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
      // Yes, add in filter
      // Parse companies with the | delimiter for multiple values
      const companySplitted = params.companyID.split('|');
      if(companySplitted.length > 1) {
          filters.companyID = { $in: companySplitted };;
        } else {
          filters.companyID = params.companyID;
      }
    }
    // Auto User Site Assignment
    if (params.withAutoUserAssignment) {
      filters.autoUserSiteAssignment = true;
    }
    // Create Aggregation
    const aggregation = [];
    // Limit on Site for Basic Users
    if (params.siteIDs && params.siteIDs.length > 0) {
      aggregation.push({
        $match: {
          _id: { $in: params.siteIDs.map((siteID) => {
            return Utils.convertToObjectID(siteID);
          }) }
        }
      });
    }
    // Set User?
    if (params.userID || params.excludeSitesOfUserID) {
      // Get users
      DatabaseUtils.pushCollectionLookupInAggregation('siteusers',
        { tenantID, aggregation, localField: '_id', foreignField: 'siteID', asField: 'siteusers' }
      );
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
    aggregation.push({
      $match: filters
    });
    // Limit records?
    if (!params.onlyRecordCount) {
      aggregation.push({ $limit: Constants.MAX_DB_RECORD_COUNT });
    }
    // Count Records
    const sitesCountMDB = await global.database.getCollection<any>(tenantID, 'sites')
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
    // Check if only the total count is requested
    if (params.onlyRecordCount) {
      return {
        count: (sitesCountMDB.length > 0 ? sitesCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Add Company
    if (params.withCompany) {
      DatabaseUtils.pushCompanyLookupInAggregation(
        { tenantID, aggregation, localField: 'companyID', foreignField: '_id',
          asField: 'company', oneToOneCardinality: true });
    }
    // Convert Object ID to string
    DatabaseUtils.convertObjectIDToString(aggregation, 'companyID');
    // Add Last Changed / Created
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);
    // Handle the ID
    DatabaseUtils.renameDatabaseID(aggregation);
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
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const sitesMDB = await global.database.getCollection<any>(tenantID, 'sites')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 }, allowDiskUse: true })
      .toArray();
    const sites = [];
    // Check
    if (sitesMDB && sitesMDB.length > 0) {
      // Create
      for (const siteMDB of sitesMDB) {
        // Count Available/Occupied Chargers/Connectors
        if (params.withAvailableChargers) {
          let availableChargers = 0, totalChargers = 0, availableConnectors = 0, totalConnectors = 0;
          // Get te chargers
          const chargingStations = await ChargingStationStorage.getChargingStations(tenantID, {siteIDs: [siteMDB.id]}, Constants.MAX_DB_RECORD_COUNT, 0);
          for (const chargingStation of chargingStations.result) {
            // Check not deleted
            if (chargingStation.isDeleted()) {
              continue;
            }
            totalChargers++;
            // Handle Connectors
            for (const connector of chargingStation.getConnectors()) {
              if (!connector) {
                continue;
              }
              totalConnectors++;
              // Check Available
              if (connector.status === Constants.CONN_STATUS_AVAILABLE) {
                availableConnectors++;
              }
            }
            // Handle Chargers
            for (const connector of chargingStation.getConnectors()) {
              if (!connector) {
                continue;
              }
              // Check Available
              if (connector.status === Constants.CONN_STATUS_AVAILABLE) {
                availableChargers++;
                break;
              }
            }
          }
          // Set
          siteMDB.availableChargers = availableChargers;
          siteMDB.totalChargers = totalChargers;
          siteMDB.availableConnectors = availableConnectors;
          siteMDB.totalConnectors = totalConnectors;
        }
        if (!siteMDB.allowAllUsersToStopTransactions) {
          siteMDB.allowAllUsersToStopTransactions = false;
        }
        if (!siteMDB.autoUserSiteAssignment) {
          siteMDB.autoUserSiteAssignment = false;
        }
        // Add
        sites.push(siteMDB);
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
    // Delegate
    await SiteStorage.deleteSites(tenantID, [id]);
    // Debug
    Logging.traceEnd('SiteStorage', 'deleteSite', uniqueTimerID, { id });
  }

  public static async deleteSites(tenantID: string, ids: string[]): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteStorage', 'deleteSites');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Delete all Site Areas
    SiteAreaStorage.deleteSiteAreasFromSites(tenantID, ids);
    // Convert
    const cids: ObjectID[] = ids.map((id) => {
      return Utils.convertToObjectID(id);
    });
    // Delete Site
    await global.database.getCollection<any>(tenantID, 'sites')
      .deleteMany({ '_id': { $in: cids } });
    // Delete Image
    await global.database.getCollection<any>(tenantID, 'siteimages')
      .deleteMany({ '_id': { $in: cids } });
    // Delete Site's Users
    await global.database.getCollection<any>(tenantID, 'siteusers')
      .deleteMany({ 'siteID': { $in: cids } });
    // Debug
    Logging.traceEnd('SiteStorage', 'deleteSites', uniqueTimerID, { ids });
  }

  public static async deleteCompanySites(tenantID: string, companyID: string) {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteStorage', 'deleteCompanySites');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Get Sites of Company
    const siteIDs: string[] = (await global.database.getCollection<{_id: ObjectID}>(tenantID, 'sites')
      .find({ companyID: Utils.convertToObjectID(companyID) })
      .project({ _id: 1 })
      .toArray())
      .map((site) => {
        return site._id.toHexString();
      }
    );
    // Delete all Site Areas
    SiteAreaStorage.deleteSiteAreasFromSites(tenantID, siteIDs);
    // Delete Sites
    SiteStorage.deleteSites(tenantID, siteIDs);
    // Debug
    Logging.traceEnd('SiteStorage', 'deleteCompanySites', uniqueTimerID, { companyID });
  }

  public static async siteExists(tenantID: string, siteID: string): Promise<boolean> {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteStorage', 'deleteCompanySites');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Exec
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
    // Exec
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
