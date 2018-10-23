const crypto = require('crypto');
const Mustache = require('mustache');
const Constants = require('../../utils/Constants');
const Database = require('../../utils/Database');
const Configuration = require('../../utils/Configuration');
const Utils = require('../../utils/Utils');
const AppError = require('../../exception/AppError');
const eula = require('../../end-user-agreement');

const _centralSystemFrontEndConfig = Configuration.getCentralSystemFrontEndConfig();

class UserStorage {
  static getLatestEndUserLicenseAgreement(language = 'en'){
    // Get it
    let eulaText = eula[language];
    // Check
    if (!eulaText) {
      // Backup to EN
      eulaText = eula['en'];
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
    // Parse
    return eulaText;
  }

  static async getEndUserLicenseAgreement(tenantID, language = "en"){
    let languageFound = false;
    let currentEula;
    let currentEulaHash;
    let eula = null;
    const supportLanguages = Configuration.getLocalesConfig().supported;

    // Search for language
    for (const supportLanguage of supportLanguages) {
      if (language == supportLanguage.substring(0, 2)) {
        languageFound = true;
      }
    }
    if (!languageFound) {
      language = "en";
    }
    // Get current eula
    currentEula = await UserStorage.getLatestEndUserLicenseAgreement(tenantID, language);
    // Read DB
    const eulasMDB = await global.database.getCollection(tenantID, 'eulas')
      .find({'language': language})
      .sort({'version': -1})
      .limit(1)
      .toArray();
    // Found?
    if (eulasMDB && eulasMDB.length > 0) {
      // Get
      const eulaMDB = eulasMDB[0];
      // Check if eula has changed
      console.log(currentEula);

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
        // Return
        return eula;
      } else {
        // Ok: Transfer
        eula = {};
        Database.updateEula(eulaMDB, eula);
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
      // Return
      return eula;
    }
  }

  static async getUserByTagId(tenantID, tagID){
    // Read DB
    const tagsMDB = await global.database.getCollection(tenantID, 'tags')
      .find({'_id': tagID})
      .limit(1)
      .toArray();
    // Check
    if (tagsMDB && tagsMDB.length > 0) {
      // Ok
      return UserStorage.getUser(tenantID, tagsMDB[0].userID);
    }
  }

  static async getUserByEmail(tenantID, email){
    // Read DB
    const usersMDB = await global.database.getCollection(tenantID, 'users')
      .find({'email': email})
      .limit(1)
      .toArray();
    // Check deleted
    if (usersMDB && usersMDB.length > 0) {
      // Ok
      return UserStorage._createUser(tenantID, usersMDB[0]);
    }
  }

  static async getUser(tenantID, id){
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: {'_id': Utils.convertToObjectID(id)}
    });
    // Add Created By / Last Changed By
    Utils.pushCreatedLastChangedInAggregation(aggregation);
    // Read DB
    const usersMDB = await global.database.getCollection(tenantID, 'users')
      .aggregate(aggregation)
      .limit(1)
      .toArray();
    // Check deleted
    if (usersMDB && usersMDB.length > 0) {
      // Ok
      return UserStorage._createUser(tenantID, usersMDB[0]);
    }
  }

  static async getUserImage(tenantID, id){
    // Read DB
    const userImagesMDB = await global.database.getCollection(tenantID, 'userimages')
      .find({'_id': Utils.convertToObjectID(id)})
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
    return userImage;
  }

  static async getUserImages(tenantID){
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
    return userImages;
  }

  static async removeSitesFromUser(tenantID, userID, siteIDs){
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
  }

  static async addSitesToUser(tenantID, userID, siteIDs){
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
  }

  static async saveUser(tenantID, userToSave){
    const User = require('../../entity/User'); // Avoid fucking circular deps!!!
    // Check if ID or email is provided
    if (!userToSave.id && !userToSave.email) {
      // ID must be provided!
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `User has no ID and no Email`,
        550, "UserStorage", "saveUser");
    }
    // Build Request
    const userFilter = {};
    if (userToSave.id) {
      userFilter._id = Utils.convertToObjectID(userToSave.id);
    } else {
      userFilter.email = userToSave.email;
    }
    // Check Created/Last Changed By
    userToSave.createdBy = Utils.convertUserToObjectID(userToSave.createdBy);
    userToSave.lastChangedBy = Utils.convertUserToObjectID(userToSave.lastChangedBy);
    // Transfer
    const user = {};
    Database.updateUser(userToSave, user, false);
    // Modify and return the modified document
    const result = await global.database.getCollection(tenantID, 'users').findOneAndUpdate(
      userFilter,
      {$set: user},
      {upsert: true, new: true, returnOriginal: false});
    // Create
    const updatedUser = new User(tenantID, result.value);
    // Add tags
    if (userToSave.tagIDs) {
      // Delete Tag IDs
      await global.database.getCollection(tenantID, 'tags')
        .deleteMany({'userID': Utils.convertToObjectID(updatedUser.getID())});
      // At least one tag
      if (userToSave.tagIDs.length > 0) {
        // Create the list
        for (const tag of userToSave.tagIDs) {
          // Modify
          await global.database.getCollection(tenantID, 'tags').findOneAndUpdate(
            {'_id': tag},
            {$set: {'userID': Utils.convertToObjectID(updatedUser.getID())}},
            {upsert: true, new: true, returnOriginal: false});
        }
      }
    }
    // Update Sites?`
    if (userToSave.sites) {
      // Delete first
      await global.database.getCollection(tenantID, 'siteusers')
        .deleteMany({'userID': Utils.convertToObjectID(updatedUser.getID())});
      // At least one?
      if (userToSave.sites.length > 0) {
        const siteUsersMDB = [];
        // Create the list
        for (const site of userToSave.sites) {
          // Add
          siteUsersMDB.push({
            "siteID": Utils.convertToObjectID(site.id),
            "userID": Utils.convertToObjectID(updatedUser.getID())
          });
        }
        // Execute
        await global.database.getCollection(tenantID, 'siteusers').insertMany(siteUsersMDB);
      }
    }
    return updatedUser;
  }

  static async saveUserImage(tenantID, userImageToSave){
    // Check if ID is provided
    if (!userImageToSave.id) {
      // ID must be provided!
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `User Image has no ID`,
        550, "UserStorage", "saveUserImage");
    }
    // Modify and return the modified document
    const result = await global.database.getCollection(tenantID, 'userimages').findOneAndUpdate(
      {'_id': Utils.convertToObjectID(userImageToSave.id)},
      {$set: {image: userImageToSave.image}},
      {upsert: true, new: true, returnOriginal: false});
  }

  static async getUsers(tenantID, params = {}, limit, skip, sort){
    const User = require('../../entity/User'); // Avoid fucking circular deps!!!
    // Check Limit
    limit = Utils.checkRecordLimit(limit);
    // Check Skip
    skip = Utils.checkRecordSkip(skip);
    const filters = {
      "$and": [
        {
          "$or": [
            {"deleted": {$exists: false}},
            {deleted: false},
            {deleted: null}
          ]
        }
      ]
    };
    // Source?
    if (params.search) {
      // Build filter
      filters.$and.push({
        "$or": [
          {"_id": {$regex: params.search, $options: 'i'}},
          {"name": {$regex: params.search, $options: 'i'}},
          {"firstName": {$regex: params.search, $options: 'i'}},
          {"tags._id": {$regex: params.search, $options: 'i'}},
          {"email": {$regex: params.search, $options: 'i'}}
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
    // Create Aggregation
    const aggregation = [];
    // Add TagIDs
    aggregation.push({
      $lookup: {
        from: "tags",
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
    Utils.pushCreatedLastChangedInAggregation(aggregation);
    // Site ID?
    if (params.siteID) {
      // Add Site
      aggregation.push({
        $lookup: {
          from: "siteusers",
          localField: "_id",
          foreignField: "userID",
          as: "siteusers"
        }
      });
      aggregation.push({
        $match: {"siteusers.siteID": Utils.convertToObjectID(params.siteID)}
      });
    }
    // Count Records
    const usersCountMDB = await global.database.getCollection(tenantID, 'users')
      .aggregate([...aggregation, {$count: "count"}])
      .toArray();
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
        $sort: {status: -1, name: 1, firstName: 1}
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
      .aggregate(aggregation, {collation: {locale: "en_US", strength: 2}})
      .toArray();
    const users = [];
    // Create
    for (const userMDB of usersMDB) {
      // Create
      const user = new User(tenantID, userMDB);
      // Set
      user.setTagIDs(userMDB.tags.map((tag) => {
        return tag._id
      }));
      // Add
      users.push(user);
    }
    // Ok
    return {
      count: (usersCountMDB.length > 0 ? usersCountMDB[0].count : 0),
      result: users
    };
  }

  static async deleteUser(tenantID, id){
    // Delete User
    await global.database.getCollection(tenantID, 'users')
      .findOneAndDelete({'_id': Utils.convertToObjectID(id)});
    // Delete Image
    await global.database.getCollection(tenantID, 'userimages')
      .findOneAndDelete({'_id': Utils.convertToObjectID(id)});
    // Delete Tags
    await global.database.getCollection(tenantID, 'tags')
      .deleteMany({'userID': Utils.convertToObjectID(id)});
  }

  static async _createUser(tenantID, userMDB){
    const User = require('../../entity/User'); // Avoid fucking circular deps!!!
    let user = null;
    // Check
    if (userMDB) {
      // Create
      user = new User(tenantID, userMDB);
      // Get the Tags
      const tagsMDB = await global.database.getCollection(tenantID, 'tags')
        .find({"userID": Utils.convertToObjectID(user.getID())})
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

module.exports = UserStorage;
