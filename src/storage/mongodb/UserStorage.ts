import Tenant, { TenantComponents } from '../../types/Tenant';
import User, { ImportedUser, StartTransactionUserData, UserMobileData, UserRole, UserStatus } from '../../types/User';
import { UserInError, UserInErrorType } from '../../types/InError';
import global, { DatabaseCount, FilterParams, Image, ImportStatus } from '../../types/GlobalType';

import BackendError from '../../exception/BackendError';
import { BillingUserData } from '../../types/Billing';
import Configuration from '../../utils/Configuration';
import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Eula from '../../types/Eula';
import Logging from '../../utils/Logging';
import Mustache from 'mustache';
import { ObjectId } from 'mongodb';
import TagStorage from './TagStorage';
import UserNotifications from '../../types/UserNotifications';
import { UserSite } from '../../types/Site';
import UserValidatorStorage from '../validator/UserValidatorStorage';
import Utils from '../../utils/Utils';
import fs from 'fs';
import moment from 'moment';

const MODULE_NAME = 'UserStorage';

export default class UserStorage {
  public static async getEndUserLicenseAgreement(tenant: Tenant, language = 'en'): Promise<Eula> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    let currentEulaHash: string;
    // Supported languages?
    if (!Constants.SUPPORTED_LANGUAGES.includes(language)) {
      // Default
      language = Constants.DEFAULT_LANGUAGE;
    }
    // Get current eula
    const currentEula = UserStorage.getEndUserLicenseAgreementFromFile(language);
    // Read DB
    const eulasMDB = await global.database.getCollection<any>(tenant.id, 'eulas')
      .find({ 'language': language })
      .sort({ 'version': -1 })
      .limit(1)
      .toArray() as Eula[];
    // Found?
    if (!Utils.isEmptyArray(eulasMDB)) {
      // Get
      const eulaMDB = eulasMDB[0];
      // Check if eula has changed
      currentEulaHash = Utils.hash(currentEula);
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
        await global.database.getCollection<any>(tenant.id, 'eulas')
          .insertOne(eula);
        await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getEndUserLicenseAgreement', startTime, eula);
        return eula;
      }
      await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getEndUserLicenseAgreement', startTime, eulaMDB);
      return eulaMDB;
    }
    // Create default
    const eula = {
      timestamp: new Date(),
      language: language,
      version: 1,
      text: currentEula,
      hash: Utils.hash(currentEula)
    };
    // Create
    await global.database.getCollection<any>(tenant.id, 'eulas').insertOne(eula);
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getEndUserLicenseAgreement', startTime, eula);
    return eula;
  }

  public static async getUserByTagID(tenant: Tenant, tagID: string = Constants.UNKNOWN_STRING_ID): Promise<User> {
    const tagMDB = await TagStorage.getTag(tenant, tagID, { withUser: true });
    return tagMDB ? tagMDB.user : null;
  }

  public static async getUserByEmail(tenant: Tenant, email: string = Constants.UNKNOWN_STRING_ID): Promise<User> {
    const userMDB = await UserStorage.getUsers(tenant, {
      email: email,
    }, Constants.DB_PARAMS_SINGLE_RECORD);
    return userMDB.count === 1 ? userMDB.result[0] : null;
  }

  public static async getUserByPasswordResetHash(tenant: Tenant, passwordResetHash: string = Constants.UNKNOWN_STRING_ID): Promise<User> {
    const userMDB = await UserStorage.getUsers(tenant, {
      passwordResetHash: passwordResetHash
    }, Constants.DB_PARAMS_SINGLE_RECORD);
    return userMDB.count === 1 ? userMDB.result[0] : null;
  }

  public static async getUser(tenant: Tenant, id: string = Constants.UNKNOWN_OBJECT_ID,
      params: { withImage?: boolean; siteIDs?: string[]; } = {}, projectFields?: string[]): Promise<User> {
    const userMDB = await UserStorage.getUsers(tenant, {
      userIDs: [id],
      withImage: params.withImage,
      siteIDs: params.siteIDs,
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return userMDB.count === 1 ? userMDB.result[0] : null;
  }

  public static async getUserByBillingID(tenant: Tenant, billingID: string): Promise<User> {
    const userMDB = await UserStorage.getUsers(tenant, {
      billingUserID: billingID
    }, Constants.DB_PARAMS_SINGLE_RECORD);
    return userMDB.count === 1 ? userMDB.result[0] : null;
  }

  public static async getUserImage(tenant: Tenant, id: string): Promise<Image> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Read DB
    const userImageMDB = await global.database.getCollection<{ _id: ObjectId; image: string }>(tenant.id, 'userimages')
      .findOne({ _id: DatabaseUtils.convertToObjectID(id) });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getUserImage', startTime, { id }, userImageMDB);
    return {
      id: id, image: (userImageMDB ? userImageMDB.image : null)
    };
  }

  public static async removeSitesFromUser(tenant: Tenant, userID: string, siteIDs: string[]): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // User provided?
    if (userID) {
      // At least one Site
      if (!Utils.isEmptyArray(siteIDs)) {
        // Create the lis
        await global.database.getCollection<any>(tenant.id, 'siteusers').deleteMany({
          'userID': DatabaseUtils.convertToObjectID(userID),
          'siteID': { $in: siteIDs.map((siteID) => DatabaseUtils.convertToObjectID(siteID)) }
        });
      }
    }
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'removeSitesFromUser', startTime, siteIDs);
  }

  public static async addSitesToUser(tenant: Tenant, userID: string, siteIDs: string[]): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // At least one Site
    if (!Utils.isEmptyArray(siteIDs)) {
      const userSitesMDB = [];
      // Create the list
      for (const siteID of siteIDs) {
        userSitesMDB.push({
          '_id': Utils.hash(`${siteID}~${userID}`),
          'userID': DatabaseUtils.convertToObjectID(userID),
          'siteID': DatabaseUtils.convertToObjectID(siteID),
          'siteAdmin': false
        });
      }
      // Execute
      await global.database.getCollection<any>(tenant.id, 'siteusers').insertMany(userSitesMDB);
    }
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'addSitesToUser', startTime, siteIDs);
  }

  public static async clearUserSiteAdmin(tenant: Tenant, userID: string): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Execute
    await global.database.getCollection<any>(tenant.id, 'siteusers').updateMany(
      { userID: DatabaseUtils.convertToObjectID(userID) },
      {
        $set: {
          siteAdmin: false
        }
      });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'clearUserSiteAdmin', startTime, { userID });
  }

  public static async addSiteToUser(tenant: Tenant, userID: string, siteID: string): Promise<string> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    const userSiteMDB = {
      '_id': Utils.hash(`${siteID}~${userID}`),
      'userID': DatabaseUtils.convertToObjectID(userID),
      'siteID': DatabaseUtils.convertToObjectID(siteID),
      'siteAdmin': false
    };
    // Execute
    await global.database.getCollection<any>(tenant.id, 'siteusers').findOneAndUpdate(
      { userID: userSiteMDB.userID, siteID: userSiteMDB.siteID },
      { $set: userSiteMDB },
      { upsert: true }
    );
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'addSiteToUser', startTime, siteID);
    return userSiteMDB._id;
  }

  public static async saveUser(tenant: Tenant, userToSave: User, saveImage = false): Promise<string> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Check if ID or email is provided
    if (!userToSave.id && !userToSave.email) {
      throw new BackendError({
        module: MODULE_NAME,
        method: 'saveUser',
        message: 'User has no ID and no Email'
      });
    }
    // Build Request
    const userFilter: any = {};
    if (userToSave.id) {
      userFilter._id = DatabaseUtils.convertToObjectID(userToSave.id);
    } else {
      userFilter.email = userToSave.email;
    }
    // Properties to save
    // eslint-disable-next-line prefer-const
    const userMDB: any = {
      _id: userToSave.id ? DatabaseUtils.convertToObjectID(userToSave.id) : new ObjectId(),
      issuer: Utils.convertToBoolean(userToSave.issuer),
      name: userToSave.name,
      firstName: userToSave.firstName,
      email: userToSave.email.toLowerCase(),
      phone: userToSave.phone,
      mobile: userToSave.mobile,
      locale: userToSave.locale,
      iNumber: userToSave.iNumber,
      costCenter: userToSave.costCenter,
      importedData: userToSave.importedData,
      notificationsActive: userToSave.notificationsActive,
      authorizationID: userToSave.authorizationID,
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
        sendOicpPatchStatusError: userToSave.notifications ? Utils.convertToBoolean(userToSave.notifications.sendOicpPatchStatusError) : false,
        sendUserAccountInactivity: userToSave.notifications ? Utils.convertToBoolean(userToSave.notifications.sendUserAccountInactivity) : false,
        sendPreparingSessionNotStarted: userToSave.notifications ? Utils.convertToBoolean(userToSave.notifications.sendPreparingSessionNotStarted) : false,
        sendOfflineChargingStations: userToSave.notifications ? Utils.convertToBoolean(userToSave.notifications.sendOfflineChargingStations) : false,
        sendBillingSynchronizationFailed: userToSave.notifications ? Utils.convertToBoolean(userToSave.notifications.sendBillingSynchronizationFailed) : false,
        sendBillingPeriodicOperationFailed: userToSave.notifications ? Utils.convertToBoolean(userToSave.notifications.sendBillingPeriodicOperationFailed) : false,
        sendSessionNotStarted: userToSave.notifications ? Utils.convertToBoolean(userToSave.notifications.sendSessionNotStarted) : false,
        sendCarCatalogSynchronizationFailed: userToSave.notifications ? Utils.convertToBoolean(userToSave.notifications.sendCarCatalogSynchronizationFailed) : false,
        sendEndUserErrorNotification: userToSave.notifications ? Utils.convertToBoolean(userToSave.notifications.sendEndUserErrorNotification) : false,
        sendComputeAndApplyChargingProfilesFailed: userToSave.notifications ? Utils.convertToBoolean(userToSave.notifications.sendComputeAndApplyChargingProfilesFailed) : false,
        sendBillingNewInvoice: userToSave.notifications ? Utils.convertToBoolean(userToSave.notifications.sendBillingNewInvoice) : false,
        sendAccountVerificationNotification: userToSave.notifications ? Utils.convertToBoolean(userToSave.notifications.sendAccountVerificationNotification) : false,
        sendAdminAccountVerificationNotification: userToSave.notifications ? Utils.convertToBoolean(userToSave.notifications.sendAdminAccountVerificationNotification) : false,
      }
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
        coordinates: Utils.hasValidGpsCoordinates(userToSave.address.coordinates) ? userToSave.address.coordinates.map(
          (coordinate) => Utils.convertToFloat(coordinate)) : [],
      };
    }
    // Check Created/Last Changed By
    DatabaseUtils.addLastChangedCreatedProps(userMDB, userToSave);
    // Modify and return the modified document
    await global.database.getCollection<any>(tenant.id, 'users').findOneAndUpdate(
      userFilter,
      { $set: userMDB },
      { upsert: true, returnDocument: 'after' });
    // Delegate saving image as well if specified
    if (saveImage) {
      await UserStorage.saveUserImage(tenant, userMDB._id.toString(), userToSave.image);
    }
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveUser', startTime, userMDB);
    return userMDB._id.toString();
  }

  public static async saveImportedUser(tenant: Tenant, importedUserToSave: ImportedUser): Promise<string> {
    const startTime = Logging.traceDatabaseRequestStart();
    const userMDB = {
      _id: importedUserToSave.id ? DatabaseUtils.convertToObjectID(importedUserToSave.id) : new ObjectId(),
      email: importedUserToSave.email,
      firstName: importedUserToSave.firstName,
      name: importedUserToSave.name,
      status: importedUserToSave.status,
      errorDescription: importedUserToSave.errorDescription,
      importedOn: Utils.convertToDate(importedUserToSave.importedOn),
      importedBy: DatabaseUtils.convertToObjectID(importedUserToSave.importedBy),
      importedData: importedUserToSave.importedData,
      siteIDs: importedUserToSave.siteIDs,
    };
    await global.database.getCollection<any>(tenant.id, 'importedusers').findOneAndUpdate(
      { _id: userMDB._id },
      { $set: userMDB },
      { upsert: true, returnDocument: 'after' }
    );
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveImportedUser', startTime, userMDB);
    return userMDB._id.toString();
  }

  public static async saveImportedUsers(tenant: Tenant, importedUsersToSave: ImportedUser[]): Promise<number> {
    const startTime = Logging.traceDatabaseRequestStart();
    const importedUsersToSaveMDB: any = importedUsersToSave.map((importedUserToSave) => ({
      _id: importedUserToSave.id ? DatabaseUtils.convertToObjectID(importedUserToSave.id) : new ObjectId(),
      email: importedUserToSave.email,
      firstName: importedUserToSave.firstName,
      name: importedUserToSave.name,
      status: importedUserToSave.status,
      errorDescription: importedUserToSave.errorDescription,
      importedOn: Utils.convertToDate(importedUserToSave.importedOn),
      importedBy: DatabaseUtils.convertToObjectID(importedUserToSave.importedBy),
      importedData: importedUserToSave.importedData,
      siteIDs: importedUserToSave.siteIDs,
    }));
    // Insert all at once
    const result = await global.database.getCollection<any>(tenant.id, 'importedusers').insertMany(
      importedUsersToSaveMDB,
      { ordered: false }
    );
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveImportedUsers', startTime, importedUsersToSave);
    return result.insertedCount;
  }

  public static async deleteImportedUser(tenant: Tenant, importedUserID: string): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Delete
    await global.database.getCollection<any>(tenant.id, 'importedusers').deleteOne(
      {
        '_id': DatabaseUtils.convertToObjectID(importedUserID),
      });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'deleteImportedUser', startTime, { id: importedUserID });
  }

  public static async deleteImportedUsers(tenant: Tenant): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Delete
    await global.database.getCollection<any>(tenant.id, 'importedusers').deleteMany({});
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'deleteImportedUsers', startTime, {});
  }

  public static async saveUserPassword(tenant: Tenant, userID: string,
      params: {
        password?: string; passwordResetHash?: string; passwordWrongNbrTrials?: number;
        passwordBlockedUntil?: Date;
      }): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Modify and return the modified document
    await global.database.getCollection<any>(tenant.id, 'users').findOneAndUpdate(
      { '_id': DatabaseUtils.convertToObjectID(userID) },
      { $set: params });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveUserPassword', startTime, { params });
  }

  public static async saveUserStatus(tenant: Tenant, userID: string, status: UserStatus): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Modify and return the modified document
    await global.database.getCollection<any>(tenant.id, 'users').findOneAndUpdate(
      { '_id': DatabaseUtils.convertToObjectID(userID) },
      { $set: { status } });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveUserStatus', startTime, { status });
  }

  public static async saveStartTransactionData(tenant: Tenant, userID: string, startTransactionData: StartTransactionUserData): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Modify and return the modified document
    await global.database.getCollection<any>(tenant.id, 'users').findOneAndUpdate(
      { '_id': DatabaseUtils.convertToObjectID(userID) },
      { $set: { startTransactionData } });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveUserLastSelectedCarID', startTime, { startTransactionData });
  }

  public static async saveUserMobileData(tenant: Tenant, userID: string, params: UserMobileData): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Validate
    const mobileDataMDB = UserValidatorStorage.getInstance().validateUserMobileDataSave(params);
    // Modify and return the modified document
    await global.database.getCollection<any>(tenant.id, 'users').findOneAndUpdate(
      { '_id': DatabaseUtils.convertToObjectID(userID) },
      {
        $set: {
          mobileData: mobileDataMDB
        }
      });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveUserMobileToken', startTime, params);
  }

  public static async saveUserMobilePhone(tenant: Tenant, userID: string,
      params: { mobile?: string; phone?: string; }): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Modify and return the modified document
    await global.database.getCollection<any>(tenant.id, 'users').findOneAndUpdate(
      { '_id': DatabaseUtils.convertToObjectID(userID) },
      { $set: params });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveUserMobilePhone', startTime, params);
  }

  public static async saveUserRole(tenant: Tenant, userID: string, role: string): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Modify and return the modified document
    await global.database.getCollection<any>(tenant.id, 'users').findOneAndUpdate(
      { '_id': DatabaseUtils.convertToObjectID(userID) },
      { $set: { role } });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveUserRole', startTime, { role });
  }

  public static async saveUserEULA(tenant: Tenant, userID: string,
      params: { eulaAcceptedHash: string; eulaAcceptedOn: Date; eulaAcceptedVersion: number }): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Modify and return the modified document
    await global.database.getCollection<any>(tenant.id, 'users').findOneAndUpdate(
      { '_id': DatabaseUtils.convertToObjectID(userID) },
      { $set: params });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveUserEULA', startTime, params);
  }

  public static async saveUserAccountVerification(tenant: Tenant, userID: string,
      params: { verificationToken?: string; verifiedAt?: Date }): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Modify and return the modified document
    await global.database.getCollection<any>(tenant.id, 'users').findOneAndUpdate(
      { '_id': DatabaseUtils.convertToObjectID(userID) },
      { $set: params });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveUserAccountVerification', startTime, params);
  }

  public static async saveUserAdminData(tenant: Tenant, userID: string,
      params: { plateID?: string; notificationsActive?: boolean; notifications?: UserNotifications, technical?: boolean, freeAccess?: boolean }): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
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
    if (Utils.objectHasProperty(params, 'technical')) {
      updatedUserMDB.technical = params.technical;
    }
    if (Utils.objectHasProperty(params, 'freeAccess')) {
      updatedUserMDB.freeAccess = params.freeAccess;
    }
    // Modify and return the modified document
    await global.database.getCollection<any>(tenant.id, 'users').findOneAndUpdate(
      { '_id': DatabaseUtils.convertToObjectID(userID) },
      { $set: updatedUserMDB });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveUserAdminData', startTime, params);
  }

  public static async saveUserBillingData(tenant: Tenant, userID: string, billingData: BillingUserData): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    if (billingData) {
    // Set data
      const updatedUserMDB: any = {
        billingData: {
          customerID: billingData.customerID,
          liveMode: Utils.convertToBoolean(billingData.liveMode),
          hasSynchroError: billingData.hasSynchroError,
          invoicesLastSynchronizedOn: Utils.convertToDate(billingData.invoicesLastSynchronizedOn),
          lastChangedOn: Utils.convertToDate(billingData.lastChangedOn),
        }
      };
      // Modify and return the modified document
      await global.database.getCollection<any>(tenant.id, 'users').findOneAndUpdate(
        { '_id': DatabaseUtils.convertToObjectID(userID) },
        { $set: updatedUserMDB });
    } else {
      await global.database.getCollection<any>(tenant.id, 'users').findOneAndUpdate(
        { '_id': DatabaseUtils.convertToObjectID(userID) },
        { $unset: { billingData: '' } }); // This removes the field from the document
    }
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveUserBillingData', startTime, billingData);
  }

  public static async saveUserImage(tenant: Tenant, userID: string, userImageToSave: string): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    if (!userID) {
      // ID must be provided!
      throw new BackendError({
        module: MODULE_NAME,
        method: 'saveUserImage',
        message: 'User Image has no ID'
      });
    }
    // Modify and return the modified document
    await global.database.getCollection<any>(tenant.id, 'userimages').findOneAndUpdate(
      { '_id': DatabaseUtils.convertToObjectID(userID) },
      { $set: { image: userImageToSave } },
      { upsert: true, returnDocument: 'after' });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveUserImage', startTime, userImageToSave);
  }

  public static async getUsers(tenant: Tenant,
      params: {
        notificationsActive?: boolean; siteIDs?: string[]; excludeSiteID?: string; search?: string;
        userIDs?: string[]; email?: string; issuer?: boolean; passwordResetHash?: string; roles?: string[];
        statuses?: string[]; withImage?: boolean; billingUserID?: string; notSynchronizedBillingData?: boolean;
        withTestBillingData?: boolean; notifications?: any; noLoginSince?: Date; technical?: boolean; freeAccess?: boolean;
      },
      dbParams: DbParams, projectFields?: string[]): Promise<DataResult<User>> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    const filters: FilterParams = {};
    // Create Aggregation
    const aggregation = [];
    // Filter
    if (params.search) {
      filters.$or = [
        { 'name': { $regex: params.search, $options: 'i' } },
        { 'firstName': { $regex: params.search, $options: 'i' } },
        { 'email': { $regex: params.search, $options: 'i' } },
        { 'plateID': { $regex: params.search, $options: 'i' } }
      ];
      if (DatabaseUtils.isObjectID(params.search)) {
        filters.$or.push({ '_id': DatabaseUtils.convertToObjectID(params.search) });
      }
    }
    // Users
    if (!Utils.isEmptyArray(params.userIDs)) {
      filters._id = { $in: params.userIDs.map((userID) => DatabaseUtils.convertToObjectID(userID)) };
    }
    // Issuer
    if (Utils.objectHasProperty(params, 'issuer') && Utils.isBoolean(params.issuer)) {
      filters.issuer = params.issuer;
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
    if (!Utils.isEmptyArray(params.statuses)) {
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
      const billingFilter = {
        $or: [
          { 'billingData': { '$exists': false } },
          { 'billingData.lastChangedOn': { '$exists': false } },
          { 'billingData.lastChangedOn': null },
          { $expr: { $gt: ['$lastChangedOn', '$billingData.lastChangedOn'] } }
        ]
      };
      if (filters.$and) {
        filters.$and.push(billingFilter);
      } else {
        filters.$and = [ billingFilter ];
      }
    }
    // Select users with test billing data
    if (params.withTestBillingData) {
      const expectedLiveMode = !params.withTestBillingData;
      const billingDataAndFilter = [
        { 'billingData': { '$exists': true } },
        { 'billingData.liveMode': { $eq: expectedLiveMode } }
      ];
      if (filters.$and) {
        filters.$and.push(billingDataAndFilter);
      } else {
        filters.$and = billingDataAndFilter;
      }
    }
    // Select (non) technical users
    if (Utils.objectHasProperty(params, 'technical') && Utils.isBoolean(params.technical)) {
      if (params.technical) {
        filters.technical = true;
      } else {
        filters.technical = { $ne: true };
      }
    }
    // Select (non) Free users
    if (Utils.objectHasProperty(params, 'freeAccess') && Utils.isBoolean(params.freeAccess)) {
      if (params.freeAccess) {
        filters.freeAccess = true;
      } else {
        filters.freeAccess = { $ne: true };
      }
    }
    // Add filters
    aggregation.push({
      $match: filters
    });
    // Add Site
    if (params.siteIDs || params.excludeSiteID) {
      DatabaseUtils.pushSiteUserLookupInAggregation({
        tenantID: tenant.id, aggregation, localField: '_id', foreignField: 'userID', asField: 'siteusers'
      });
      if (params.siteIDs) {
        aggregation.push({
          $match: { 'siteusers.siteID': { $in: params.siteIDs.map((site) => DatabaseUtils.convertToObjectID(site)) } }
        });
      }
      if (params.excludeSiteID) {
        aggregation.push({
          $match: { 'siteusers.siteID': { $ne: DatabaseUtils.convertToObjectID(params.excludeSiteID) } }
        });
      }
    }
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const usersCountMDB = await global.database.getCollection<any>(tenant.id, 'users')
      .aggregate([...aggregation, { $count: 'count' }], DatabaseUtils.buildAggregateOptions())
      .toArray() as DatabaseCount[];
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      // Return only the count
      await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getUsers', startTime, usersCountMDB);
      return {
        count: (!Utils.isEmptyArray(usersCountMDB) ? usersCountMDB[0].count : 0),
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
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenant.id, aggregation);
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const usersMDB = await global.database.getCollection<any>(tenant.id, 'users')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as User[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getUsers', startTime, usersMDB);
    return {
      count: DatabaseUtils.getCountFromDatabaseCount(usersCountMDB[0]),
      result: usersMDB,
      projectFields: projectFields
    };
  }

  public static async getImportedUsersCount(tenant: Tenant): Promise<number> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Count documents
    const nbrOfDocuments = await global.database.getCollection<any>(tenant.id, 'importedusers').countDocuments();
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getImportedUsersCount', startTime, {});
    return nbrOfDocuments;
  }

  public static async getImportedUsers(tenant: Tenant,
      params: { status?: ImportStatus; search?: string },
      dbParams: DbParams, projectFields?: string[]): Promise<DataResult<ImportedUser>> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    const filters: FilterParams = {};
    // Create Aggregation
    const aggregation = [];
    // Filter
    if (params.search) {
      filters.$or = [
        { 'name': { $regex: params.search, $options: 'i' } },
        { 'firstName': { $regex: params.search, $options: 'i' } },
        { 'email': { $regex: params.search, $options: 'i' } }
      ];
    }
    // Status
    if (params.status) {
      filters.status = params.status;
    }
    // Add filters
    aggregation.push({
      $match: filters
    });
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const usersImportCountMDB = await global.database.getCollection<any>(tenant.id, 'importedusers')
      .aggregate([...aggregation, { $count: 'count' }], DatabaseUtils.buildAggregateOptions())
      .toArray() as DatabaseCount[];
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      // Return only the count
      await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getImportedUsers', startTime, usersImportCountMDB);
      return {
        count: (!Utils.isEmptyArray(usersImportCountMDB) ? usersImportCountMDB[0].count : 0),
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
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'importedBy');
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenant.id, aggregation);
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const usersImportMDB = await global.database.getCollection<any>(tenant.id, 'importedusers')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as ImportedUser[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getImportedUsers', startTime, usersImportMDB);
    return {
      count: DatabaseUtils.getCountFromDatabaseCount(usersImportCountMDB[0]),
      result: usersImportMDB
    };
  }

  public static async getUsersInError(tenant: Tenant,
      params: { search?: string; roles?: string[]; errorTypes?: string[] },
      dbParams: DbParams, projectFields?: string[]): Promise<DataResult<UserInError>> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Mongodb aggregation creation
    const aggregation = [];
    // Mongodb filter block ($match)
    const filters: FilterParams = {};
    if (params.search) {
      filters.$or = [
        { 'name': { $regex: params.search, $options: 'i' } },
        { 'firstName': { $regex: params.search, $options: 'i' } },
        { 'tags.id': { $regex: params.search, $options: 'i' } },
        { 'email': { $regex: params.search, $options: 'i' } },
        { 'plateID': { $regex: params.search, $options: 'i' } }
      ];
    }
    // Issuer
    filters.issuer = true;
    // Roles
    if (params.roles) {
      filters.role = { '$in': params.roles };
    }
    // Filters
    aggregation.push({ $match: filters });
    // Mongodb Lookup block
    // Add Tags
    DatabaseUtils.pushTagLookupInAggregation({
      tenantID: tenant.id, aggregation, localField: '_id', foreignField: 'userID', asField: 'tags'
    });
    // Mongodb facets block
    // If the organization component is active the system looks for non active users or active users that
    // are not assigned yet to at least one site.
    // If the organization component is not active then the system just looks for non active users.
    const facets: any = { $facet: {} };
    const array = [];
    for (const type of params.errorTypes) {
      if ((type === UserInErrorType.NOT_ASSIGNED && !Utils.isTenantComponentActive(tenant, TenantComponents.ORGANIZATION)) ||
        (type === UserInErrorType.FAILED_BILLING_SYNCHRO && !Utils.isTenantComponentActive(tenant, TenantComponents.BILLING))) {
        continue;
      }
      array.push(`$${type}`);
      facets.$facet[type] = UserStorage.getUserInErrorFacet(tenant, type);
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
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenant.id, aggregation);
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
    const usersMDB = await global.database.getCollection<any>(tenant.id, 'users')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as User[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getUsersInError', startTime, usersMDB);
    return {
      count: usersMDB.length,
      result: usersMDB
    };
  }

  public static async deleteUser(tenant: Tenant, id: string): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Delete User Image
    await global.database.getCollection<any>(tenant.id, 'userimages')
      .findOneAndDelete({ '_id': DatabaseUtils.convertToObjectID(id) });
    // Delete Site Users
    await global.database.getCollection<any>(tenant.id, 'siteusers')
      .deleteMany({ 'userID': DatabaseUtils.convertToObjectID(id) });
    // Delete Tags
    await global.database.getCollection<any>(tenant.id, 'tags')
      .deleteMany({ 'userID': DatabaseUtils.convertToObjectID(id) });
    // Delete Connections
    await global.database.getCollection<any>(tenant.id, 'connections')
      .deleteMany({ 'userId': DatabaseUtils.convertToObjectID(id) });
    // Delete User
    await global.database.getCollection<any>(tenant.id, 'users')
      .findOneAndDelete({ '_id': DatabaseUtils.convertToObjectID(id) });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'deleteUser', startTime, { id });
  }

  public static async getUserSites(tenant: Tenant,
      params: { search?: string; userIDs: string[]; siteIDs?: string[]; siteAdmin?: boolean; siteOwner?: boolean },
      dbParams: DbParams, projectFields?: string[]): Promise<DataResult<UserSite>> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Set the filters
    const filters: FilterParams = {};
    // Filter
    if (!Utils.isEmptyArray(params.userIDs)) {
      filters.userID = {
        $in: params.userIDs.map((userID) => DatabaseUtils.convertToObjectID(userID))
      };
    }
    if (params.siteAdmin) {
      filters.siteAdmin = params.siteAdmin;
    }
    if (params.siteOwner) {
      filters.siteOwner = params.siteOwner;
    }
    // Create Aggregation
    const aggregation: any[] = [];
    // Filter on authorized sites
    if (!Utils.isEmptyArray(params.siteIDs)) {
      aggregation.push({
        $match: {
          siteID: {
            $in: params.siteIDs.map((siteID) => DatabaseUtils.convertToObjectID(siteID))
          }
        }
      });
    }
    // Filter
    aggregation.push({
      $match: filters
    });
    // Get Sites
    DatabaseUtils.pushSiteLookupInAggregation({
      tenantID: tenant.id, aggregation, localField: 'siteID', foreignField: '_id',
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
    const userSitesCountMDB = await global.database.getCollection<any>(tenant.id, 'siteusers')
      .aggregate([...aggregation, { $count: 'count' }], DatabaseUtils.buildAggregateOptions())
      .toArray() as DatabaseCount[];
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getUserSites', startTime, userSitesCountMDB);
      return {
        count: (!Utils.isEmptyArray(userSitesCountMDB) ? userSitesCountMDB[0].count : 0),
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
    const userSitesMDB = await global.database.getCollection<any>(tenant.id, 'siteusers')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as UserSite[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getUserSites', startTime, userSitesMDB);
    return {
      count: DatabaseUtils.getCountFromDatabaseCount(userSitesCountMDB[0]),
      result: userSitesMDB,
      projectFields: projectFields
    };
  }

  // Alternative system of registering new users by badging should be found - for now, an empty user is created and saved.
  public static createNewUser(): Partial<User> {
    return {
      id: new ObjectId().toString(),
      issuer: true,
      name: 'Unknown',
      firstName: 'User',
      mobile: '',
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
        sendUserAccountInactivity: true,
        sendPreparingSessionNotStarted: true,
        sendSessionNotStarted: true,
        sendBillingNewInvoice: true,
        // Admin
        sendNewRegisteredUser: false,
        sendUnknownUserBadged: false,
        sendChargingStationStatusError: false,
        sendChargingStationRegistered: false,
        sendOcpiPatchStatusError: false,
        sendOicpPatchStatusError: false,
        sendOfflineChargingStations: false,
        sendBillingSynchronizationFailed: false,
        sendBillingPeriodicOperationFailed: false,
        sendCarCatalogSynchronizationFailed: false,
        sendEndUserErrorNotification: false,
        sendComputeAndApplyChargingProfilesFailed: false,
        sendAccountVerificationNotification: false,
        sendAdminAccountVerificationNotification: false,
      },
      role: UserRole.BASIC,
      status: UserStatus.PENDING
    };
  }

  private static getUserInErrorFacet(tenant: Tenant, errorType: string) {
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
              from: DatabaseUtils.getCollectionName(tenant.id, 'siteusers'),
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
      default:
        return [];
    }
  }

  private static getEndUserLicenseAgreementFromFile(language = 'en'): string {
    const centralSystemFrontEndConfig = Configuration.getCentralSystemFrontEndConfig();
    const startTime = Logging.traceDatabaseRequestStart();
    let eulaText = null;
    try {
      eulaText = fs.readFileSync(`${global.appRoot}/assets/eula/${language}/end-user-agreement.html`, 'utf8');
    } catch (error) {
      eulaText = fs.readFileSync(`${global.appRoot}/assets/eula/en/end-user-agreement.html`, 'utf8');
    }
    // Build Front End URL
    const frontEndURL = centralSystemFrontEndConfig.protocol + '://' +
      centralSystemFrontEndConfig.host + ':' + centralSystemFrontEndConfig.port.toString();
    // Parse the auth and replace values
    eulaText = Mustache.render(
      eulaText,
      {
        'chargeAngelsURL': frontEndURL
      }
    );
    void Logging.traceDatabaseRequestEnd(Constants.DEFAULT_TENANT_OBJECT, MODULE_NAME, 'getEndUserLicenseAgreementFromFile', startTime, eulaText);
    return eulaText;
  }
}
