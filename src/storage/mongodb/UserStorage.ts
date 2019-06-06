import crypto from 'crypto';
import Mustache from 'mustache';
import Constants from '../../utils/Constants';
import Database from '../../utils/Database';
import Configuration from '../../utils/Configuration';
import Utils from '../../utils/Utils';
import BackendError from '../../exception/BackendError';
import DatabaseUtils from './DatabaseUtils';
import Logging from '../../utils/Logging';
import fs from 'fs';
import TSGlobal from '../../types/GlobalType';
declare var global: TSGlobal;
import User from '../../entity/User';

const _centralSystemFrontEndConfig = Configuration.getCentralSystemFrontEndConfig();
export default class UserStorage {
  static getLatestEndUserLicenseAgreement(language = 'en') {
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

  static async getEndUserLicenseAgreement(tenantID, language = "en") {
    // Debug
    const uniqueTimerID = Logging.traceStart('UserStorage', 'getEndUserLicenseAgreement');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    let languageFound = false;
    let currentEulaHash;
    let eula = null;
    const supportLanguages = Configuration.getLocalesConfig().supported;

    // Search for language
    for (const supportLanguage of supportLanguages) {
      if (language === supportLanguage.substring(0, 2)) {
        languageFound = true;
      }
    }
    if (!languageFound) {
      language = "en";
    }
    // Get current eula
    const currentEula = await UserStorage.getLatestEndUserLicenseAgreement(/*tenantID, TODO ?*/language);
    // Read DB
    const eulasMDB = await global.database.getCollection(tenantID, 'eulas')
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
        .digest("hex");
      if (currentEulaHash != eulaMDB.hash) {
        // New Version
        eula = {};
        eula.timestamp = new Date();
        eula.language = eulaMDB.language;
        eula.version = eulaMDB.version + 1;
        eula.text = currentEula;
        eula.hash = currentEulaHash;
        // Create
        const result = await global.database.getCollection(tenantID, 'eulas')
          .insertOne(eula);
        // Update object
        eula = {};
        Database.updateEula(result.ops[0], eula);
        // Debug
        Logging.traceEnd('UserStorage', 'getEndUserLicenseAgreement', uniqueTimerID, { language });
        // Return
        return eula;
      } else {
        // Ok: Transfer
        eula = {};
        Database.updateEula(eulaMDB, eula);
        // Debug
        Logging.traceEnd('UserStorage', 'getEndUserLicenseAgreement', uniqueTimerID, { language });
        return eula;
      }
    } else {
      // Create Default
      eula = {};
      eula.timestamp = new Date();
      eula.language = language;
      eula.version = 1;
      eula.text = currentEula;
      eula.hash = crypto.createHash('sha256')
        .update(currentEula)
        .digest("hex");
      // Create
      const result = await global.database.getCollection(tenantID, 'eulas').insertOne(eula);
      // Update object
      eula = {};
      Database.updateEula(result.ops[0], eula);
      // Debug
      Logging.traceEnd('UserStorage', 'getEndUserLicenseAgreement', uniqueTimerID, { language });
      // Return
      return eula;
    }
  }

