import fs from 'fs';
import moment from 'moment';
import { ObjectID } from 'mongodb';
import Mustache from 'mustache';
import BackendError from '../../exception/BackendError';
import { BillingUserData } from '../../types/Billing';
import DbParams from '../../types/database/DbParams';
import { DataResult } from '../../types/DataResult';
import Eula from '../../types/Eula';
import global, { Image } from '../../types/GlobalType';
import { UserInError, UserInErrorType } from '../../types/InError';
import Site, { SiteUser } from '../../types/Site';
import Tag from '../../types/Tag';
import TenantComponents from '../../types/TenantComponents';
import User, { UserRole, UserStatus } from '../../types/User';
import UserNotifications from '../../types/UserNotifications';
import Configuration from '../../utils/Configuration';
import Constants from '../../utils/Constants';
import Cypher from '../../utils/Cypher';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import DatabaseUtils from './DatabaseUtils';
import TenantStorage from './TenantStorage';

const MODULE_NAME = 'UserStorage';

export default class UserStorage {
  public static async getEndUserLicenseAgreement(tenantID: string, language = 'en'): Promise<Eula> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getEndUserLicenseAgreement');
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
    const currentEula = UserStorage.getEndUserLicenseAgreementFromFile(language);
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
        Logging.traceEnd(MODULE_NAME, 'getEndUserLicenseAgreement', uniqueTimerID, { language });
        return eula;
      }
      // Debug
      Logging.traceEnd(MODULE_NAME, 'getEndUserLicenseAgreement', uniqueTimerID, { language });
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
    Logging.traceEnd(MODULE_NAME, 'getEndUserLicenseAgreement', uniqueTimerID, { language });
    // Return
    return eula;
  }

  public static async getUserByTagId(tenantID: string, tagID: string): Promise<User> {
    // Check
    if (!tagID) {
      return null;
    }
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getUserByTagId');
    // Get user
    const user = await UserStorage.getUsers(tenantID, { tagID: tagID }, Constants.DB_PARAMS_SINGLE_RECORD);
    // Debug
    Logging.traceEnd(MODULE_NAME, 'getUserByTagId', uniqueTimerID, { tagID });
    return user.count > 0 ? user.result[0] : null;
  }

  public static async getUserByEmail(tenantID: string, email: string): Promise<User> {
    // Check
    if (!email) {
      return null;
    }
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getUserByEmail');
    // Get user
    const user = await UserStorage.getUsers(tenantID, { email: email }, Constants.DB_PARAMS_SINGLE_RECORD);
    // Debug
    Logging.traceEnd(MODULE_NAME, 'getUserByEmail', uniqueTimerID, { email });
    return user.count > 0 ? user.result[0] : null;
  }

  public static async getUserByPasswordResetHash(tenantID: string, passwordResetHash: string): Promise<User> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getUserByPasswordResetHash');
    // Get user
    const user = await UserStorage.getUsers(tenantID, { passwordResetHash: passwordResetHash }, Constants.DB_PARAMS_SINGLE_RECORD);
    // Debug
    Logging.traceEnd(MODULE_NAME, 'getUserByPasswordResetHash', uniqueTimerID, { passwordResetHash });
    return user.count > 0 ? user.result[0] : null;
  }

  public static async getUser(tenantID: string, id: string): Promise<User> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getUser');
    // Get user
    const user = await UserStorage.getUsers(tenantID, { userID: id }, Constants.DB_PARAMS_SINGLE_RECORD);
    // Debug
    Logging.traceEnd(MODULE_NAME, 'getUser', uniqueTimerID, { id });
    return user.count > 0 ? user.result[0] : null;
  }

  public static async getUserByBillingID(tenantID: string, billingID: string): Promise<User> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getUserByBillingID');
    // Get user
    const user = await UserStorage.getUsers(tenantID, { billingCustomer: billingID }, Constants.DB_PARAMS_SINGLE_RECORD);
    // Debug
    Logging.traceEnd(MODULE_NAME, 'getUserByBillingID', uniqueTimerID, { customerID: billingID });
    return user.count > 0 ? user.result[0] : null;
  }

  public static async getUserImage(tenantID: string, id: string): Promise<Image> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getUserImage');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const userImageMDB: { _id: string; image: string } = await global.database.getCollection(tenantID, 'userimages')
      .findOne({ _id: Utils.convertToObjectID(id) });
    // Debug
    Logging.traceEnd(MODULE_NAME, 'getUserImage', uniqueTimerID, { id });
    return {
      id: id, image: (userImageMDB ? userImageMDB.image : null)
    };
  }

  public static async removeSitesFromUser(tenantID: string, userID: string, siteIDs: string[]): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'removeSitesFromUser');
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
    Logging.traceEnd(MODULE_NAME, 'removeSitesFromUser', uniqueTimerID, { userID, siteIDs });
  }

  public static async addSitesToUser(tenantID: string, userID: string, siteIDs: string[]): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'addSitesToUser');
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
    Logging.traceEnd(MODULE_NAME, 'addSitesToUser', uniqueTimerID, { userID, siteIDs });
  }

  public static async saveUser(tenantID: string, userToSave: Partial<User>, saveImage = false): Promise<string> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'saveUser');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check if ID or email is provided
    if (!userToSave.id && !userToSave.email) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'saveUser',
        message: 'User has no ID and no Email'
      });
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
      issuer: userToSave.issuer,
      name: userToSave.name,
      firstName: userToSave.firstName,
      email: userToSave.email,
      phone: userToSave.phone,
      mobile: userToSave.mobile,
      locale: userToSave.locale,
      address: userToSave.address,
      iNumber: userToSave.iNumber,
      costCenter: userToSave.costCenter,
      notifications: {
        sendSessionStarted: userToSave.notifications ? Utils.convertToBoolean(userToSave.notifications.sendSessionStarted) : false,
        sendOptimalChargeReached: userToSave.notifications ? Utils.convertToBoolean(userToSave.notifications.sendOptimalChargeReached) : false,
        sendEndOfCharge: userToSave.notifications ? Utils.convertToBoolean(userToSave.notifications.sendEndOfCharge) : false,
        sendEndOfSession: userToSave.notifications ? Utils.convertToBoolean(userToSave.notifications.sendEndOfSession) : false,
        sendUserAccountStatusChanged: userToSave.notifications ? Utils.convertToBoolean(userToSave.notifications.sendUserAccountStatusChanged) : false,
        sendNewRegisteredUser: userToSave.notifications ? Utils.convertToBoolean(userToSave.notifications.sendNewRegisteredUser) : false,
        sendUnknownUserBadged: userToSave.notifications ? Utils.convertToBoolean(userToSave.notifications.sendUnknownUserBadged) : false,
        sendChargingStationStatusError: userToSave.notifications ? Utils.convertToBoolean(userToSave.notifications.sendChargingStationStatusError) : false,
        sendChargingStationRegistered: userToSave.notifications ? Utils.convertToBoolean(userToSave.notifications.sendChargingStationRegistered) : false,
        sendOcpiPatchStatusError: userToSave.notifications ? Utils.convertToBoolean(userToSave.notifications.sendOcpiPatchStatusError) : false,
        sendSmtpAuthError: userToSave.notifications ? Utils.convertToBoolean(userToSave.notifications.sendSmtpAuthError) : false,
        sendUserAccountInactivity: userToSave.notifications ? Utils.convertToBoolean(userToSave.notifications.sendUserAccountInactivity) : false,
        sendPreparingSessionNotStarted: userToSave.notifications ? Utils.convertToBoolean(userToSave.notifications.sendPreparingSessionNotStarted) : false,
        sendOfflineChargingStations: userToSave.notifications ? Utils.convertToBoolean(userToSave.notifications.sendOfflineChargingStations) : false,
        sendBillingUserSynchronizationFailed: userToSave.notifications ? Utils.convertToBoolean(userToSave.notifications.sendBillingUserSynchronizationFailed) : false,
        sendSessionNotStarted: userToSave.notifications ? Utils.convertToBoolean(userToSave.notifications.sendSessionNotStarted) : false,
        sendCarCatalogSynchronizationFailed: userToSave.notifications ? Utils.convertToBoolean(userToSave.notifications.sendCarCatalogSynchronizationFailed) : false,
      },
      deleted: Utils.objectHasProperty(userToSave, 'deleted') ? userToSave.deleted : false
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
      await UserStorage.saveUserImage(tenantID, userMDB._id.toHexString(), userToSave.image);
    }
    // Debug
    Logging.traceEnd(MODULE_NAME, 'saveUser', uniqueTimerID, { userToSave });
    return userMDB._id.toHexString();
  }

  public static async saveUserTag(tenantID: string, userID: string, tag: Tag): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'saveUserTag');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const tagMDB = {
      _id: tag.id,
      userID: Utils.convertToObjectID(userID),
      issuer: tag.issuer,
      active: tag.active,
      ocpiToken: tag.ocpiToken,
      description: tag.description
    };
    // Check Created/Last Changed By
    DatabaseUtils.addLastChangedCreatedProps(tagMDB, tag);
    // Save
    await global.database.getCollection<any>(tenantID, 'tags').findOneAndUpdate(
      {
        '_id': tag.id,
        'userID': Utils.convertToObjectID(userID)
      },
      { $set: tagMDB },
      { upsert: true, returnOriginal: false });
    // Debug
    Logging.traceEnd(MODULE_NAME, 'saveUserTag', uniqueTimerID, { id: userID, tag: tag });
  }

  public static async deleteUserTag(tenantID: string, userID: string, tag: Tag): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'deleteUserTag');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Delete
    await global.database.getCollection<any>(tenantID, 'tags').deleteOne(
      {
        '_id': tag.id,
        'userID': Utils.convertToObjectID(userID)
      });
    // Debug
    Logging.traceEnd(MODULE_NAME, 'deleteUserTag', uniqueTimerID, { id: userID, tag: tag });
  }

  public static async saveUserPassword(tenantID: string, userID: string,
    params: {
      password?: string; passwordResetHash?: string; passwordWrongNbrTrials?: number;
      passwordBlockedUntil?: Date;
    }): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'saveUserPassword');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Modify and return the modified document
    await global.database.getCollection<any>(tenantID, 'users').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(userID) },
      { $set: params });
    // Debug
    Logging.traceEnd(MODULE_NAME, 'saveUserPassword', uniqueTimerID);
  }

  public static async saveUserStatus(tenantID: string, userID: string, status: UserStatus): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'saveUserStatus');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Modify and return the modified document
    await global.database.getCollection<any>(tenantID, 'users').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(userID) },
      { $set: { status } });
    // Debug
    Logging.traceEnd(MODULE_NAME, 'saveUserStatus', uniqueTimerID);
  }

  public static async saveUserMobileToken(tenantID: string, userID: string,
    params: { mobileToken: string; mobileOs: string; mobileLastChangedOn: Date }): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'saveUserMobileToken');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Modify and return the modified document
    await global.database.getCollection<any>(tenantID, 'users').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(userID) },
      { $set: params });
    // Debug
    Logging.traceEnd(MODULE_NAME, 'saveUserMobileToken', uniqueTimerID);
  }

  public static async saveUserRole(tenantID: string, userID: string, role: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'saveUserRole');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Modify and return the modified document
    await global.database.getCollection<any>(tenantID, 'users').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(userID) },
      { $set: { role } });
    // Debug
    Logging.traceEnd(MODULE_NAME, 'saveUserRole', uniqueTimerID);
  }

  public static async saveUserEULA(tenantID: string, userID: string,
    params: { eulaAcceptedHash: string; eulaAcceptedOn: Date; eulaAcceptedVersion: number }): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'saveUserRole');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Modify and return the modified document
    await global.database.getCollection<any>(tenantID, 'users').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(userID) },
      { $set: params });
    // Debug
    Logging.traceEnd(MODULE_NAME, 'saveUserRole', uniqueTimerID);
  }

  public static async saveUserAccountVerification(tenantID: string, userID: string,
    params: { verificationToken?: string; verifiedAt?: Date }): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'saveUserAccountVerification');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Modify and return the modified document
    await global.database.getCollection<any>(tenantID, 'users').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(userID) },
      { $set: params });
    // Debug
    Logging.traceEnd(MODULE_NAME, 'saveUserAccountVerification', uniqueTimerID);
  }

  public static async saveUserAdminData(tenantID: string, userID: string,
    params: { plateID?: string; notificationsActive?: boolean; notifications?: UserNotifications }): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'saveUserAdminData');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Set data
    const updatedUserMDB: any = {};
    // Set only provided values
    if (Utils.objectHasProperty(params, 'plateID')) {
      updatedUserMDB.plateID = params.plateID;
    }
    if (Utils.objectHasProperty(params, 'notificationsActive')) {
      updatedUserMDB.notificationsActive = params.notificationsActive;
    }
    if (Utils.objectHasProperty(params, 'notifications')) {
      updatedUserMDB.notifications = params.notifications;
    }
    // Modify and return the modified document
    await global.database.getCollection<any>(tenantID, 'users').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(userID) },
      { $set: updatedUserMDB });
    // Debug
    Logging.traceEnd(MODULE_NAME, 'saveUserAdminData', uniqueTimerID);
  }

  public static async saveUserBillingData(tenantID: string, userID: string,
    billingData: BillingUserData): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'saveUserBillingData');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Set data
    const updatedUserMDB: any = {};
    // Set only provided values
    if (billingData && billingData.customerID) {
      updatedUserMDB.billingData = {} as BillingUserData;
      updatedUserMDB.billingData.customerID = billingData.customerID;
      updatedUserMDB.billingData.method = billingData.method;
      updatedUserMDB.billingData.cardID = billingData.cardID;
      updatedUserMDB.billingData.hasSynchroError = billingData.hasSynchroError;
      updatedUserMDB.billingData.invoicesLastSynchronizedOn = billingData.invoicesLastSynchronizedOn;
      if (!updatedUserMDB.billingData.cardID) {
        delete updatedUserMDB.billingData.cardID;
      }
      updatedUserMDB.billingData.subscriptionID = billingData.subscriptionID;
      if (!updatedUserMDB.billingData.subscriptionID) {
        delete updatedUserMDB.billingData.subscriptionID;
      }
      const lastChangedOn = Utils.convertToDate(billingData.lastChangedOn);
      if (lastChangedOn) {
        await global.database.getCollection<any>(tenantID, 'users').findOneAndUpdate(
          { '_id': Utils.convertToObjectID(userID) },
          { $set: { lastChangedOn } });
      }
      updatedUserMDB.billingData.lastChangedOn = lastChangedOn;
      // Modify and return the modified document
      await global.database.getCollection<any>(tenantID, 'users').findOneAndUpdate(
        { '_id': Utils.convertToObjectID(userID) },
        { $set: updatedUserMDB });
      // Debug
      Logging.traceEnd(MODULE_NAME, 'saveUserBillingData', uniqueTimerID);
    }
  }

  public static async saveUserImage(tenantID: string, userID: string, userImageToSave: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'saveUserImage');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check if ID is provided
    if (!userID) {
      // ID must be provided!
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'saveUserImage',
        message: 'User Image has no ID'
      });
    }
    // Modify and return the modified document
    await global.database.getCollection<any>(tenantID, 'userimages').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(userID) },
      { $set: { image: userImageToSave } },
      { upsert: true, returnOriginal: false });
    // Debug
    Logging.traceEnd(MODULE_NAME, 'saveUserImage', uniqueTimerID, { userID });
  }

  public static async getUsers(tenantID: string,
    params: {
      notificationsActive?: boolean; siteIDs?: string[]; excludeSiteID?: string; search?: string;
      userID?: string; tagID?: string; email?: string; issuer?: boolean; passwordResetHash?: string; roles?: string[];
      statuses?: string[]; withImage?: boolean; billingCustomer?: string; notSynchronizedBillingData?: boolean;
      notifications?: any; noLoginSince?: Date;
    },
    dbParams: DbParams, projectFields?: string[]): Promise<DataResult<User>> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getUsers');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check Limit
    const limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    const skip = Utils.checkRecordSkip(dbParams.skip);
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
      const searchRegex = Utils.escapeSpecialCharsInRegex(params.search);
      filters.$and.push({
        '$or': [
          { 'name': { $regex: searchRegex, $options: 'i' } },
          { 'firstName': { $regex: searchRegex, $options: 'i' } },
          { 'tags.id': { $regex: searchRegex, $options: 'i' } },
          { 'email': { $regex: searchRegex, $options: 'i' } },
          { 'plateID': { $regex: searchRegex, $options: 'i' } }
        ]
      });
    }
    if (params.issuer === true || params.issuer === false) {
      filters.$and.push({ 'issuer': params.issuer });
    }
    // Email
    if (params.email) {
      filters.$and.push({
        'email': params.email
      });
    }
    // TagID
    if (params.tagID) {
      filters.$and.push({
        'tags.id': params.tagID
      });
    }
    // Password Reset Hash
    if (params.passwordResetHash) {
      filters.$and.push({
        'passwordResetHash': params.passwordResetHash
      });
    }
    // Role
    if (params.roles && Array.isArray(params.roles) && params.roles.length > 0) {
      filters.role = { $in: params.roles };
    }
    // Billing Customer
    if (params.billingCustomer) {
      filters.$and.push(
        { 'billingData': { '$exists': true } },
        { 'billingData.customerID': { '$exists': true } },
        { 'billingData.customerID': params.billingCustomer }
      );
    }
    // Status (Previously getUsersInError)
    if (params.statuses && Array.isArray(params.statuses) && params.statuses.length > 0) {
      filters.status = { $in: params.statuses };
    }
    // Notifications
    if (params.notificationsActive) {
      filters.$and.push({
        'notificationsActive': params.notificationsActive
      });
    }
    // Filter on last login to detect inactive user accounts
    if (params.noLoginSince && moment(params.noLoginSince).isValid()) {
      filters.$and.push({
        'eulaAcceptedOn': { $lte: params.noLoginSince },
        'role': 'B'
      });
    }
    if (params.notifications) {
      for (const key in params.notifications) {
        const notificationFilter = {};
        notificationFilter[`notifications.${key}`] = params.notifications[key];
        filters.$and.push(notificationFilter);
      }
    }
    // Create Aggregation
    const aggregation = [];

    // Add Tags
    DatabaseUtils.pushTagLookupInAggregation({
      tenantID, aggregation, localField: '_id', foreignField: 'userID', asField: 'tags'
    });

    if (dbParams === Constants.DB_PARAMS_SINGLE_RECORD) {
      DatabaseUtils.pushTransactionsLookupInAggregation({
        tenantID, aggregation, localField: '_id', foreignField: 'userID', asField: 'sessionsCount', countField: 'tagID'
      });
    }

    // Select non-synchronized billing data
    if (params.notSynchronizedBillingData) {
      filters.$and.push({
        '$or': [
          { 'billingData': { '$exists': false } },
          { 'billingData.lastChangedOn': { '$exists': false } },
          { 'billingData.lastChangedOn': null },
          { 'lastChangedOn': { '$exists': false } },
          { 'lastChangedOn': null },
          { $expr: { $gt: ['$lastChangedOn', '$billingData.lastChangedOn'] } }
        ]
      });
    }
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
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const usersCountMDB = await global.database.getCollection<any>(tenantID, 'users')
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
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
    if (dbParams.sort) {
      aggregation.push({
        $sort: dbParams.sort
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
      .aggregate(aggregation, {
        collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 },
        allowDiskUse: true
      })
      .toArray();
    // Clean user object
    for (const userMDB of usersMDB) {
      delete (userMDB as any).siteusers;
      if ((userMDB as any).sessionsCount) {
        for (const sessionCount of (userMDB as any).sessionsCount) {
          const tag = userMDB.tags.find((value) => value.id === sessionCount.id);
          if (tag) {
            tag.sessionCount = sessionCount.count;
          }
        }
        delete (userMDB as any).sessionsCount;
      }
    }
    // Debug
    Logging.traceEnd(MODULE_NAME, 'getUsers', uniqueTimerID, {
      params,
      limit,
      skip,
      sort: dbParams.sort
    });
    // Ok
    return {
      count: (usersCountMDB.length > 0 ?
        (usersCountMDB[0].count === Constants.DB_RECORD_COUNT_CEIL ? -1 : usersCountMDB[0].count) : 0),
      result: usersMDB
    };
  }

  public static async getTag(tenantID: string, id: string): Promise<Tag> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getTag');
    // Get tag
    const tag = await UserStorage.getTags(tenantID, { tagID: id }, Constants.DB_PARAMS_SINGLE_RECORD);
    // Debug
    Logging.traceEnd(MODULE_NAME, 'getTag', uniqueTimerID, { id });
    return tag.count > 0 ? tag.result[0] : null;
  }

  public static async getTags(tenantID: string, params: { issuer?: boolean; tagID?: string; userID?: string; dateFrom?: Date; dateTo?: Date }, dbParams: DbParams): Promise<DataResult<Tag>> {
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getTags');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check Limit
    const limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    const skip = Utils.checkRecordSkip(dbParams.skip);

    // Create Aggregation
    const aggregation = [];
    if (params) {
      const filters = [];
      if (params.tagID) {
        filters.push({ _id: params.tagID });
      }
      if (params.userID) {
        filters.push({ userID: Utils.convertToObjectID(params.userID) });
      }
      if (params.issuer === true || params.issuer === false) {
        filters.push({ issuer: params.issuer });
      }
      if (params.dateFrom && moment(params.dateFrom).isValid()) {
        filters.push({ lastChangedOn: { $gte: new Date(params.dateFrom) } });
      }
      if (params.dateTo && moment(params.dateTo).isValid()) {
        filters.push({ lastChangedOn: { $lte: new Date(params.dateTo) } });
      }

      if (filters.length > 0) {
        aggregation.push({ $match: { $and: filters } });
      }
    }

    // Limit records?
    if (!dbParams.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const tagsCountMDB = await global.database.getCollection<any>(tenantID, 'tags')
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      // Return only the count
      return {
        count: (tagsCountMDB.length > 0 ? tagsCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();

    if (dbParams.sort) {
      aggregation.push({
        $sort: dbParams.sort
      });
    } else {
      aggregation.push({
        $sort: { lastChangedOn: 1 }
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

    aggregation.push({
      $project: {
        id: '$_id',
        _id: 0,
        userID: { $toString: '$userID' },
        lastChangedOn: 1,
        active: 1,
        ocpiToken: 1,
        description: 1,
        issuer: 1
      }
    });
    // Read DB
    const tagsMDB = await global.database.getCollection<Tag>(tenantID, 'tags')
      .aggregate(aggregation, {
        collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 },
        allowDiskUse: true
      })
      .toArray();
    // Debug
    Logging.traceEnd(MODULE_NAME, 'getTags', uniqueTimerID);
    // Ok
    return {
      count: (tagsCountMDB.length > 0 ?
        (tagsCountMDB[0].count === Constants.DB_RECORD_COUNT_CEIL ? -1 : tagsCountMDB[0].count) : 0),
      result: tagsMDB
    };
  }

  public static async getUsersInError(tenantID: string,
    params: { search?: string; roles?: string[]; errorTypes?: string[] },
    dbParams: DbParams, projectFields?: string[]): Promise<DataResult<UserInError>> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getUsers');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check Limit
    const limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    const skip = Utils.checkRecordSkip(dbParams.skip);
    // Mongodb aggregation creation
    const aggregation = [];
    // Mongodb filter block ($match)
    const match: any = { '$and': [{ '$or': DatabaseUtils.getNotDeletedFilter() }] };
    match.$and.push({ issuer: true });
    if (params.roles) {
      match.$and.push({ role: { '$in': params.roles } });
    }
    if (params.search) {
      const searchRegex = Utils.escapeSpecialCharsInRegex(params.search);
      match.$and.push({
        '$or': [
          { 'name': { $regex: searchRegex, $options: 'i' } },
          { 'firstName': { $regex: searchRegex, $options: 'i' } },
          { 'tags.id': { $regex: searchRegex, $options: 'i' } },
          { 'email': { $regex: searchRegex, $options: 'i' } },
          { 'plateID': { $regex: searchRegex, $options: 'i' } }
        ]
      });
    }
    aggregation.push({ $match: match });
    // Mongodb Lookup block
    // Add Tags
    DatabaseUtils.pushTagLookupInAggregation({
      tenantID, aggregation, localField: '_id', foreignField: 'userID', asField: 'tags'
    });
    // Mongodb facets block
    // If the organization component is active the system looks for non active users or active users that
    // are not assigned yet to at least one site.
    // If the organization component is not active then the system just looks for non active users.
    const facets: any = { $facet: {} };
    const array = [];
    const tenant = await TenantStorage.getTenant(tenantID);
    for (const type of params.errorTypes) {
      if ((type === UserInErrorType.NOT_ASSIGNED && !Utils.isTenantComponentActive(tenant, TenantComponents.ORGANIZATION)) ||
         ((type === UserInErrorType.NO_BILLING_DATA || type === UserInErrorType.FAILED_BILLING_SYNCHRO) && !Utils.isTenantComponentActive(tenant, TenantComponents.BILLING))) {
        continue;
      }
      array.push(`$${type}`);
      facets.$facet[type] = UserStorage.getUserInErrorFacet(tenantID, type);
    }
    // Do not add facet aggregation if no facet found
    if (Object.keys(facets.$facet).length > 0) {
      aggregation.push(facets);
    }
    // Manipulate the results to convert it to an array of document on root level
    aggregation.push({ $project: { usersInError: { $setUnion: array } } });
    // Finish the preparation of the result
    aggregation.push({ $unwind: '$usersInError' });
    aggregation.push({ $replaceRoot: { newRoot: '$usersInError' } });
    // Change ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);
    // Mongodb sort, skip and limit block
    if (dbParams.sort) {
      aggregation.push({
        $sort: dbParams.sort
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
      .aggregate(aggregation, {
        collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 },
        allowDiskUse: false
      })
      .toArray();
    // Debug
    Logging.traceEnd(MODULE_NAME, 'getUsers', uniqueTimerID, { params, limit, skip, sort: dbParams.sort });
    // Ok
    return {
      count: usersMDB.length,
      result: usersMDB
    };
  }

  public static async deleteUser(tenantID: string, id: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'deleteUser');
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
    Logging.traceEnd(MODULE_NAME, 'deleteUser', uniqueTimerID, { id });
  }

  public static async getSites(tenantID: string,
    params: { search?: string; userID: string; siteAdmin?: boolean; siteOwner?: boolean },
    dbParams: DbParams, projectFields?: string[]): Promise<DataResult<SiteUser>> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getSites');
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
    if (params.siteOwner) {
      filters.siteOwner = params.siteOwner;
    }
    // Create Aggregation
    const aggregation: any[] = [];
    // Filter
    aggregation.push({
      $match: filters
    });
    // Get Sites
    DatabaseUtils.pushSiteLookupInAggregation(
      {
        tenantID, aggregation, localField: 'siteID', foreignField: '_id',
        asField: 'site', oneToOneCardinality: true, oneToOneCardinalityNotNull: true
      });
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
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteID');
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
    const siteUsersMDB = await global.database.getCollection<{ userID: string; siteID: string; siteAdmin: boolean; siteOwner: boolean; site: Site }>(tenantID, 'siteusers')
      .aggregate(aggregation, {
        collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 },
        allowDiskUse: true
      })
      .toArray();
    // Create
    const sites: SiteUser[] = [];
    for (const siteUserMDB of siteUsersMDB) {
      if (siteUserMDB.site) {
        sites.push({
          siteAdmin: siteUserMDB.siteAdmin,
          siteOwner: siteUserMDB.siteOwner,
          userID: siteUserMDB.userID,
          site: siteUserMDB.site
        });
      }
    }
    // Debug
    Logging.traceEnd(MODULE_NAME, 'UserStorage', uniqueTimerID, { userID: params.userID });
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
      issuer: true,
      name: 'Unknown',
      firstName: 'User',
      email: '',
      address: null,
      createdBy: null,
      createdOn: new Date(),
      locale: Constants.DEFAULT_LOCALE,
      notificationsActive: true,
      notifications: {
        sendSessionStarted: true,
        sendOptimalChargeReached: true,
        sendEndOfCharge: true,
        sendEndOfSession: true,
        sendUserAccountStatusChanged: true,
        sendNewRegisteredUser: false,
        sendUnknownUserBadged: false,
        sendChargingStationStatusError: false,
        sendChargingStationRegistered: false,
        sendOcpiPatchStatusError: false,
        sendSmtpAuthError: false,
        sendUserAccountInactivity: false,
        sendPreparingSessionNotStarted: false,
        sendOfflineChargingStations: false,
        sendBillingUserSynchronizationFailed: false,
        sendSessionNotStarted: false,
        sendCarCatalogSynchronizationFailed: false
      },
      role: UserRole.BASIC,
      status: UserStatus.PENDING,
      tags: []
    };
  }

  private static getUserInErrorFacet(tenantID: string, errorType: string) {
    switch (errorType) {
      case UserInErrorType.NOT_ACTIVE:
        return [
          { $match: { status: { $ne: UserStatus.ACTIVE } } },
          { $addFields: { 'errorCode': UserInErrorType.NOT_ACTIVE } }
        ];
      case UserInErrorType.NOT_ASSIGNED: {
        return [
          {
            $lookup: {
              from: DatabaseUtils.getCollectionName(tenantID, 'siteusers'),
              localField: '_id',
              foreignField: 'userID',
              as: 'sites'
            }
          },
          { $match: { sites: { $size: 0 } } },
          { $addFields: { 'errorCode': UserInErrorType.NOT_ASSIGNED } }
        ];
      }
      case UserInErrorType.INACTIVE_USER_ACCOUNT: {
        const someMonthsAgo = moment().subtract(6, 'months').toDate();
        if (moment(someMonthsAgo).isValid()) {
          return [
            {
              $match: {
                $and: [
                  { eulaAcceptedOn: { $lte: someMonthsAgo } },
                  { role: 'B' }]
              }

            },
            {
              $addFields: { 'errorCode': UserInErrorType.INACTIVE_USER_ACCOUNT }
            }
          ];
        }
        return [];
      }
      case UserInErrorType.FAILED_BILLING_SYNCHRO:
        return [
          { $match: { $or: [{ 'billingData.hasSynchroError': { $eq: true } }, { $and: [{ billingData: { $exists: true } }, { 'billingData.hasSynchroError': { $exists: false } }] }] } },
          { $addFields: { 'errorCode': UserInErrorType.FAILED_BILLING_SYNCHRO } }
        ];
      case UserInErrorType.NO_BILLING_DATA:
        return [
          { $match: { $and: [{ 'status': { $eq: UserStatus.ACTIVE } }, { 'billingData': { $exists: false } }] } },
          { $addFields: { 'errorCode': UserInErrorType.NO_BILLING_DATA } }
        ];
      default:
        return [];
    }
  }

  private static getEndUserLicenseAgreementFromFile(language = 'en'): string {
    const _centralSystemFrontEndConfig = Configuration.getCentralSystemFrontEndConfig();
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getEndUserLicenseAgreementFromFile');
    let eulaText = null;
    try {
      eulaText = fs.readFileSync(`${global.appRoot}/assets/eula/${language}/end-user-agreement.html`, 'utf8');
    } catch (error) {
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
    Logging.traceEnd(MODULE_NAME, 'getEndUserLicenseAgreementFromFile', uniqueTimerID, { language });
    return eulaText;
  }
}
