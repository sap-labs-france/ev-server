import crypto from 'crypto';
import { ObjectID } from 'mongodb';
import BackendError from '../../exception/BackendError';
import ChargingStationStorage from './ChargingStationStorage';
import Constants from '../../utils/Constants';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import global from '../../types/GlobalType';
import Logging from '../../utils/Logging';
import Site from '../../types/Site';
import SiteAreaStorage from './SiteAreaStorage';
import User, { UserSite } from '../../types/User';
import Utils from '../../utils/Utils';

export default class SiteStorage {
  public static async getSite(tenantID: string, id: string): Promise<Site> {
    // Debug
    const uniqueTimerID = Logging.traceStart('SiteStorage', 'getSite');
    // Query single Site
    const sitesMDB = await SiteStorage.getSites(tenantID, {
      siteID: id,
      withCompany: true,
    }, Constants.DB_PARAMS_SINGLE_RECORD);
    // Debug
    Logging.traceEnd('SiteStorage', 'getSite', uniqueTimerID, { id });
    return sitesMDB.count > 0 ? sitesMDB.result[0] : null;
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
        const res = await global.database.getCollection<any>(tenantID, 'siteusers').deleteMany({
          'userID': { $in: userIDs.map((userID) => Utils.convertToObjectID(userID)) },
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
    params: { search?: string; siteID: string},
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
    // Another match for searching on Users
    if (params.search) {
      aggregation.push({
        $match: {
          $or: [
            { 'user.name': { $regex: params.search, $options: 'i' } },
            { 'user.firstName': { $regex: params.search, $options: 'i' } },
            { 'user.email': { $regex: params.search, $options: 'i' } }
          ]
        }
      });
    }
    // Convert IDs to String
    DatabaseUtils.convertObjectIDToString(aggregation, 'userID');
    DatabaseUtils.convertObjectIDToString(aggregation, 'siteID');
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const usersCountMDB = await global.database.getCollection<{count: number}>(tenantID, 'siteusers')
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
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
    const siteUsersMDB = await global.database.getCollection<{user: User; siteID: string; siteAdmin: boolean}>(tenantID, 'siteusers')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 }, allowDiskUse: true })
      .toArray();
    const users: UserSite[] = [];
    // Convert to typed object
    for (const siteUserMDB of siteUsersMDB) {
      if (siteUserMDB.user) {
        users.push({ user: siteUserMDB.user, siteAdmin: !siteUserMDB.siteAdmin ? false : siteUserMDB.siteAdmin, siteID: params.siteID });
      }
    }
    // Debug
    Logging.traceEnd('SiteStorage', 'getUsers', uniqueTimerID, { siteID: params.siteID });
    // Ok
    return {
      count: (usersCountMDB.length > 0 ?
        (usersCountMDB[0].count === Constants.DB_RECORD_COUNT_CEIL ? -1 : usersCountMDB[0].count) : 0),
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
      siteFilter._id = Utils.convertToObjectID(siteToSave.id);
    } else {
      siteFilter._id = new ObjectID();
    }
    // Properties to save
    let siteMDB: any = {
      _id: siteFilter._id,
      address: siteToSave.address,
      companyID: Utils.convertToObjectID(siteToSave.companyID),
      autoUserSiteAssignment: siteToSave.autoUserSiteAssignment,
      name: siteToSave.name,
    };
    // Add Last Changed/Created props
    DatabaseUtils.addLastChangedCreatedProps(siteMDB, siteToSave);
    // Modify and return the modified document
    const result = await global.database.getCollection<any>(tenantID, 'sites').findOneAndUpdate(
      siteFilter,
      { $set: siteMDB },
      { upsert: true }
    );
    if (!result.ok) {
      throw new BackendError(
        Constants.CENTRAL_SERVER,
        'Couldn\'t update Site',
        'SiteStorage', 'saveSite');
    }
    if (saveImage) {
      await SiteStorage.saveSiteImage(tenantID, siteFilter._id.toHexString(), siteToSave.image);
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
      search?: string; companyIDs?: string[]; withAutoUserAssignment?: boolean; siteIDs?: string[];
      userID?: string; excludeSitesOfUserID?: boolean; siteID?: string;
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
    // Create Aggregation
    const aggregation = [];
    // Search filters
    const filters: any = {};
    if (params.siteID) {
      filters._id = Utils.convertToObjectID(params.siteID);
    } else if (params.search) {
      if (ObjectID.isValid(params.search)) {
        filters._id = Utils.convertToObjectID(params.search);
      } else {
        filters.$or = [
          { 'name': { $regex: params.search, $options: 'i' } }
        ];
      }
    }
    // Query by companyIDs
    if (params.companyIDs && Array.isArray(params.companyIDs) && params.companyIDs.length > 0) {
      filters.companyID = {
        $in: params.companyIDs.map((company) => Utils.convertToObjectID(company))
      };
    }
    // Auto User Site Assignment
    if (params.withAutoUserAssignment) {
      filters.autoUserSiteAssignment = true;
    }
    // Limit on Site for Basic Users
    if (params.siteIDs && params.siteIDs.length > 0) {
      aggregation.push({
        $match: {
          _id: { $in: params.siteIDs.map((siteID) => Utils.convertToObjectID(siteID)) }
        }
      });
    }
    // Get users
    if (params.userID || params.excludeSitesOfUserID) {
      DatabaseUtils.pushCollectionLookupInAggregation('siteusers',
        { tenantID, aggregation, localField: '_id', foreignField: 'siteID', asField: 'siteusers' }
      );
      if (params.userID) {
        filters['siteusers.userID'] = Utils.convertToObjectID(params.userID);
      }
      if (params.excludeSitesOfUserID) {
        filters['siteusers.userID'] = { $ne: Utils.convertToObjectID(params.excludeSitesOfUserID) };
      }
    }
    // Set filters
    aggregation.push({
      $match: filters
    });
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const sitesCountMDB = await global.database.getCollection<any>(tenantID, 'sites')
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
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
          // Get the chargers
          const chargingStations = await ChargingStationStorage.getChargingStations(tenantID,
            { siteIDs: [siteMDB.id], includeDeleted: false }, Constants.DB_PARAMS_MAX_LIMIT);
          // Set the Charging Stations' Connector statuses
          siteMDB.connectorStats = Utils.getConnectorStatusesFromChargingStations(chargingStations.result);;
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
        (sitesCountMDB[0].count === Constants.DB_RECORD_COUNT_CEIL ? -1 : sitesCountMDB[0].count) : 0),
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
    await SiteAreaStorage.deleteSiteAreasFromSites(tenantID, ids);
    // Convert
    const cids: ObjectID[] = ids.map((id) => Utils.convertToObjectID(id));
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
      .map((site): string => site._id.toHexString());
    // Delete all Site Areas
    await SiteAreaStorage.deleteSiteAreasFromSites(tenantID, siteIDs);
    // Delete Sites
    await SiteStorage.deleteSites(tenantID, siteIDs);
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
