import crypto from 'crypto';
import fs from 'fs';
import Mustache from 'mustache';
import BackendError from '../../exception/BackendError';
import Configuration from '../../utils/Configuration';
import Constants from '../../utils/Constants';
import Database from '../../utils/Database';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import global from '../../types/GlobalType';
import Logging from '../../utils/Logging';
import User from '../../types/User';
import Utils from '../../utils/Utils';
import Eula from '../../types/Eula';
import Tag from '../../types/Tag';
import { ObjectID } from 'bson';
import Site, { SiteUser } from '../../types/Site';

const _centralSystemFrontEndConfig = Configuration.getCentralSystemFrontEndConfig();

export default class UserStorage {

  public static getLatestEndUserLicenseAgreement(language: string = 'en'): string {
    const _centralSystemFrontEndConfig = Configuration.getCentralSystemFrontEndConfig();

    // Debug
    const uniqueTimerID = Logging.traceStart('UserStorage', 'getLatestEndUserLicenseAgreement');

    let eulaText = null;
    try {
      eulaText = fs.readFileSync(`${global.appRoot}/assets/eula/${language}/end-user-agreement.html`, 'utf8');
    } catch (e) {
      eulaText = fs.readFileSync(`${global.appRoot}/assets/eula/en/end-user-agreement.html`, 'utf8');
    }

    // Build Front End URL
    const frontEndURL = _centralSystemFrontEndConfig.protocol + '://' +
      _centralSystemFrontEndConfig.host + ':' + _centralSystemFrontEndConfig.port;
    // Parse the auth and replace values
    eulaText = Mustache.render(
      eulaText,
      {
        'chargeAngelsURL': frontEndURL
      }
    );
    // Debug
    Logging.traceEnd('UserStorage', 'getLatestEndUserLicenseAgreement', uniqueTimerID, { language });
    // Parse
    return eulaText;
  }

  public static async getEndUserLicenseAgreement(tenantID: string, language = 'en'): Promise<Eula> {
    // Debug
    const uniqueTimerID = Logging.traceStart('UserStorage', 'getEndUserLicenseAgreement');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    let languageFound = false;
    let currentEulaHash: string;
    const supportLanguages = Configuration.getLocalesConfig().supported;

    // Search for language
    for (const supportLanguage of supportLanguages) {
      if (language === supportLanguage.substring(0, 2)) {
        languageFound = true;
      }
    }
    if (!languageFound) {
      language = 'en';
    }
    // Get current eula
    const currentEula = await UserStorage.getLatestEndUserLicenseAgreement(language);
    // Read DB
    const eulasMDB = await global.database.getCollection<Eula>(tenantID, 'eulas')
      .find({ 'language': language })
      .sort({ 'version': -1 })
      .limit(1)
      .toArray();
    // Found?
    if (eulasMDB && eulasMDB.length > 0) {
      // Get
      const eulaMDB = eulasMDB[0];
      // Check if eula has changed
      currentEulaHash = crypto.createHash('sha256')
        .update(currentEula)
        .digest('hex');
      if (currentEulaHash !== eulaMDB.hash) {
        // New Version
        let eula = {
          timestamp: new Date(),
          language: eulaMDB.language,
          version: eulaMDB.version + 1,
          text: currentEula,
          hash: currentEulaHash
        };
        // Create
        const result = await global.database.getCollection<Eula>(tenantID, 'eulas')
          .insertOne(eula);
        // Update object
        // Debug
        Logging.traceEnd('UserStorage', 'getEndUserLicenseAgreement', uniqueTimerID, { language });
        // Return
        return eula;
      }
      // Debug
      Logging.traceEnd('UserStorage', 'getEndUserLicenseAgreement', uniqueTimerID, { language });
      return eulaMDB;
    }
    // Create Default
    let eula = {
      timestamp: new Date(),
      language: language,
      version: 1,
      text: currentEula,
      hash: crypto.createHash('sha256').update(currentEula).digest('hex')
    };
    // Create
    await global.database.getCollection<Eula>(tenantID, 'eulas').insertOne(eula);

    // Debug
    Logging.traceEnd('UserStorage', 'getEndUserLicenseAgreement', uniqueTimerID, { language });
    
    // Return
    return eula;
  }

