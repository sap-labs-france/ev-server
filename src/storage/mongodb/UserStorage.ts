import fs from 'fs';
import { ObjectID } from 'mongodb';
import Mustache from 'mustache';
import BackendError from '../../exception/BackendError';
import Configuration from '../../utils/Configuration';
import Constants from '../../utils/Constants';
import Cypher from '../../utils/Cypher';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Eula from '../../types/Eula';
import global from '../../types/GlobalType';
import Logging from '../../utils/Logging';
import Site, { SiteUser } from '../../types/Site';
import Tag from '../../types/Tag';
import TenantStorage from './TenantStorage';
import User from '../../types/User';
import Utils from '../../utils/Utils';

export default class UserStorage {

  public static getLatestEndUserLicenseAgreement(language = 'en'): string {
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
    const currentEula = UserStorage.getLatestEndUserLicenseAgreement(language);
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
      currentEulaHash = Cypher.hash(currentEula);
      if (currentEulaHash !== eulaMDB.hash) {
        // New Version
        const eula = {
          timestamp: new Date(),
          language: eulaMDB.language,
          version: eulaMDB.version + 1,
          text: currentEula,
          hash: currentEulaHash
        };
        // Create
        await global.database.getCollection<Eula>(tenantID, 'eulas')
          .insertOne(eula);
        // Debug
        Logging.traceEnd('UserStorage', 'getEndUserLicenseAgreement', uniqueTimerID, { language });
        return eula;
      }
      // Debug
      Logging.traceEnd('UserStorage', 'getEndUserLicenseAgreement', uniqueTimerID, { language });
      return eulaMDB;
    }
    // Create Default
    const eula = {
      timestamp: new Date(),
      language: language,
      version: 1,
      text: currentEula,
      hash: Cypher.hash(currentEula)
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
          userID: { $toString: '$userID' }
        } }
      ])
      .limit(1)
      .toArray();
    // Check
    if (tagsMDB && tagsMDB.length > 0) {
      user = await UserStorage.getUser(tenantID, tagsMDB[0].userID);
    }
    // Debug
    Logging.traceEnd('UserStorage', 'getUserByTagId', uniqueTimerID, { tagID });
    return user;
  }

  public static async getUserByEmail(tenantID: string, email: string): Promise<User> {
    // Debug
    const uniqueTimerID = Logging.traceStart('UserStorage', 'getUserByEmail');
    // Get user
    const user = await UserStorage.getUsers(tenantID, { email: email }, Constants.DB_PARAMS_SINGLE_RECORD);
    // Debug
    Logging.traceEnd('UserStorage', 'getUserByEmail', uniqueTimerID, { email });
    return user.count > 0 ? user.result[0] : null;
  }

  public static async getUser(tenantID: string, id: string): Promise<User> {
    // Debug
    const uniqueTimerID = Logging.traceStart('UserStorage', 'getUser');
    // Get user
    const user = await UserStorage.getUsers(tenantID, { userID: id }, Constants.DB_PARAMS_SINGLE_RECORD);
    // Debug
    Logging.traceEnd('UserStorage', 'getUser', uniqueTimerID, { id });
    return user.count > 0 ? user.result[0] : null;
  }

  public static async getUserImage(tenantID: string, id: string): Promise<{id: string; image: string}> {
    // Debug
    const uniqueTimerID = Logging.traceStart('UserStorage', 'getUserImage');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const userImageMDB = await global.database.getCollection<{_id: string; image: string}>(tenantID, 'userimages')
      .findOne({ _id: id });
    // Debug
    Logging.traceEnd('UserStorage', 'getUserImage', uniqueTimerID, { id });
    return { id: id, image: (userImageMDB ? userImageMDB.image : null) };
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
        // Create the lis
        await global.database.getCollection<any>(tenantID, 'siteusers').deleteMany({
          'userID': Utils.convertToObjectID(userID),
          'siteID': { $in: siteIDs.map((siteID) => Utils.convertToObjectID(siteID)) }
        });
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
            '_id': Cypher.hash(`${siteID}~${userID}`),
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

  public static async saveUser(tenantID: string, userToSave: Partial<User>, saveImage = false): Promise<string> {
    // Debug
    const uniqueTimerID = Logging.traceStart('UserStorage', 'saveUser');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check if ID or email is provided
    if (!userToSave.id && !userToSave.email) {
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
    // eslint-disable-next-line prefer-const
    let userMDB = {
      _id: userToSave.id ? Utils.convertToObjectID(userToSave.id) : new ObjectID(),
      name: userToSave.name,
      firstName: userToSave.firstName,
      email: userToSave.email,
      phone: userToSave.phone,
      mobile: userToSave.mobile,
      locale: userToSave.locale,
      address: userToSave.address,
      iNumber: userToSave.iNumber,
      costCenter: userToSave.costCenter,
      deleted: userToSave.hasOwnProperty('deleted') ? userToSave.deleted : false
    };
    // Check Created/Last Changed By
    DatabaseUtils.addLastChangedCreatedProps(userMDB, userToSave);
    // Modify and return the modified document
    await global.database.getCollection<any>(tenantID, 'users').findOneAndUpdate(
      userFilter,
      { $set: userMDB },
      { upsert: true, returnOriginal: false });
    // Delegate saving image as well if specified
    if (saveImage) {
      await UserStorage.saveUserImage(tenantID, { id: userMDB._id.toHexString(), image: userToSave.image });
    }
    // Debug
    Logging.traceEnd('UserStorage', 'saveUser', uniqueTimerID, { userToSave });
    return userMDB._id.toHexString();
  }

  public static async saveUserTags(tenantID: string, userID: string, userTagIDs: string[]): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('UserStorage', 'saveUserTags');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Cleanup Tags
    const userTagIDsToSave = userTagIDs.filter((tagID) => tagID && tagID !== '');
    // Delete former Tag IDs
    await global.database.getCollection<any>(tenantID, 'tags')
      .deleteMany({ 'userID': Utils.convertToObjectID(userID) });
    // Add new ones
    const uniqueUserTagIDsToSave = [...new Set(userTagIDsToSave)];
    if (uniqueUserTagIDsToSave.length > 0) {
      await global.database.getCollection<any>(tenantID, 'tags')
        .insertMany(uniqueUserTagIDsToSave.map((userTagIDToSave) => ({ _id: userTagIDToSave, userID: Utils.convertToObjectID(userID) })));
    }
    // Debug
    Logging.traceEnd('UserStorage', 'saveUserTags', uniqueTimerID, { id: userID, tags: userTagIDs });
  }

  public static async saveUserPassword(tenantID: string, userID: string,
    params: { password?: string; passwordResetHash?: string; passwordWrongNbrTrials?: number;
      passwordBlockedUntil?: Date; }): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('UserStorage', 'saveUserPassword');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Modify and return the modified document
    await global.database.getCollection<any>(tenantID, 'users').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(userID) },
      { $set: params });
    // Debug
    Logging.traceEnd('UserStorage', 'saveUserPassword', uniqueTimerID);
  }

  public static async saveUserStatus(tenantID: string, userID: string, status: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('UserStorage', 'saveUserStatus');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Modify and return the modified document
    await global.database.getCollection<any>(tenantID, 'users').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(userID) },
      { $set: { status } });
    // Debug
    Logging.traceEnd('UserStorage', 'saveUserStatus', uniqueTimerID);
  }

  public static async saveUserRole(tenantID: string, userID: string, role: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('UserStorage', 'saveUserRole');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Modify and return the modified document
    await global.database.getCollection<any>(tenantID, 'users').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(userID) },
      { $set: { role } });
    // Debug
    Logging.traceEnd('UserStorage', 'saveUserRole', uniqueTimerID);
  }

  public static async saveUserEULA(tenantID: string, userID: string,
    params: { eulaAcceptedHash: string; eulaAcceptedOn: Date; eulaAcceptedVersion: number }): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('UserStorage', 'saveUserRole');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Modify and return the modified document
    await global.database.getCollection<any>(tenantID, 'users').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(userID) },
      { $set: params });
    // Debug
    Logging.traceEnd('UserStorage', 'saveUserRole', uniqueTimerID);
  }

  public static async saveUserAccountVerification(tenantID: string, userID: string,
    params: { verificationToken?: string; verifiedAt?: Date }): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('UserStorage', 'saveUserAccountVerification');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Modify and return the modified document
    await global.database.getCollection<any>(tenantID, 'users').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(userID) },
      { $set: params });
    // Debug
    Logging.traceEnd('UserStorage', 'saveUserAccountVerification', uniqueTimerID);
  }

  public static async saveUserAdminData(tenantID: string, userID: string,
    params: { plateID?: string; notificationsActive?: boolean }): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('UserStorage', 'saveUserAdminData');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Set data
    const updatedUserMDB: any = {};
    // Set only provided values
    if (params.plateID) {
      updatedUserMDB.plateID = params.plateID;
    }
    if (params.hasOwnProperty('notificationsActive')) {
      updatedUserMDB.notificationsActive = params.notificationsActive;
    }
    // Modify and return the modified document
    await global.database.getCollection<any>(tenantID, 'users').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(userID) },
      { $set: updatedUserMDB });
    // Debug
    Logging.traceEnd('UserStorage', 'saveUserAdminData', uniqueTimerID);
  }

  public static async saveUserImage(tenantID: string, userImageToSave: {id: string; image: string}): Promise<void> {
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

  public static async getUsers(tenantID: string,
    params: {notificationsActive?: boolean; siteIDs?: string[]; excludeSiteID?: string; search?: string; userID?: string; email?: string;
      roles?: string[]; statuses?: string[]; withImage?: boolean; },
    { limit, skip, onlyRecordCount, sort }: DbParams, projectFields?: string[]) {
    // Debug
    const uniqueTimerID = Logging.traceStart('UserStorage', 'getUsers');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check Limit
    limit = Utils.checkRecordLimit(limit);
    // Check Skip
    skip = Utils.checkRecordSkip(skip);
    const filters: any = {
      '$and': [{
        '$or': DatabaseUtils.getNotDeletedFilter()
      }]
    };
    // Filter by ID
    if (params.userID) {
      filters.$and.push({ _id: Utils.convertToObjectID(params.userID) });
    // Filter by other properties
    } else if (params.search) {
      // Search is an ID?
      if (ObjectID.isValid(params.search)) {
        filters.$and.push({ _id: Utils.convertToObjectID(params.search) });
      } else {
        filters.$and.push({
          '$or': [
            { 'name': { $regex: params.search, $options: 'i' } },
            { 'firstName': { $regex: params.search, $options: 'i' } },
            { 'tagIDs': { $regex: params.search, $options: 'i' } },
            { 'email': { $regex: params.search, $options: 'i' } },
            { 'plateID': { $regex: params.search, $options: 'i' } }
          ]
        });
      }
    }
    // Email
    if (params.email) {
      filters.$and.push({
        'email': params.email
      });
    }
    // Role
    if (params.roles && Array.isArray(params.roles) && params.roles.length > 0) {
      filters.role = { $in: params.roles };
    }
    // Status (Previously getUsersInError)
    if (params.statuses && Array.isArray(params.statuses) && params.statuses.length > 0) {
      filters.status = { $in: params.statuses };
    }
    // Notification
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
    // Add Site
    if (params.siteIDs || params.excludeSiteID) {
      DatabaseUtils.pushSiteUserLookupInAggregation({
        tenantID, aggregation, localField: '_id', foreignField: 'userID',
        asField: 'siteusers'
      });
      if (params.siteIDs) {
        aggregation.push({
          $match: {
            'siteusers.siteID': {
              $in: params.siteIDs.map((site) => Utils.convertToObjectID(site))
            }
          }
        });
      } else if (params.excludeSiteID) {
        aggregation.push({
          $match: { 'siteusers.siteID': { $ne: Utils.convertToObjectID(params.excludeSiteID) } }
        });
      }
    }
    // Change ID
    DatabaseUtils.renameDatabaseID(aggregation);
    // Limit records?
    if (!onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
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
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);
    // Sort
    if (sort) {
      aggregation.push({
        $sort: sort
      });
    } else {
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
    });
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const usersMDB = await global.database.getCollection<User>(tenantID, 'users')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 }, allowDiskUse: true })
      .toArray();
    // Clean user object
    for (const userMDB of usersMDB) {
      delete (userMDB as any).siteusers;
    }
    // Debug
    Logging.traceEnd('UserStorage', 'getUsers', uniqueTimerID, { params, limit, skip, sort });
    // Ok
    return {
      count: (usersCountMDB.length > 0 ?
        (usersCountMDB[0].count === Constants.DB_RECORD_COUNT_CEIL ? -1 : usersCountMDB[0].count) : 0),
      result: usersMDB
    };
  }

  public static async getUsersInError(tenantID: string,
    params: {search?: string; roles?: string[]; errorTypes?: string[]},
    { limit, skip, onlyRecordCount, sort }: DbParams) {
    // Debug
    const uniqueTimerID = Logging.traceStart('UserStorage', 'getUsers');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check Limit
    limit = Utils.checkRecordLimit(limit);
    // Check Skip
    skip = Utils.checkRecordSkip(skip);
    // Mongodb pipeline creation
    const pipeline = [];
    // Mongodb filter block ($match)
    const match: any = { '$and': [{ '$or': DatabaseUtils.getNotDeletedFilter() }] };
    if (params.roles) {
      match.$and.push({ role: { '$in': params.roles } });
    }
    if (params.search) {
      // Search is an ID?
      if (ObjectID.isValid(params.search)) {
        match.$and.push({ _id: Utils.convertToObjectID(params.search) });
      } else {
        match.$and.push({
          '$or': [
            { 'name': { $regex: params.search, $options: 'i' } },
            { 'firstName': { $regex: params.search, $options: 'i' } },
            { 'tagIDs': { $regex: params.search, $options: 'i' } },
            { 'email': { $regex: params.search, $options: 'i' } },
            { 'plateID': { $regex: params.search, $options: 'i' } }
          ]
        });
      }
    }
    pipeline.push({ $match: match });
    // Mongodb Lookup block
    // Add TagIDs
    pipeline.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenantID, 'tags'),
        localField: '_id',
        foreignField: 'userID',
        as: 'tagIDs'
      }
    });
    // Mongodb adding common fields
    pipeline.push({
      $addFields: {
        tagIDs: {
          $map: {
            input: '$tagIDs',
            as: 't',
            in: '$$t._id'
          }
        }
      }
    });
    // Mongodb facets block
    // If the organization component is active the system looks for non active users or active users that
    // are not assigned yet to at least one site.
    // If the organization component is not active then the system just looks for non active users.
    const facets: any = { $facet: {} };
    if (Utils.isTenantComponentActive(await TenantStorage.getTenant(tenantID), Constants.COMPONENTS.ORGANIZATION)) {
      const array = [];
      params.errorTypes.forEach((type) => {
        array.push(`$${type}`);
        facets.$facet[type] = UserStorage._buildUserInErrorFacet(tenantID, type);
      });
      pipeline.push(facets);
      // Manipulate the results to convert it to an array of document on root level
      pipeline.push({ $project: { usersInError: { $setUnion: array } } });
    } else {
      pipeline.push({
        '$facet': {
          'unactive_user': [
            { $match: { status: { $in: [Constants.USER_STATUS_BLOCKED, Constants.USER_STATUS_INACTIVE, Constants.USER_STATUS_LOCKED, Constants.USER_STATUS_PENDING] } } },
            { $addFields : { 'errorCode' : 'unactive_user' } },
          ]
        }
      });
      // Take out the facet name from the result
      pipeline.push({ $project: { usersInError: { $setUnion: ['$unactive_user'] } } });
    }
    // Finish the preparation of the result
    pipeline.push({ $unwind: '$usersInError' });
    pipeline.push({ $replaceRoot: { newRoot: '$usersInError' } });
    // Change ID
    DatabaseUtils.renameDatabaseID(pipeline);
    // Count Records
    const usersCountMDB = await global.database.getCollection<any>(tenantID, 'users')
      .aggregate([...pipeline, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
    // Check if only the total count is requested
    if (onlyRecordCount) {
      // Return only the count
      return {
        count: (usersCountMDB.length > 0 ? usersCountMDB[0].count : 0),
        result: []
      };
    }
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, pipeline);
    // Mongodb sort, skip and limit block
    if (sort) {
      pipeline.push({
        $sort: sort
      });
    } else {
      pipeline.push({
        $sort: { status: -1, name: 1, firstName: 1 }
      });
    }
    // Skip
    pipeline.push({
      $skip: skip
    });
    // Limit
    pipeline.push({
      $limit: limit
    });
    // Read DB
    const usersMDB = await global.database.getCollection<User>(tenantID, 'users')
      .aggregate(pipeline, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 }, allowDiskUse: false })
      .toArray();
    // Clean user object
    for (const userMDB of usersMDB) {
      delete (userMDB as any).siteusers;
      delete (userMDB as any).sites;
    }
    // Debug
    Logging.traceEnd('UserStorage', 'getUsers', uniqueTimerID, { params, limit, skip, sort });
    // Ok
    return {
      count: (usersCountMDB.length > 0 ?
        (usersCountMDB[0].count === Constants.DB_RECORD_COUNT_CEIL ? -1 : usersCountMDB[0].count) : 0),
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

  public static async getSites(tenantID: string,
    params: { search?: string; userID: string; siteAdmin?: boolean },
    dbParams: DbParams, projectFields?: string[]): Promise<{count: number; result: SiteUser[]}> {
    // Debug
    const uniqueTimerID = Logging.traceStart('UserStorage', 'getSites');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check Limit
    const limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    const skip = Utils.checkRecordSkip(dbParams.skip);
    // Set the filters
    const filters: any = {};
    // Filter
    if (params.userID) {
      filters.userID = Utils.convertToObjectID(params.userID);
    }
    if (params.siteAdmin) {
      filters.siteAdmin = params.siteAdmin;
    }
    // Create Aggregation
    const aggregation: any[] = [];
    // Filter
    aggregation.push({
      $match: filters
    });
    // Get Sites
    DatabaseUtils.pushSiteLookupInAggregation(
      { tenantID, aggregation, localField: 'siteID', foreignField: '_id',
        asField: 'site', oneToOneCardinality: true, oneToOneCardinalityNotNull: true });
    // Another match for searching on Sites
    if (params.search) {
      aggregation.push({
        $match: {
          $or: [
            { 'site.name': { $regex: params.search, $options: 'i' } }
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
    const sitesCountMDB = await global.database.getCollection<any>(tenantID, 'siteusers')
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
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const siteUsersMDB = await global.database.getCollection<{userID: string; siteID: string; siteAdmin: boolean; site: Site}>(tenantID, 'siteusers')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 }, allowDiskUse: true })
      .toArray();
    // Create
    const sites: SiteUser[] = [];
    for (const siteUserMDB of siteUsersMDB) {
      if (siteUserMDB.site) {
        sites.push({ siteAdmin: siteUserMDB.siteAdmin, userID: siteUserMDB.userID, site: siteUserMDB.site });
      }
    }
    // Debug
    Logging.traceEnd('UserStorage', 'UserStorage', uniqueTimerID, { userID: params.userID });
    // Ok
    return {
      count: (sitesCountMDB.length > 0 ?
        (sitesCountMDB[0].count === Constants.DB_RECORD_COUNT_CEIL ? -1 : sitesCountMDB[0].count) : 0),
      result: sites
    };
  }

  // Alternative system of registering new users by badging should be found - for now, an empty user is created and saved.
  public static getEmptyUser(): Partial<User> {
    return {
      id: new ObjectID().toHexString(),
      name: 'Unknown',
      firstName: 'User',
      email: '',
      address: null,
      createdBy: null,
      createdOn: new Date(),
      locale: 'en',
      notificationsActive: true,
      role: Constants.ROLE_BASIC,
      status: Constants.USER_STATUS_PENDING,
      tagIDs: []
    };
  }

  private static _buildUserInErrorFacet(tenantID: string, errorType: string) {
    switch (errorType) {
      case 'unactive_user':
        return [
          { $match: { status: { $in: [Constants.USER_STATUS_BLOCKED, Constants.USER_STATUS_INACTIVE, Constants.USER_STATUS_LOCKED, Constants.USER_STATUS_PENDING] } } },
          { $addFields : { 'errorCode' : 'unactive_user' } }
        ];
      case 'unassigned_user': {
        return [
          { $match : { status: Constants.USER_STATUS_ACTIVE } },
          {
            $lookup : {
              from : DatabaseUtils.getCollectionName(tenantID, 'siteusers'),
              localField : '_id',
              foreignField : 'userID',
              as : 'sites'
            }
          },
          { $match : { sites: { $size: 0 } } },
          { $addFields : { 'errorCode' : 'unassigned_user' } }
        ];
      }
      default:
        return [];
    }
  }
}
