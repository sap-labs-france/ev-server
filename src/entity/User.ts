import bcrypt from 'bcrypt';
import crypto from 'crypto';
import passwordGenerator from 'password-generator';
import AppError from '../exception/AppError';
import Authorizations from '../authorization/Authorizations';
import Constants from '../utils/Constants';
import Database from '../utils/Database';
import Site from '../types/Site';
import SiteStorage from '../storage/mongodb/SiteStorage';
import TenantHolder from './TenantHolder';
import TransactionStorage from '../storage/mongodb/TransactionStorage';
import UserStorage from '../storage/mongodb/UserStorage';
import Utils from '../utils/Utils';

export default class User extends TenantHolder {
  public id: string;
  private _model: any = {};

  constructor(tenantID: any, user: any) {
    super(tenantID);
    Database.updateUser(user, this._model);
  }

  static hashPasswordBcrypt(password) {
    // eslint-disable-next-line no-undef
    return new Promise((fulfill, reject) => {
      // Generate a salt with 15 rounds
      bcrypt.genSalt(10, (err, salt) => {
        // Hash
        bcrypt.hash(password, salt, (err, hash) => {
          // Error?
          if (err) {
            reject(err);
          } else {
            fulfill(hash);
          }
        });
      });
    });
  }

  static checkPasswordBCrypt(password, hash) {
    // eslint-disable-next-line no-undef
    return new Promise((fulfill, reject) => {
      // Compare
      bcrypt.compare(password, hash, (err, match) => {
        // Error?
        if (err) {
          reject(err);
        } else {
          fulfill(match);
        }
      });
    });
  }

  static getStatusDescription(status) {
    switch (status) {
      case Constants.USER_STATUS_PENDING:
        return 'Pending';
      case Constants.USER_STATUS_LOCKED:
        return 'Locked';
      case Constants.USER_STATUS_BLOCKED:
        return 'Blocked';
      case Constants.USER_STATUS_ACTIVE:
        return 'Active';
      case Constants.USER_STATUS_DELETED:
        return 'Deleted';
      case Constants.USER_STATUS_INACTIVE:
        return 'Inactive';
      default:
        return 'Unknown';
    }
  }

  
  

  

  static hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  static getUser(tenantID, id) {
    return UserStorage.getUser(tenantID, id);
  }

  static getUserByEmail(tenantID, email) {
    return UserStorage.getUserByEmail(tenantID, email);
  }

  static getUserByTagId(tenantID, tagID) {
    return UserStorage.getUserByTagId(tenantID, tagID);
  }

  static getUserImage(tenantID, id) {
    return UserStorage.getUserImage(tenantID, id);
  }

  static getUserImages(tenantID) {
    return UserStorage.getUserImages(tenantID);
  }

  static getUsers(tenantID, params?, limit?, skip?, sort?) {
    return UserStorage.getUsers(tenantID, params, limit, skip, sort);
  }

  static getUsersInError(tenantID, params, limit, skip, sort) {
    return UserStorage.getUsersInError(tenantID, params, limit, skip, sort);
  }

  static getEndUserLicenseAgreement(tenantID, language) {
    return UserStorage.getEndUserLicenseAgreement(tenantID, language);
  }

  static addSitesToUser(tenantID, id, siteIDs) {
    return UserStorage.addSitesToUser(tenantID, id, siteIDs);
  }

  static removeSitesFromUser(tenantID, id, siteIDs) {
    return UserStorage.removeSitesFromUser(tenantID, id, siteIDs);
  }

  public getModel(): any {
    return this._model;
  }

  setEulaAcceptedHash(eulaAcceptedHash) {
    this._model.eulaAcceptedHash = eulaAcceptedHash;
  }

  getEulaAcceptedHash() {
    return this._model.eulaAcceptedHash;
  }

  setEulaAcceptedVersion(eulaAcceptedVersion) {
    this._model.eulaAcceptedVersion = eulaAcceptedVersion;
  }

  getEulaAcceptedVersion() {
    return this._model.eulaAcceptedVersion;
  }

  setEulaAcceptedOn(eulaAcceptedOn) {
    this._model.eulaAcceptedOn = eulaAcceptedOn;
  }

  getEulaAcceptedOn() {
    return this._model.eulaAcceptedOn;
  }

  getID() {
    return this._model.id;
  }

  getName() {
    return this._model.name;
  }

  getFirstName() {
    return this._model.firstName;
  }

  setName(name) {
    this._model.name = name;
  }

  getPassword() {
    return this._model.password;
  }

  setPassword(password) {
    this._model.password = password;
  }

  getPasswordResetHash() {
    return this._model.passwordResetHash;
  }

  setPasswordResetHash(passwordResetHash) {
    this._model.passwordResetHash = passwordResetHash;
  }

  getPasswordWrongNbrTrials() {
    return this._model.passwordWrongNbrTrials;
  }

  setPasswordWrongNbrTrials(passwordWrongNbrTrials) {
    this._model.passwordWrongNbrTrials = passwordWrongNbrTrials;
  }

  getPasswordBlockedUntil() {
    return this._model.passwordBlockedUntil;
  }

  setPasswordBlockedUntil(passwordBlockedUntil) {
    this._model.passwordBlockedUntil = passwordBlockedUntil;
  }

  getLocale() {
    return (this._model.locale ? this._model.locale : Constants.DEFAULT_LOCALE);
  }