  public static async getUserByTagId(tenantID: string, tagID: string): Promise<User> {
    let user: User;
    // Debug
    const uniqueTimerID = Logging.traceStart('UserStorage', 'getUserByTagId');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const tagsMDB = await global.database.getCollection<Tag>(tenantID, 'tags')
      .aggregate([
        { $match: { '_id': tagID } },
        { $project: {
          id: '$_id',
          _id: 0,
          userID: {$toString: '$userID'}
        } }
      ])
      .limit(1)
      .toArray();
    // Check
    if (tagsMDB && tagsMDB.length > 0) {
      // Ok
      user = await UserStorage.getUser(tenantID, tagsMDB[0].userID);
    }
    // Debug
    Logging.traceEnd('UserStorage', 'getUserByTagId', uniqueTimerID, { tagID });
    return user;
  }

  public static async getUserByEmail(tenantID: string, email: string): Promise<User> {
    // Debug
    const uniqueTimerID = Logging.traceStart('UserStorage', 'getUserByEmail');

    const user = await UserStorage.getUsers(tenantID, {search: email}, {limit: 1, skip: 0});
    //TODO: error handling if no user returned
    
    // Debug
    Logging.traceEnd('UserStorage', 'getUserByEmail', uniqueTimerID, { email });
    return user.count>0 ? user.result[0] : null;
  }

  public static async getUser(tenantID: string, userID: string): Promise<User> {
    // Debug
    const uniqueTimerID = Logging.traceStart('UserStorage', 'getUser');
   
    const user = await UserStorage.getUsers(tenantID, {userID: userID}, {limit: 1, skip: 0});
    
    // Debug
    Logging.traceEnd('UserStorage', 'getUser', uniqueTimerID, { userID });
    
    return user.count>0 ? user.result[0] : null;
  }

  public static async getUserImage(tenantID: string, id: string): Promise<{id: string, image: string}> {
    // Debug
    const uniqueTimerID = Logging.traceStart('UserStorage', 'getUserImage');
    
    const userImages = await this.getUserImages(tenantID, [id]);

    // Debug
    Logging.traceEnd('UserStorage', 'getUserImage', uniqueTimerID, { id });
    
    return userImages?userImages[0]:null;
  }

  public static async getUserImages(tenantID: string, userIDs?:string[]): Promise<{id: string, image: string}[]> {
    // Debug
    const uniqueTimerID = Logging.traceStart('UserStorage', 'getUserImages');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    
    // Build options
    let options: any = {};
    if(userIDs) {
      options._id = { $in: userIDs.map(id => Utils.convertToObjectID(id)) };
    }
    
    // Read DB
    const userImagesMDB = await global.database.getCollection<{_id: string, image: string}>(tenantID, 'userimages')
      .find(options)
      .toArray();
    const userImages = [];

    // Add
    for (const userImageMDB of userImagesMDB) {
      userImages.push({
        id: userImageMDB._id,
        image: userImageMDB.image
      });
    }
    // Debug
    Logging.traceEnd('UserStorage', 'getUserImages', uniqueTimerID);
    return userImages;
  }