  static async getUserByTagId(tenantID, tagID) {
    let user;
    // Debug
    const uniqueTimerID = Logging.traceStart('UserStorage', 'getUserByTagId');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const tagsMDB = await global.database.getCollection(tenantID, 'tags')
      .find({ '_id': tagID })
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

  static async getUserByEmail(tenantID, email) {
    let user;
    // Debug
    const uniqueTimerID = Logging.traceStart('UserStorage', 'getUserByEmail');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const usersMDB = await global.database.getCollection(tenantID, 'users')
      .find({ 'email': email })
      .limit(1)
      .toArray();
    // Check deleted
    if (usersMDB && usersMDB.length > 0) {
      // Ok
      user = await UserStorage._createUser(tenantID, usersMDB[0]);
    }
    // Debug
    Logging.traceEnd('UserStorage', 'getUserByEmail', uniqueTimerID, { email });
    return user;
  }

  static async getUser(tenantID, id) {
    let user;
    // Debug
    const uniqueTimerID = Logging.traceStart('UserStorage', 'getUser');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: { '_id': Utils.convertToObjectID(id) }
    });
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);
    // Read DB
    const usersMDB = await global.database.getCollection(tenantID, 'users')
      .aggregate(aggregation)
      .limit(1)
      .toArray();
    // Check deleted
    if (usersMDB && usersMDB.length > 0) {
      // Ok
      user = await UserStorage._createUser(tenantID, usersMDB[0]);
    }
    // Debug
    Logging.traceEnd('UserStorage', 'getUser', uniqueTimerID, { id });
    return user;
  }

  static async getUserImage(tenantID, id) {
    // Debug
    const uniqueTimerID = Logging.traceStart('UserStorage', 'getUserImage');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const userImagesMDB = await global.database.getCollection(tenantID, 'userimages')
      .find({ '_id': Utils.convertToObjectID(id) })
      .limit(1)
      .toArray();
    let userImage = null;
    // Check
    if (userImagesMDB && userImagesMDB.length > 0) {
      // Set
      userImage = {
        id: userImagesMDB[0]._id,
        image: userImagesMDB[0].image
      };
    }
    // Debug
    Logging.traceEnd('UserStorage', 'getUserImage', uniqueTimerID, { id });
    return userImage;
  }

  static async getUserImages(tenantID) {
    // Debug
    const uniqueTimerID = Logging.traceStart('UserStorage', 'getUserImages');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const userImagesMDB = await global.database.getCollection(tenantID, 'userimages')
      .find({})
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

  static async removeSitesFromUser(tenantID, userID, siteIDs) {
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
          await global.database.getCollection(tenantID, 'siteusers').deleteMany({
            "userID": Utils.convertToObjectID(userID),
            "siteID": Utils.convertToObjectID(siteID)
          });
        }
      }
    }
    // Debug
    Logging.traceEnd('UserStorage', 'removeSitesFromUser', uniqueTimerID, { userID, siteIDs });
  }

  static async addSitesToUser(tenantID, userID, siteIDs) {
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
            "userID": Utils.convertToObjectID(userID),
            "siteID": Utils.convertToObjectID(siteID)
          });
        }
        // Execute
        await global.database.getCollection(tenantID, 'siteusers').insertMany(siteUsers);
      }
    }
    // Debug
    Logging.traceEnd('UserStorage', 'addSitesToUser', uniqueTimerID, { userID, siteIDs });
  }

  static async saveUser(tenantID, userToSave) {
    // Debug
    const uniqueTimerID = Logging.traceStart('UserStorage', 'saveUser');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check if ID or email is provided
    if (!userToSave.id && !userToSave.email) {
      // ID must be provided!
      throw new BackendError(
        Constants.CENTRAL_SERVER,
        `User has no ID and no Email`,
        "UserStorage", "saveUser");
    }
    // Build Request
    const userFilter:any = {};
    if (userToSave.id) {
      userFilter._id = Utils.convertToObjectID(userToSave.id);
    } else {
      userFilter.email = userToSave.email;
    }
    // Check Created/Last Changed By
    userToSave.createdBy = Utils.convertUserToObjectID(userToSave.createdBy);
    userToSave.lastChangedBy = Utils.convertUserToObjectID(userToSave.lastChangedBy);
    // Transfer
    const user:any = {};
    Database.updateUser(userToSave, user, false);
    // Modify and return the modified document
    const result = await global.database.getCollection(tenantID, 'users').findOneAndUpdate(
      userFilter,
      { $set: user },
      { upsert: true, returnOriginal: false });
    // Create
    const updatedUser = new User(tenantID, result.value);
    // Add tags
    if (userToSave.hasOwnProperty("tagIDs")) {
      // Delete Tag IDs
      await global.database.getCollection(tenantID, 'tags')
        .deleteMany({ 'userID': Utils.convertToObjectID(updatedUser.getID()) });
      // At least one tag
      if (userToSave.tagIDs.length > 0) {
        // Create the list
        for (const tagID of userToSave.tagIDs) {
          if (!tagID || tagID === "") {
            continue;
          }
          // Modify
          await global.database.getCollection(tenantID, 'tags').findOneAndUpdate(
            { '_id': tagID },
            { $set: { 'userID': Utils.convertToObjectID(updatedUser.getID()) } },
            { upsert: true, returnOriginal: false });
        }
      }
    }
    
    // Debug
    Logging.traceEnd('UserStorage', 'saveUser', uniqueTimerID, { userToSave });
    return updatedUser;
  }

  static async saveUserImage(tenantID, userImageToSave) {
    // Debug
    const uniqueTimerID = Logging.traceStart('UserStorage', 'saveUserImage');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check if ID is provided
    if (!userImageToSave.id) {
      // ID must be provided!
      throw new BackendError(
        Constants.CENTRAL_SERVER,
        `User Image has no ID`,
        "UserStorage", "saveUserImage");
    }
    // Modify and return the modified document
    await global.database.getCollection(tenantID, 'userimages').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(userImageToSave.id) },
      { $set: { image: userImageToSave.image } },
      { upsert: true, returnOriginal: false });
    // Debug
    Logging.traceEnd('UserStorage', 'saveUserImage', uniqueTimerID, { userImageToSave });
  }

  static async getUsers(tenantID, params: any = {}, limit?, skip?, sort?) {
    // Debug
    const uniqueTimerID = Logging.traceStart('UserStorage', 'getUsers');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check Limit
    limit = Utils.checkRecordLimit(limit);
    // Check Skip
    skip = Utils.checkRecordSkip(skip);
    const filters: any = {
      "$and": [
        {
          "$or": [
            { "deleted": { $exists: false } },
            { "deleted": false },
            { "deleted": null }
          ]
        }
      ]
    };
    // Source?
    if (params.search) {
      // Build filter
      filters.$and.push({
        "$or": [
          { "_id": { $regex: params.search, $options: 'i' } },
          { "name": { $regex: params.search, $options: 'i' } },
          { "firstName": { $regex: params.search, $options: 'i' } },
          { "tags._id": { $regex: params.search, $options: 'i' } },
          { "email": { $regex: params.search, $options: 'i' } },
          { "plateID": { $regex: params.search, $options: 'i' } }
        ]
      });
    }
    // UserID: Used only with SiteID
    if (params.userID) {
      // Build filter
      filters.$and.push({
        '_id': Utils.convertToObjectID(params.userID)
      });
    }
    if (params.role) {
      filters.$and.push({
        'role': params.role
      });
    }
    if (params.status) {
      filters.$and.push({
        'status': params.status
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
        from: DatabaseUtils.getCollectionName(tenantID, "tags"),
        localField: "_id",
        foreignField: "userID",
        as: "tags"
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
          from: DatabaseUtils.getCollectionName(tenantID, "siteusers"),
          localField: "_id",
          foreignField: "userID",
          as: "siteusers"
        }
      });

      // check which filter to use
      if (params.siteID) {
        aggregation.push({
          $match: { "siteusers.siteID": Utils.convertToObjectID(params.siteID) }
        });
      } else if (params.excludeSiteID) {
        aggregation.push({
          $match: { "siteusers.siteID": { $ne: Utils.convertToObjectID(params.excludeSiteID) } }
        });
      }
    }
    // Limit records?
    if (!params.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.MAX_DB_RECORD_COUNT });
    }
    // Count Records
    const usersCountMDB = await global.database.getCollection(tenantID, 'users')
      .aggregate([...aggregation, { $count: "count" }])
      .toArray();
    // Check if only the total count is requested
    if (params.onlyRecordCount) {
      // Return only the count
      return {
        count: (usersCountMDB.length > 0 ? usersCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Project
    aggregation.push({
      "$project": {
        "_id": 1,
        "name": 1,
        "firstName": 1,
        "email": 1,
        "status": 1,
        "role": 1,
        "createdOn": 1,
        "createdBy": 1,
        "lastChangedOn": 1,
        "lastChangedBy": 1,
        "eulaAcceptedOn": 1,
        "eulaAcceptedVersion": 1,
        "tags": 1,
        "plateID": 1,
        "notificationsActive":1
      }
    });
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
    });
    // Read DB
    const usersMDB = await global.database.getCollection(tenantID, 'users')
      .aggregate(aggregation, { collation: { locale: "en_US", strength: 2 } })
      .toArray();
    const users = [];
    // Create
    for (const userMDB of usersMDB) {
      // Create
      const user = new User(tenantID, userMDB);
      // Set
      user.setTagIDs(userMDB.tags.map((tag) => {
        return tag._id;
      }));
      // Add
      users.push(user);
    }
    // Debug
    Logging.traceEnd('UserStorage', 'getUsers', uniqueTimerID, { params, limit, skip, sort });
    // Ok
    return {
      count: (usersCountMDB.length > 0 ?
        (usersCountMDB[0].count === Constants.MAX_DB_RECORD_COUNT ? -1 : usersCountMDB[0].count) : 0),
      result: users
    };
  }

  static async getUsersInError(tenantID, params: any = {}, limit?, skip?, sort?) {
    // Debug
    const uniqueTimerID = Logging.traceStart('UserStorage', 'getUsers');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check Limit
    limit = Utils.checkRecordLimit(limit);
    // Check Skip
    skip = Utils.checkRecordSkip(skip);
    const filters: any = {
      "$and": [
        {
          "$or": [
            { "deleted": { $exists: false } },
            { "deleted": false },
            { "deleted": null }
          ]
        }
      ]
    };
    // Source?
    if (params.search) {
      // Build filter
      filters.$and.push({
        "$or": [
          { "_id": { $regex: params.search, $options: 'i' } },
          { "name": { $regex: params.search, $options: 'i' } },
          { "firstName": { $regex: params.search, $options: 'i' } },
          { "tags._id": { $regex: params.search, $options: 'i' } },
          { "email": { $regex: params.search, $options: 'i' } }
        ]
      });
    }
    // UserID: Used only with SiteID
    if (params.userID) {
      // Build filter
      filters.$and.push({
        '_id': Utils.convertToObjectID(params.userID)
      });
    }

    if (params.role) {
      filters.$and.push({
        'role': params.role
      });
    }

    filters.$and.push({
      'status': { $in: [Constants.USER_STATUS_BLOCKED, Constants.USER_STATUS_INACTIVE, Constants.USER_STATUS_LOCKED, Constants.USER_STATUS_PENDING] }
    });

    // Create Aggregation
    const aggregation = [];
    // Add TagIDs
    aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenantID, "tags"),
        localField: "_id",
        foreignField: "userID",
        as: "tags"
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
    // Site ID?
    if (params.siteID) {
      // Add Site
      aggregation.push({
        $lookup: {
          from: DatabaseUtils.getCollectionName(tenantID, "siteusers"),
          localField: "_id",
          foreignField: "userID",
          as: "siteusers"
        }
      });
      aggregation.push({
        $match: { "siteusers.siteID": Utils.convertToObjectID(params.siteID) }
      });
    }
    // Limit records?
    if (!params.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.MAX_DB_RECORD_COUNT });
    }
    // Count Records
    const usersCountMDB = await global.database.getCollection(tenantID, 'users')
      .aggregate([...aggregation, { $count: "count" }])
      .toArray();
    // Check if only the total count is requested
    if (params.onlyRecordCount) {
      // Return only the count
      return {
        count: (usersCountMDB.length > 0 ? usersCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Project
    aggregation.push({
      "$project": {
        "_id": 1,
        "name": 1,
        "firstName": 1,
        "email": 1,
        "status": 1,
        "role": 1,
        "createdOn": 1,
        "createdBy": 1,
        "lastChangedOn": 1,
        "lastChangedBy": 1,
        "eulaAcceptedOn": 1,
        "eulaAcceptedVersion": 1,
        "tags": 1
      }
    });
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
    });
    // Read DB
    const usersMDB = await global.database.getCollection(tenantID, 'users')
      .aggregate(aggregation, { collation: { locale: "en_US", strength: 2 } })
      .toArray();
    const users = [];
    // Create
    for (const userMDB of usersMDB) {
      // Create
      const user = new User(tenantID, userMDB);
      // Set
      user.setTagIDs(userMDB.tags.map((tag) => {
        return tag._id;
      }));
      // Add
      users.push(user);
    }
    // Debug
    Logging.traceEnd('UserStorage', 'getUsers', uniqueTimerID, { params, limit, skip, sort });
    // Ok
    return {
      count: (usersCountMDB.length > 0 ?
        (usersCountMDB[0].count === Constants.MAX_DB_RECORD_COUNT ? -1 : usersCountMDB[0].count) : 0),
      result: users
    };
  }

  static async deleteUser(tenantID, id) {
    // Debug
    const uniqueTimerID = Logging.traceStart('UserStorage', 'deleteUser');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Delete User from sites
    await global.database.getCollection(tenantID, 'siteusers')
      .findOneAndDelete({ 'userID': Utils.convertToObjectID(id) });
    // Delete Image
    await global.database.getCollection(tenantID, 'userimages')
      .findOneAndDelete({ '_id': Utils.convertToObjectID(id) });
    // Delete Tags
    await global.database.getCollection(tenantID, 'tags')
      .deleteMany({ 'userID': Utils.convertToObjectID(id) });
    // Delete User
    await global.database.getCollection(tenantID, 'users')
    .findOneAndDelete({ '_id': Utils.convertToObjectID(id) });
    // Debug
    Logging.traceEnd('UserStorage', 'deleteUser', uniqueTimerID, { id });
  }

  static async _createUser(tenantID, userMDB) {
    let user = null;
    // Check
    if (userMDB) {
      // Create
      user = new User(tenantID, userMDB);
      // Get the Tags
      const tagsMDB = await global.database.getCollection(tenantID, 'tags')
        .find({ "userID": Utils.convertToObjectID(user.getID()) })
        .toArray();
      // Check
      if (tagsMDB) {
        // Get the Tags
        const tags = tagsMDB.map((tagMDB) => {
          return tagMDB._id;
        });
        // Get IDs`
        user.setTagIDs(tags);
      }
    }
    return user;
  }
}