  getLanguage() {
    return this.getLocale().substring(0, 2);
  }

  setLocale(locale) {
    this._model.locale = locale;
  }

  public getRole(): string {
    return this._model.role;
  }

  public setRole(role: string) {
    this._model.role = role;
  }

  public setSiteAdmin(siteAdmin: boolean) {
    this._model.siteAdmin = siteAdmin;
  }

  setSites(sites: Site[]) {
    this._model.sites = sites;
  }

  async getSites(): Promise<Site[]> {
    const sites = await SiteStorage.getSites(this.getTenantID(),
      { userID: this.getID() },
      { limit: Constants.NO_LIMIT, skip: 0 });
    return sites.result;
  }

  setFirstName(firstName) {
    this._model.firstName = firstName;
  }

  getFullName(withID = false) {
    return Utils.buildUserFullName(this.getModel(), withID);
  }

  getTagIDs() {
    return this._model.tagIDs;
  }

  setTagIDs(tagIDs) {
    this._model.tagIDs = tagIDs;
  }

  getPlateID() {
    return this._model.plateID;
  }

  setPlateID(plateID) {
    this._model.plateID = plateID;
  }

  addTagID(tagID) {
    if (!this._model.tagIDs) {
      this._model.tagIDs = [];
    }
    this._model.tagIDs.push(tagID);
  }

  getImage() {
    return this._model.image;
  }

  setImage(image) {
    this._model.image = image;
  }

  getEMail() {
    return this._model.email;
  }

  setEMail(email) {
    this._model.email = email;
  }

  getPhone() {
    return this._model.phone;
  }

  setPhone(phone) {
    this._model.phone = phone;
  }

  getMobile() {
    return this._model.mobile;
  }

  setMobile(mobile) {
    this._model.mobile = mobile;
  }

  isNotificationsActive() {
    return this._model.notificationsActive;
  }

  setNotificationsActive(notificationsActive) {
    this._model.notificationsActive = notificationsActive;
  }

  getINumber() {
    return this._model.iNumber;
  }

  setINumber(iNumber) {
    this._model.iNumber = iNumber;
  }

  getCostCenter() {
    return this._model.costCenter;
  }

  setCostCenter(costCenter) {
    this._model.costCenter = costCenter;
  }

  getStatus() {
    return this._model.status;
  }

  setStatus(status) {
    this._model.status = status;
  }

  getCreatedBy() {
    if (this._model.createdBy) {
      return new User(this.getTenantID(), this._model.createdBy);
    }
    return null;
  }

  setCreatedBy(user) {
    this._model.createdBy = user.getModel();
  }

  getCreatedOn() {
    return this._model.createdOn;
  }

  setCreatedOn(createdOn) {
    this._model.createdOn = createdOn;
  }

  getAddress() {
    return this._model.address;
  }

  setAddress(address) {
    this._model.address = address;
  }

  getLastChangedBy() {
    if (this._model.lastChangedBy) {
      return new User(this.getTenantID(), this._model.lastChangedBy);
    }
    return null;
  }

  setLastChangedBy(user) {
    this._model.lastChangedBy = user.getModel();
  }

  getLastChangedOn() {
    return this._model.lastChangedOn;
  }

  setLastChangedOn(lastChangedOn) {
    this._model.lastChangedOn = lastChangedOn;
  }

  setDeleted(deleted) {
    this._model.deleted = deleted;
  }

  isDeleted() {
    return this._model.deleted;
  }

  getVerificationToken() {
    return this._model.verificationToken;
  }

  setVerificationToken(verificationToken) {
    this._model.verificationToken = verificationToken;
  }

  getVerifiedAt() {
    return this._model.verifiedAt;
  }

  setVerifiedAt(verifiedAt) {
    this._model.verifiedAt = verifiedAt;
  }

  async getTransactions(filter?) {
    if (!filter) {
      filter = {};
    }
    // Set the user ID
    filter.userId = this.getID();
    // Get the consumption
    const transactions = await TransactionStorage.getTransactions(this.getTenantID(), filter, Constants.NO_LIMIT);
    // Return
    return transactions;
  }

  save() {
    return UserStorage.saveUser(this.getTenantID(), this.getModel());
  }

  saveImage() {
    return UserStorage.saveUserImage(this.getTenantID(), this.getModel());
  }

  async delete() {
    const transactions = await this.getTransactions();
    if (transactions.count > 0) {
      this.setDeleted(true);
      this.setStatus(Constants.USER_STATUS_DELETED);
      this.setName(Constants.ANONIMIZED_VALUE);
      this.setFirstName(Constants.ANONIMIZED_VALUE);
      this.setAddress(null);
      this.setEMail(this.getID());
      this.setPassword(Constants.ANONIMIZED_VALUE);
      this.setPasswordResetHash(Constants.ANONIMIZED_VALUE);
      this.setPhone(Constants.ANONIMIZED_VALUE);
      this.setMobile(Constants.ANONIMIZED_VALUE);
      this.setNotificationsActive(true);
      this.setINumber(Constants.ANONIMIZED_VALUE);
      this.setCostCenter(Constants.ANONIMIZED_VALUE);
      this.setImage(null);
      // Save User Image
      await this.saveImage();
      // Save User
      return this.save();
    }
    // Delete physically
    return UserStorage.deleteUser(this.getTenantID(), this.getID());

  }
}