  public static async removeSitesFromUser(tenantID: string, userID: string, siteIDs: string[]): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('UserStorage', 'removeSitesFromUser');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // User provided?
    if (userID) {
      // At least one Site
      if (siteIDs && siteIDs.length > 0) {
        // Create the list
        for (const siteID of siteIDs) {
          // Execute
          await global.database.getCollection<any>(tenantID, 'siteusers').deleteMany({
            'userID': Utils.convertToObjectID(userID),
            'siteID': Utils.convertToObjectID(siteID)
          });
        }
      }
    }
    // Debug
    Logging.traceEnd('UserStorage', 'removeSitesFromUser', uniqueTimerID, { userID, siteIDs });
  }

  public static async addSitesToUser(tenantID: string, userID: string, siteIDs: string[]): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('UserStorage', 'addSitesToUser');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // User provided?
    if (userID) {
      // At least one Site
      if (siteIDs && siteIDs.length > 0) {
        const siteUsers = [];
        // Create the list
        for (const siteID of siteIDs) {
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
    Logging.traceEnd('UserStorage', 'addSitesToUser', uniqueTimerID, { userID, siteIDs });
  }

  public static async saveUser(tenantID: string, userToSave: Partial<User>, saveImage: boolean = false): Promise<string> {
    // Debug
    const uniqueTimerID = Logging.traceStart('UserStorage', 'saveUser');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check if ID or email is provided
    if (!userToSave.id && !userToSave.email) {
      // ID must be provided!
      throw new BackendError(
        Constants.CENTRAL_SERVER,
        'User has no ID and no Email',
        'UserStorage', 'saveUser');
    }
    // Build Request
    const userFilter: any = {};
    if (userToSave.id) {
      userFilter._id = Utils.convertToObjectID(userToSave.id);
    } else {
      userFilter.email = userToSave.email;
    }

    // Properties to save
    let userMDB = {
      _id: userToSave.id ? Utils.convertToObjectID(userToSave.id) : new ObjectID(),
      createdBy: userToSave.createdBy ? userToSave.createdBy.id : null,
      lastChangedBy: userToSave.lastChangedBy ? userToSave.lastChangedBy.id : null,
      ...userToSave
    };
    delete userMDB.id;
    delete userMDB.image;
    // Check Created/Last Changed By
    DatabaseUtils.mongoConvertLastChangedCreatedProps(userToSave, userToSave);

    // Modify and return the modified document
    const result = await global.database.getCollection<any>(tenantID, 'users').findOneAndUpdate(
      userFilter,
      { $set: userMDB },
      { upsert: true, returnOriginal: false });

    // Add tags
    if (userToSave.tagIDs) {
      userToSave.tagIDs = userToSave.tagIDs.filter(tid => tid && tid !== '');
      // Delete Tag IDs
      await global.database.getCollection<any>(tenantID, 'tags')
        .deleteMany({ 'userID': userMDB._id });

      if(userToSave.tagIDs.length !== 0) {
        // Insert new Tag IDs
        await global.database.getCollection<any>(tenantID, 'tags')
        .insertMany(userToSave.tagIDs.map(tid => ({_id: tid, userID: userMDB._id}) ));
      }
    }

    if(saveImage) {
      this.saveUserImage(tenantID, { id: userMDB._id.toHexString(), image: userToSave.image });
    }

    // Debug
    Logging.traceEnd('UserStorage', 'saveUser', uniqueTimerID, { userToSave });
    return userMDB._id.toHexString();
  }

  public static async saveUserImage(tenantID: string, userImageToSave: {id: string, image: string}): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('UserStorage', 'saveUserImage');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check if ID is provided
    if (!userImageToSave.id) {
      // ID must be provided!
      throw new BackendError(
        Constants.CENTRAL_SERVER,
        'User Image has no ID',
        'UserStorage', 'saveUserImage');
    }
    // Modify and return the modified document
    await global.database.getCollection<any>(tenantID, 'userimages').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(userImageToSave.id) },
      { $set: { image: userImageToSave.image } },
      { upsert: true, returnOriginal: false });
    // Debug
    Logging.traceEnd('UserStorage', 'saveUserImage', uniqueTimerID, { userImageToSave });
  }

  public static async getUsers(tenantID: string, params: {notificationsActive?: boolean, siteID?: string, excludeSiteID?: string, search?:string, userID?:string,role?:string, statuses?:string[], withImage?:boolean}, {limit, skip, onlyRecordCount, sort}: DbParams) {
    // Debug
    const uniqueTimerID = Logging.traceStart('UserStorage', 'getUsers');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check Limit
    limit = Utils.checkRecordLimit(limit);
    // Check Skip
    skip = Utils.checkRecordSkip(skip);
    const filters: any = {
      '$and': [
        {
          '$or': [
            { 'deleted': { $exists: false } },
            { 'deleted': false },
            { 'deleted': null }
          ]
        }
      ]
    };
    // Source?
    if (params.search) {
      // Build filter
      filters.$and.push({
        '$or': [
          { '_id': { $regex: params.search, $options: 'i' } },
          { 'name': { $regex: params.search, $options: 'i' } },
          { 'firstName': { $regex: params.search, $options: 'i' } },
          { 'tags._id': { $regex: params.search, $options: 'i' } },
          { 'email': { $regex: params.search, $options: 'i' } },
          { 'plateID': { $regex: params.search, $options: 'i' } }
        ]
      });
    }
    // UserID: Used only with SiteID
    if (params.userID) {
      // Build filter
      filters.$and.push({
        'id': params.userID
      });
    }
    if (params.role) {
      filters.$and.push({
        'role': params.role
      });
    }
    if (params.statuses && params.statuses.filter(status => status).length > 0) {
      filters.$and.push({
        'status': { $in: params.statuses }
      });
    }
    if (params.notificationsActive) {
      filters.$and.push({
        'notificationsActive': params.notificationsActive
      });
    }
    // Create Aggregation
    const aggregation = [];
  
    // Add TagIDs
    aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenantID, 'tags'),
        localField: '_id',
        foreignField: 'userID',
        as: 'tagIDs'
      }
    });
    // Project tag IDs
    aggregation.push({
      $addFields: {
        id: { $toString: '$_id' },
        tagIDs: {
          $map: {
            input: '$tagIDs',
            as: 't',
            in: '$$t._id'
          }
        }
      }
    });
    // Filters
    if (filters) {
      aggregation.push({
        $match: filters
      });
    }
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);
    
    // Site ID? or ExcludeSiteID - cannot be used together
    if (params.siteID || params.excludeSiteID) {
      // Add Site
      aggregation.push({
        $lookup: {
          from: DatabaseUtils.getCollectionName(tenantID, 'siteusers'),
          localField: '_id',
          foreignField: 'userID',
          as: 'siteusers'
        }
      });

      // Check which filter to use
      if (params.siteID) {
        aggregation.push({
          $match: { 'siteusers.siteID': Utils.convertToObjectID(params.siteID) }
        });
      } else if (params.excludeSiteID) {
        aggregation.push({
          $match: { 'siteusers.siteID': { $ne: Utils.convertToObjectID(params.excludeSiteID) } }
        });
      }
    }


    // Limit records?
    if (!onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.MAX_DB_RECORD_COUNT });
    }
    // Count Records
    const usersCountMDB = await global.database.getCollection<any>(tenantID, 'users')
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
    // Check if only the total count is requested
    if (onlyRecordCount) {
      // Return only the count
      return {
        count: (usersCountMDB.length > 0 ? usersCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();

    // Sort
    if (sort) {
      // Sort
      aggregation.push({
        $sort: sort
      });
    } else {
      // Default
      aggregation.push({
        $sort: { status: -1, name: 1, firstName: 1 }
      });
    }
    // Skip
    aggregation.push({
      $skip: skip
    });
    // Limit
    aggregation.push({
      $limit: limit
    },
    {
      $project: {
        _id: 0
      }
    });

    // Read DB
    const usersMDB = await global.database.getCollection<User>(tenantID, 'users')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 }, allowDiskUse: true })
      .toArray();

    for(let userMDB of usersMDB) {
      delete (usersMDB as any).siteusers;
    }

    // Debug
    Logging.traceEnd('UserStorage', 'getUsers', uniqueTimerID, { params, limit, skip, sort });
    // Ok
    return {
      count: (usersCountMDB.length > 0 ?
        (usersCountMDB[0].count === Constants.MAX_DB_RECORD_COUNT ? -1 : usersCountMDB[0].count) : 0),
      result: usersMDB
    };
  }

  public static async deleteUser(tenantID: string, id: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('UserStorage', 'deleteUser');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Delete User from sites
    await global.database.getCollection<any>(tenantID, 'siteusers')
      .deleteMany({ 'userID': Utils.convertToObjectID(id) });
    // Delete Image
    await global.database.getCollection<any>(tenantID, 'userimages')
      .findOneAndDelete({ '_id': Utils.convertToObjectID(id) });
    // Delete Tags
    await global.database.getCollection<any>(tenantID, 'tags')
      .deleteMany({ 'userID': Utils.convertToObjectID(id) });
    // Delete User
    await global.database.getCollection<any>(tenantID, 'users')
      .findOneAndDelete({ '_id': Utils.convertToObjectID(id) });
    // Debug
    Logging.traceEnd('UserStorage', 'deleteUser', uniqueTimerID, { id });
  }

  public static async getSites(tenantID: string, params: { userID: string; siteAdmin?: boolean }, dbParams: DbParams): Promise<{count: number; result: SiteUser[]}> {
    // Debug
    const uniqueTimerID = Logging.traceStart('UserStorage', 'getSites');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check Limit
    const limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    const skip = Utils.checkRecordSkip(dbParams.skip);
    // Filter
    const filter: any = {
      userID: Utils.convertToObjectID(params.userID)
    };
    if (params.siteAdmin) {
      filter.siteAdmin = params.siteAdmin;
    }
    // Create Aggregation
    const aggregation: any[] = [];
    // Filter
    aggregation.push({
      $match: filter
    });
    
    // Get Sites
    DatabaseUtils.pushBasicSiteJoinInAggregation(tenantID, aggregation, 'siteID', '_id', 'site', ['userID', 'siteID'], 'none', true);
    
    // Count Records
    const usersCountMDB = await global.database.getCollection<any>(tenantID, 'siteusers')
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
    // Sort
    if (dbParams.sort) {
      aggregation.push({
        $sort: dbParams.sort
      });
    } else {
      aggregation.push({
        $sort: { 'site.name': 1 }
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
    const siteUsersMDB = await global.database.getCollection<{userID: string, siteID: string, siteAdmin: boolean, site: Site}>(tenantID, 'siteusers')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 }, allowDiskUse: true })
      .toArray();
    // Create
    const sites: SiteUser[] = [];
    for (const siteUserMDB of siteUsersMDB) {
      if (siteUserMDB.site) {
        sites.push({siteAdmin: siteUserMDB.siteAdmin, userID: siteUserMDB.userID, site: siteUserMDB.site});
      }
    }

    // Debug
    Logging.traceEnd('UserStorage', 'UserStorage', uniqueTimerID, { userID: params.userID });

    // Ok
    return {
      count: (usersCountMDB.length > 0 ?
        (usersCountMDB[0].count === Constants.MAX_DB_RECORD_COUNT ? -1 : usersCountMDB[0].count) : 0),
      result: sites
    };
  }

  public static getEmptyUser(): User {
    return {
      id: new ObjectID().toHexString(),
      address: null,
      costCenter: '',
      createdBy: null,
      createdOn: new Date(),
      lastChangedBy: null,
      lastChangedOn: new Date(),
      deleted: false,
      email: '',
      eulaAcceptedHash: null,
      eulaAcceptedOn: null,
      eulaAcceptedVersion: 0,
      firstName: 'Unkown',
      name: 'User',
      iNumber: null,
      image: null,
      locale: 'en',
      mobile: '',
      notificationsActive: true,
      password: '',
      passwordBlockedUntil: null,
      passwordResetHash: '',
      passwordWrongNbrTrials: 0,
      phone: '',
      plateID: '',
      role: Constants.ROLE_BASIC,
      status: Constants.USER_STATUS_PENDING,
      tagIDs: [],
      verificationToken: '',
      verifiedAt: null
    }
  }
}
