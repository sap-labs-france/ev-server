import Site, { SiteUser } from '../../types/Site';
import User, { UserRole, UserStatus } from '../../types/User';
import { UserInError, UserInErrorType } from '../../types/InError';
import global, { FilterParams, Image } from '../../types/GlobalType';

import BackendError from '../../exception/BackendError';
import { BillingUserData } from '../../types/Billing';
import Configuration from '../../utils/Configuration';
import Constants from '../../utils/Constants';
import Cypher from '../../utils/Cypher';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Eula from '../../types/Eula';
import Logging from '../../utils/Logging';
import Mustache from 'mustache';
import { ObjectID } from 'mongodb';
import Tag from '../../types/Tag';
import TenantComponents from '../../types/TenantComponents';
import TenantStorage from './TenantStorage';
import UserNotifications from '../../types/UserNotifications';
import Utils from '../../utils/Utils';
import fs from 'fs';
import moment from 'moment';

const MODULE_NAME = 'UserStorage';

export default class UserStorage {
  public static async getEndUserLicenseAgreement(tenantID: string, language = 'en'): Promise<Eula> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getEndUserLicenseAgreement');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    let currentEulaHash: string;
    // Supported languages?
    if (!Constants.SUPPORTED_LANGUAGES.includes(language)) {
      // Default
      language = Constants.DEFAULT_LANGUAGE;
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
        Logging.traceEnd(tenantID, MODULE_NAME, 'getEndUserLicenseAgreement', uniqueTimerID, eula);
        return eula;
      }
      // Debug
      Logging.traceEnd(tenantID, MODULE_NAME, 'getEndUserLicenseAgreement', uniqueTimerID, eulaMDB);
      return eulaMDB;
    }
    // Create default
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
    Logging.traceEnd(tenantID, MODULE_NAME, 'getEndUserLicenseAgreement', uniqueTimerID, eula);
    // Return
    return eula;
  }

  public static async getUserByTagId(tenantID: string, tagID: string = Constants.UNKNOWN_STRING_ID): Promise<User> {
    const tagMDB = await UserStorage.getTag(tenantID, tagID, { withUser: true });
    return tagMDB ? tagMDB.user : null;
  }

  public static async getUserByEmail(tenantID: string, email: string = Constants.UNKNOWN_STRING_ID): Promise<User> {
    const userMDB = await UserStorage.getUsers(tenantID, {
      email: email,
    }, Constants.DB_PARAMS_SINGLE_RECORD);
    return userMDB.count === 1 ? userMDB.result[0] : null;
  }

  public static async getUserByPasswordResetHash(tenantID: string, passwordResetHash: string = Constants.UNKNOWN_STRING_ID): Promise<User> {
    const userMDB = await UserStorage.getUsers(tenantID, {
      passwordResetHash: passwordResetHash
    }, Constants.DB_PARAMS_SINGLE_RECORD);
    return userMDB.count === 1 ? userMDB.result[0] : null;
  }

  public static async getUser(tenantID: string, id: string = Constants.UNKNOWN_OBJECT_ID, projectFields?: string[]): Promise<User> {
    const userMDB = await UserStorage.getUsers(tenantID,
      {
        userIDs: [id],
      }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return userMDB.count === 1 ? userMDB.result[0] : null;
  }

  public static async getUserByBillingID(tenantID: string, billingID: string): Promise<User> {
    const userMDB = await UserStorage.getUsers(tenantID, {
      billingUserID: billingID
    }, Constants.DB_PARAMS_SINGLE_RECORD);
    return userMDB.count === 1 ? userMDB.result[0] : null;
  }

  public static async getUserImage(tenantID: string, id: string): Promise<Image> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getUserImage');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const userImageMDB: { _id: string; image: string } = await global.database.getCollection(tenantID, 'userimages')
      .findOne({ _id: Utils.convertToObjectID(id) });
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'getUserImage', uniqueTimerID, userImageMDB);
    return {
      id: id, image: (userImageMDB ? userImageMDB.image : null)
    };
  }

  public static async removeSitesFromUser(tenantID: string, userID: string, siteIDs: string[]): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'removeSitesFromUser');
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
    Logging.traceEnd(tenantID, MODULE_NAME, 'removeSitesFromUser', uniqueTimerID, siteIDs);
  }

  public static async addSitesToUser(tenantID: string, userID: string, siteIDs: string[]): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'addSitesToUser');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // At least one Site
    if (siteIDs && siteIDs.length > 0) {
      const siteUsersMDB = [];
      // Create the list
      for (const siteID of siteIDs) {
        siteUsersMDB.push({
          '_id': Cypher.hash(`${siteID}~${userID}`),
          'userID': Utils.convertToObjectID(userID),
          'siteID': Utils.convertToObjectID(siteID),
          'siteAdmin': false
        });
      }
      // Execute
      await global.database.getCollection<any>(tenantID, 'siteusers').insertMany(siteUsersMDB);
    }
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'addSitesToUser', uniqueTimerID, siteIDs);
  }

  public static async saveUser(tenantID: string, userToSave: Partial<User>, saveImage = false): Promise<string> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'saveUser');
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
    const userMDB: any = {
      _id: userToSave.id ? Utils.convertToObjectID(userToSave.id) : new ObjectID(),
      issuer: Utils.convertToBoolean(userToSave.issuer),
      name: userToSave.name,
      firstName: userToSave.firstName,
      email: userToSave.email,
      phone: userToSave.phone,
      mobile: userToSave.mobile,
      locale: userToSave.locale,
      iNumber: userToSave.iNumber,
      costCenter: userToSave.costCenter,
      notificationsActive: userToSave.notificationsActive,
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
        sendBillingSynchronizationFailed: userToSave.notifications ? Utils.convertToBoolean(userToSave.notifications.sendBillingSynchronizationFailed) : false,
        sendSessionNotStarted: userToSave.notifications ? Utils.convertToBoolean(userToSave.notifications.sendSessionNotStarted) : false,
        sendCarCatalogSynchronizationFailed: userToSave.notifications ? Utils.convertToBoolean(userToSave.notifications.sendCarCatalogSynchronizationFailed) : false,
        sendEndUserErrorNotification: userToSave.notifications ? Utils.convertToBoolean(userToSave.notifications.sendEndUserErrorNotification) : false,
        sendComputeAndApplyChargingProfilesFailed: userToSave.notifications ? Utils.convertToBoolean(userToSave.notifications.sendComputeAndApplyChargingProfilesFailed) : false,
        sendBillingNewInvoice: userToSave.notifications ? Utils.convertToBoolean(userToSave.notifications.sendBillingNewInvoice) : false,
      },
      deleted: Utils.objectHasProperty(userToSave, 'deleted') ? userToSave.deleted : false
    };
    if (userToSave.address) {
      userMDB.address = {
        address1: userToSave.address.address1,
        address2: userToSave.address.address2,
        postalCode: userToSave.address.postalCode,
        city: userToSave.address.city,
        department: userToSave.address.department,
        region: userToSave.address.region,
        country: userToSave.address.country,
        coordinates: Utils.containsGPSCoordinates(userToSave.address.coordinates) ? userToSave.address.coordinates.map(
          (coordinate) => Utils.convertToFloat(coordinate)) : [],
      };
    }
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
    Logging.traceEnd(tenantID, MODULE_NAME, 'saveUser', uniqueTimerID, userMDB);
    return userMDB._id.toHexString();
  }

  public static async saveTag(tenantID: string, tag: Tag): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'saveTag');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const tagMDB = {
      _id: tag.id,
      userID: Utils.convertToObjectID(tag.userID),
      issuer: Utils.convertToBoolean(tag.issuer),
      active: Utils.convertToBoolean(tag.active),
      default: Utils.convertToBoolean(tag.default),
      ocpiToken: tag.ocpiToken,
      description: tag.description,
      deleted: Utils.objectHasProperty(tag, 'deleted') ? tag.deleted : false
    };
    // Check Created/Last Changed By
    DatabaseUtils.addLastChangedCreatedProps(tagMDB, tag);
    // Save
    await global.database.getCollection<any>(tenantID, 'tags').findOneAndUpdate(
      { '_id': tag.id },
      { $set: tagMDB },
      { upsert: true, returnOriginal: false });
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'saveTag', uniqueTimerID, tagMDB);
  }

  public static async clearTagUserDefault(tenantID: string, userID: string): Promise<void> {
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'clearTagUserDefault');
    await Utils.checkTenant(tenantID);
    await global.database.getCollection<any>(tenantID, 'tags').updateMany(
      {
        userID: Utils.convertToObjectID(userID),
        default: true
      },
      {
        $set: { default: false }
      });
    Logging.traceEnd(tenantID, MODULE_NAME, 'clearTagUserDefault', uniqueTimerID, { userID });
  }

  public static async deleteTag(tenantID: string, tagID: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'deleteTag');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Delete
    await global.database.getCollection<any>(tenantID, 'tags').deleteOne(
      {
        '_id': tagID,
      });
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'deleteTag', uniqueTimerID, { id: tagID });
  }

  public static async saveUserPassword(tenantID: string, userID: string,
    params: {
      password?: string; passwordResetHash?: string; passwordWrongNbrTrials?: number;
      passwordBlockedUntil?: Date;
    }): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'saveUserPassword');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Modify and return the modified document
    await global.database.getCollection<any>(tenantID, 'users').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(userID) },
      { $set: params });
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'saveUserPassword', uniqueTimerID);
  }

  public static async saveUserStatus(tenantID: string, userID: string, status: UserStatus): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'saveUserStatus');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Modify and return the modified document
    await global.database.getCollection<any>(tenantID, 'users').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(userID) },
      { $set: { status } });
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'saveUserStatus', uniqueTimerID);
  }

  public static async saveUserMobileToken(tenantID: string, userID: string,
    params: { mobileToken: string; mobileOs: string; mobileLastChangedOn: Date }): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'saveUserMobileToken');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Modify and return the modified document
    await global.database.getCollection<any>(tenantID, 'users').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(userID) },
      { $set: params });
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'saveUserMobileToken', uniqueTimerID);
  }

  public static async saveUserMobilePhone(tenantID: string, userID: string,
    params: { mobile?: string; phone?: string; }): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'saveUserMobilePhone');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Modify and return the modified document
    await global.database.getCollection<any>(tenantID, 'users').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(userID) },
      { $set: params });
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'saveUserMobilePhone', uniqueTimerID);
  }

  public static async saveUserRole(tenantID: string, userID: string, role: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'saveUserRole');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Modify and return the modified document
    await global.database.getCollection<any>(tenantID, 'users').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(userID) },
      { $set: { role } });
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'saveUserRole', uniqueTimerID);
  }

  public static async saveUserEULA(tenantID: string, userID: string,
    params: { eulaAcceptedHash: string; eulaAcceptedOn: Date; eulaAcceptedVersion: number }): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'saveUserRole');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Modify and return the modified document
    await global.database.getCollection<any>(tenantID, 'users').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(userID) },
      { $set: params });
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'saveUserRole', uniqueTimerID, params);
  }

  public static async saveUserAccountVerification(tenantID: string, userID: string,
    params: { verificationToken?: string; verifiedAt?: Date }): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'saveUserAccountVerification');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Modify and return the modified document
    await global.database.getCollection<any>(tenantID, 'users').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(userID) },
      { $set: params });
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'saveUserAccountVerification', uniqueTimerID, params);
  }

  public static async saveUserAdminData(tenantID: string, userID: string,
    params: { plateID?: string; notificationsActive?: boolean; notifications?: UserNotifications }): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'saveUserAdminData');
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
    Logging.traceEnd(tenantID, MODULE_NAME, 'saveUserAdminData', uniqueTimerID, params);
  }

  public static async saveUserBillingData(tenantID: string, userID: string, billingData: BillingUserData): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'saveUserBillingData');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Set data
    const updatedUserMDB: any = {
      billingData: {
        customerID: billingData.customerID,
        hasSynchroError: billingData.hasSynchroError,
        invoicesLastSynchronizedOn: Utils.convertToDate(billingData.invoicesLastSynchronizedOn),
        lastChangedOn: Utils.convertToDate(billingData.lastChangedOn),
      }
    };
    // Modify and return the modified document
    await global.database.getCollection(tenantID, 'users').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(userID) },
      { $set: updatedUserMDB });
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'saveUserBillingData', uniqueTimerID, billingData);
  }

  public static async saveUserImage(tenantID: string, userID: string, userImageToSave: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'saveUserImage');
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
    Logging.traceEnd(tenantID, MODULE_NAME, 'saveUserImage', uniqueTimerID, userImageToSave);
  }

  public static async getUsers(tenantID: string,
    params: {
      notificationsActive?: boolean; siteIDs?: string[]; excludeSiteID?: string; search?: string;
      includeCarUserIDs?: string[]; excludeUserIDs?: string[]; notAssignedToCarID?: string;
      userIDs?: string[]; email?: string; issuer?: boolean; passwordResetHash?: string; roles?: string[];
      statuses?: string[]; withImage?: boolean; billingUserID?: string; notSynchronizedBillingData?: boolean;
      notifications?: any; noLoginSince?: Date;
    },
    dbParams: DbParams, projectFields?: string[]): Promise<DataResult<User>> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getUsers');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    const filters: FilterParams = {
      '$or': DatabaseUtils.getNotDeletedFilter()
    };
    // Create Aggregation
    const aggregation = [];
    // Filter
    if (params.search) {
      const searchRegex = Utils.escapeSpecialCharsInRegex(params.search);
      filters.$or = [
        { 'name': { $regex: searchRegex, $options: 'i' } },
        { 'firstName': { $regex: searchRegex, $options: 'i' } },
        { 'email': { $regex: searchRegex, $options: 'i' } },
        { 'plateID': { $regex: searchRegex, $options: 'i' } }
      ];
    }
    // Users
    if (!Utils.isEmptyArray(params.userIDs)) {
      filters._id = { $in: params.userIDs.map((userID) => Utils.convertToObjectID(userID)) };
    }
    // Issuer
    if (Utils.objectHasProperty(params, 'issuer') && Utils.isBooleanValue(params.issuer)) {
      filters.issuer = params.issuer;
    }
    // Exclude Users
    if (!Utils.isEmptyArray(params.excludeUserIDs)) {
      filters._id = { $nin: params.excludeUserIDs.map((userID) => Utils.convertToObjectID(userID)) };
    }
    // Email
    if (params.email) {
      filters.email = params.email;
    }
    // Password Reset Hash
    if (params.passwordResetHash) {
      filters.passwordResetHash = params.passwordResetHash;
    }
    // Role
    if (!Utils.isEmptyArray(params.roles)) {
      filters.role = { $in: params.roles };
    }
    // Billing Customer
    if (params.billingUserID) {
      filters['billingData.customerID'] = params.billingUserID;
    }
    // Status (Previously getUsersInError)
    if (params.statuses && params.statuses.length > 0) {
      filters.status = { $in: params.statuses };
    }
    // Notifications
    if (params.notificationsActive) {
      filters.notificationsActive = params.notificationsActive;
    }
    if (params.notifications) {
      for (const key in params.notifications) {
        filters[`notifications.${key}`] = params.notifications[key];
      }
    }
    // Filter on last login to detect inactive user accounts
    if (params.noLoginSince && moment(params.noLoginSince).isValid()) {
      filters.eulaAcceptedOn = { $lte: params.noLoginSince };
      filters.role = UserRole.BASIC;
    }
    // Select non-synchronized billing data
    if (params.notSynchronizedBillingData) {
      filters.$or = [
        { 'billingData': { '$exists': false } },
        { 'billingData.lastChangedOn': { '$exists': false } },
        { 'billingData.lastChangedOn': null },
        { $expr: { $gt: ['$lastChangedOn', '$billingData.lastChangedOn'] } }
      ];
    }
    // Add filters
    aggregation.push({
      $match: filters
    });
    // Add additional filters
    if (params.notAssignedToCarID) {
      const notAssignedToCarIDFilter = { '$or': [] };
      DatabaseUtils.pushUserCarLookupInAggregation({
        tenantID, aggregation, localField: '_id', foreignField: 'userID', asField: 'carUsers'
      });
      // Add Car ID in OR
      const carIDFilter = {};
      carIDFilter['carUsers.carID'] = { $ne: Utils.convertToObjectID(params.notAssignedToCarID) };
      notAssignedToCarIDFilter.$or.push(carIDFilter);
      // Bypass Car ID if users has been removed in UI
      if (params.includeCarUserIDs) {
        const includeCarUserIDsFilter = {};
        includeCarUserIDsFilter['carUsers.userID'] = {
          $in: params.includeCarUserIDs.map((includeCarUserID) =>
            Utils.convertToObjectID(includeCarUserID))
        };
        notAssignedToCarIDFilter.$or.push(includeCarUserIDsFilter);
      }
      // Add
      aggregation.push({
        $match: notAssignedToCarIDFilter
      });
    }
    // Add Site
    if (params.siteIDs || params.excludeSiteID) {
      DatabaseUtils.pushSiteUserLookupInAggregation({
        tenantID, aggregation, localField: '_id', foreignField: 'userID', asField: 'siteusers'
      });
      if (params.siteIDs) {
        aggregation.push({
          $match: { 'siteusers.siteID': { $in: params.siteIDs.map((site) => Utils.convertToObjectID(site)) } }
        });
      } else if (params.excludeSiteID) {
        aggregation.push({
          $match: { 'siteusers.siteID': { $ne: Utils.convertToObjectID(params.excludeSiteID) } }
        });
      }
    }
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
      Logging.traceEnd(tenantID, MODULE_NAME, 'getUsers', uniqueTimerID, usersCountMDB);
      return {
        count: (usersCountMDB.length > 0 ? usersCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Sort
    if (!dbParams.sort) {
      dbParams.sort = { status: -1, name: 1, firstName: 1 };
    }
    aggregation.push({
      $sort: dbParams.sort
    });
    // Skip
    aggregation.push({
      $skip: dbParams.skip
    });
    // Limit
    aggregation.push({
      $limit: dbParams.limit
    });
    // Change ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const usersMDB = await global.database.getCollection<User>(tenantID, 'users')
      .aggregate(aggregation, {
        collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 },
        allowDiskUse: true
      })
      .toArray();
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'getUsers', uniqueTimerID, usersMDB);
    // Ok
    return {
      count: (usersCountMDB.length > 0 ?
        (usersCountMDB[0].count === Constants.DB_RECORD_COUNT_CEIL ? -1 : usersCountMDB[0].count) : 0),
      result: usersMDB
    };
  }

  public static async getTag(tenantID: string, id: string,
    params: { withUser?: boolean; withNbrTransactions?: boolean } = {}, projectFields?: string[]): Promise<Tag> {
    const tagMDB = await UserStorage.getTags(tenantID, {
      tagIDs: [id],
      withUser: params.withUser,
      withNbrTransactions: params.withNbrTransactions,
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return tagMDB.count === 1 ? tagMDB.result[0] : null;
  }

  public static async getTags(tenantID: string,
    params: {
      issuer?: boolean; tagIDs?: string[]; userIDs?: string[]; dateFrom?: Date; dateTo?: Date;
      withUser?: boolean; withNbrTransactions?: boolean; search?: string, defaultTag?: boolean
    },
    dbParams: DbParams, projectFields?: string[]): Promise<DataResult<Tag>> {
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getTags');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Create Aggregation
    const aggregation = [];
    const filters: FilterParams = {
      '$or': DatabaseUtils.getNotDeletedFilter()
    };
    // Filter by other properties
    if (params.search) {
      const searchRegex = Utils.escapeSpecialCharsInRegex(params.search);
      filters.$or = [
        { '_id': { $regex: searchRegex, $options: 'i' } },
        { 'description': { $regex: searchRegex, $options: 'i' } }
      ];
    }
    if (!Utils.isEmptyArray(params.tagIDs)) {
      filters._id = { $in: params.tagIDs };
    }
    if (!Utils.isEmptyArray(params.userIDs)) {
      filters.userID = { $in: params.userIDs.map((userID) => Utils.convertToObjectID(userID)) };
      if (params.defaultTag) {
        filters.default = true;
      }
    }
    if (Utils.objectHasProperty(params, 'issuer') && Utils.isBooleanValue(params.issuer)) {
      filters.issuer = params.issuer;
    }
    if (params.dateFrom && moment(params.dateFrom).isValid()) {
      filters.lastChangedOn = { $gte: new Date(params.dateFrom) };
    }
    if (params.dateTo && moment(params.dateTo).isValid()) {
      filters.lastChangedOn = { $lte: new Date(params.dateTo) };
    }
    if (!Utils.isEmptyJSon(filters)) {
      aggregation.push({ $match: filters });
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
      Logging.traceEnd(tenantID, MODULE_NAME, 'getTags', uniqueTimerID, tagsCountMDB);
      return {
        count: (tagsCountMDB.length > 0 ? tagsCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    if (!dbParams.sort) {
      dbParams.sort = { createdOn: -1 };
    }
    aggregation.push({
      $sort: dbParams.sort
    });
    // Skip
    aggregation.push({
      $skip: dbParams.skip
    });
    // Limit
    aggregation.push({
      $limit: dbParams.limit
    });
    // Transactions
    if (params.withNbrTransactions) {
      let additionalPipeline :Record<string, any>[] = [];
      if (params.withUser) {
        additionalPipeline = [{
          '$match': { 'userID': { $exists: true, $ne: null } }
        }];
      }
      DatabaseUtils.pushTransactionsLookupInAggregation({
        tenantID, aggregation: aggregation, localField: '_id', foreignField: 'tagID',
        count: true, asField: 'transactionsCount', oneToOneCardinality: false,
        objectIDFields: ['createdBy', 'lastChangedBy']
      }, additionalPipeline);
    }
    // Users
    if (params.withUser) {
      DatabaseUtils.pushUserLookupInAggregation({
        tenantID, aggregation: aggregation, asField: 'user', localField: 'userID',
        foreignField: '_id', oneToOneCardinality: true, oneToOneCardinalityNotNull: false
      });
    }
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userID');
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const tagsMDB = await global.database.getCollection<Tag>(tenantID, 'tags')
      .aggregate(aggregation, {
        collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 },
        allowDiskUse: true
      })
      .toArray();
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'getTags', uniqueTimerID, tagsMDB);
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
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getUsers');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Mongodb aggregation creation
    const aggregation = [];
    // Mongodb filter block ($match)
    const match: any = { '$or': DatabaseUtils.getNotDeletedFilter() };
    match.issuer = true;
    if (params.roles) {
      match.role = { '$in': params.roles };
    }
    if (params.search) {
      const searchRegex = Utils.escapeSpecialCharsInRegex(params.search);
      match.$or = [
        { 'name': { $regex: searchRegex, $options: 'i' } },
        { 'firstName': { $regex: searchRegex, $options: 'i' } },
        { 'tags.id': { $regex: searchRegex, $options: 'i' } },
        { 'email': { $regex: searchRegex, $options: 'i' } },
        { 'plateID': { $regex: searchRegex, $options: 'i' } }
      ];
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
    if (!dbParams.sort) {
      dbParams.sort = { status: -1, name: 1, firstName: 1 };
    }
    aggregation.push({
      $sort: dbParams.sort
    });
    // Skip
    aggregation.push({
      $skip: dbParams.skip
    });
    // Limit
    aggregation.push({
      $limit: dbParams.limit
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
    Logging.traceEnd(tenantID, MODULE_NAME, 'getUsers', uniqueTimerID, usersMDB);
    // Ok
    return {
      count: usersMDB.length,
      result: usersMDB
    };
  }

  public static async deleteUser(tenantID: string, id: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'deleteUser');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Delete Site Users
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
    Logging.traceEnd(tenantID, MODULE_NAME, 'deleteUser', uniqueTimerID, { id });
  }

  public static async getUserSites(tenantID: string,
    params: { search?: string; userID: string; siteAdmin?: boolean; siteOwner?: boolean },
    dbParams: DbParams, projectFields?: string[]): Promise<DataResult<SiteUser>> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getUserSites');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Set the filters
    const filters: FilterParams = {};
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
    DatabaseUtils.pushSiteLookupInAggregation({
      tenantID, aggregation, localField: 'siteID', foreignField: '_id',
      asField: 'site', oneToOneCardinality: true, oneToOneCardinalityNotNull: true
    });
    // Another match for searching on Sites
    if (params.search) {
      aggregation.push({
        $match: {
          'site.name': { $regex: params.search, $options: 'i' }
        }
      });
    }
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
      Logging.traceEnd(tenantID, MODULE_NAME, 'getUserSites', uniqueTimerID, sitesCountMDB);
      return {
        count: (sitesCountMDB.length > 0 ? sitesCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Sort
    if (!dbParams.sort) {
      dbParams.sort = { 'site.name': 1 };
    }
    aggregation.push({
      $sort: dbParams.sort
    });
    // Skip
    aggregation.push({
      $skip: dbParams.skip
    });
    // Limit
    aggregation.push({
      $limit: dbParams.limit
    });
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Convert IDs to String
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteID');
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const siteUsersMDB = await global.database.getCollection<{ userID: string; siteID: string; siteAdmin: boolean; siteOwner: boolean; site: Site }>(tenantID, 'siteusers')
      .aggregate(aggregation, {
        collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 },
        allowDiskUse: true
      }).toArray();
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'getUserSites', uniqueTimerID, siteUsersMDB);
    // Ok
    return {
      count: (sitesCountMDB.length > 0 ?
        (sitesCountMDB[0].count === Constants.DB_RECORD_COUNT_CEIL ? -1 : sitesCountMDB[0].count) : 0),
      result: siteUsersMDB
    };
  }

  // Alternative system of registering new users by badging should be found - for now, an empty user is created and saved.
  public static createNewUser(): Partial<User> {
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
        sendBillingSynchronizationFailed: false,
        sendSessionNotStarted: false,
        sendCarCatalogSynchronizationFailed: false,
        sendEndUserErrorNotification: false,
        sendComputeAndApplyChargingProfilesFailed: false,
        sendBillingNewInvoice: false
      },
      role: UserRole.BASIC,
      status: UserStatus.PENDING
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
    const uniqueTimerID = Logging.traceStart(Constants.DEFAULT_TENANT, MODULE_NAME, 'getEndUserLicenseAgreementFromFile');
    let eulaText = null;
    try {
      eulaText = fs.readFileSync(`${global.appRoot}/assets/eula/${language}/end-user-agreement.html`, 'utf8');
    } catch (error) {
      eulaText = fs.readFileSync(`${global.appRoot}/assets/eula/en/end-user-agreement.html`, 'utf8');
    }
    // Build Front End URL
    const frontEndURL = _centralSystemFrontEndConfig.protocol + '://' +
      _centralSystemFrontEndConfig.host + ':' + _centralSystemFrontEndConfig.port.toString();
    // Parse the auth and replace values
    eulaText = Mustache.render(
      eulaText,
      {
        'chargeAngelsURL': frontEndURL
      }
    );
    // Debug
    Logging.traceEnd(Constants.DEFAULT_TENANT, MODULE_NAME, 'getEndUserLicenseAgreementFromFile', uniqueTimerID, eulaText);
    return eulaText;
  }
}
