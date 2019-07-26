import axios from 'axios';
import bcrypt from 'bcrypt';
import ClientOAuth2 from 'client-oauth2';
import crypto from 'crypto';
import { Request } from 'express';
import fs from 'fs';
import _ from 'lodash';
import { ObjectID } from 'mongodb';
import passwordGenerator = require('password-generator');
import path from 'path';
import url from 'url';
import uuidV4 from 'uuid/v4';
import AppError from '../exception/AppError';
import Authorizations from '../authorization/Authorizations';
import BackendError from '../exception/BackendError';
import Configuration from './Configuration';
import Constants from './Constants';
import { HttpUserRequest } from '../types/requests/HttpUserRequest';
import Logging from './Logging';
import Tenant from '../entity/Tenant';
import TenantStorage from '../storage/mongodb/TenantStorage';
import User from '../types/User';
import UserToken from '../types/UserToken';

const _centralSystemFrontEndConfig = Configuration.getCentralSystemFrontEndConfig();
const _tenants = [];

export default class Utils {
  static generateGUID() {
    return uuidV4();
  }

  static generateTagID(name, firstName) {
    let tagID = '';
    if (name && name.length > 0) {
      tagID = name[0].toUpperCase();
    } else {
      tagID = 'S';
    }
    if (firstName && firstName.length > 0) {
      tagID += firstName[0].toUpperCase();
    } else {
      tagID += 'F';
    }
    tagID += Math.floor((Math.random() * 2147483648) + 1);
    return tagID;
  }

  public static isIterable(obj): boolean {
    if (obj) {
      return typeof obj[Symbol.iterator] === 'function';
    }
    return false;
  }

  // Temporary method for Revenue Cloud concept
  static async pushTransactionToRevenueCloud(action, transaction, user: User, actionOnUser: User) {
    // Refund Transaction
    const cloudRevenueAuth = new ClientOAuth2({
      clientId: 'sb-revenue-cloud!b1122|revenue-cloud!b1532',
      clientSecret: 'BtuZkWlC/58HmEMoqBCHc0jBoVg=',
      accessTokenUri: 'https://seed-innovation.authentication.eu10.hana.ondemand.com/oauth/token'
    });
    // Get the token
    const authResponse = await cloudRevenueAuth.credentials.getToken();
    // Send HTTP request
    const result = await axios.post(
      'https://eu10.revenue.cloud.sap/api/usage-record/v1/usage-records',
      {
        'metricId': 'ChargeCurrent_Trial',
        'quantity': transaction.getStopTotalConsumption() / 1000,
        'startedAt': transaction.getstartedAt(),
        'endedAt': transaction.getendedAt(),
        'userTechnicalId': transaction.getTagID()
      },
      {
        'headers': {
          'Authorization': 'Bearer ' + authResponse.accessToken,
          'Content-Type': 'application/json'
        }
      }
    );
    // Log
    Logging.logSecurityInfo({
      user, actionOnUser, action,
      tenantID: transaction.getTenantID(),
      source: transaction.getChargeBoxID(),
      module: 'Utils', method: 'pushTransactionToRevenueCloud',
      message: `Transaction ID '${transaction.getID()}' has been refunded successfully`,
      detailedMessages: result.data
    });
  }

  static async normalizeAndCheckSOAPParams(headers, req) {
    // Normalize
    Utils._normalizeOneSOAPParam(headers, 'chargeBoxIdentity');
    Utils._normalizeOneSOAPParam(headers, 'Action');
    Utils._normalizeOneSOAPParam(headers, 'To');
    Utils._normalizeOneSOAPParam(headers, 'From.Address');
    Utils._normalizeOneSOAPParam(headers, 'ReplyTo.Address');
    // Parse the request (lower case for fucking charging station DBT URL registration)
    const urlParts = url.parse(req.url.toLowerCase(), true);
    const tenantID = urlParts.query.tenantid;
    // Check
    await Utils.checkTenant(tenantID);
    // Set the Tenant ID
    headers.tenantID = tenantID;
  }

  static _normalizeOneSOAPParam(headers, name) {
    const val = _.get(headers, name);
    if (val && val.$value) {
      _.set(headers, name, val.$value);
    }
  }

  static async checkTenant(tenantID) {
    if (!tenantID) {
      throw new BackendError(null, 'The Tenant ID is mandatory');
    }
    // Check in cache
    if (_tenants.indexOf(tenantID) >= 0) {
      return;
    }
    if (tenantID !== Constants.DEFAULT_TENANT) {
      // Valid Object ID?
      if (!ObjectID.isValid(tenantID)) {
        throw new BackendError(null, `Invalid Tenant ID '${tenantID}'`);
      }
      // Get the Tenant
      const tenant = await Tenant.getTenant(tenantID);
      if (!tenant) {
        throw new BackendError(null, `Invalid Tenant ID '${tenantID}'`);
      }
    }
    _tenants.push(tenantID);
  }

  static convertToDate(date): Date {
    // Check
    if (!date) {
      return date;
    }
    // Check Type
    if (!(date instanceof Date)) {
      return new Date(date);
    }
    return date;
  }

  static isEmptyJSon(document) {
    // Empty?
    if (!document) {
      return true;
    }
    // Check type
    if (typeof document !== 'object') {
      return true;
    }
    // Check
    return Object.keys(document).length === 0;
  }

  static removeExtraEmptyLines(tab) {
    // Start from the end
    for (let i = tab.length - 1; i > 0; i--) {
      // Two consecutive empty lines?
      if (tab[i].length === 0 && tab[i - 1].length === 0) {
        // Remove the last one
        tab.splice(i, 1);
      }
      // Check last line
      if (i === 1 && tab[i - 1].length === 0) {
        // Remove the first one
        tab.splice(i - 1, 1);
      }
    }
  }

  static isComponentActiveFromToken(userToken: UserToken, componentName: string): boolean {
    return userToken.activeComponents.includes(componentName);
  }

  static convertToObjectID(id): ObjectID {
    let changedID = id;
    // Check
    if (typeof id === 'string') {
      // Create Object
      changedID = new ObjectID(id);
    }
    return changedID;
  }

  static convertToInt(id): number {
    let changedID = id;
    if (!id) {
      return 0;
    }
    // Check
    if (typeof id === 'string') {
      // Create Object
      changedID = parseInt(id);
    }
    return changedID;
  }

  static convertToFloat(id): number {
    let changedID = id;
    if (!id) {
      return 0;
    }
    // Check
    if (typeof id === 'string') {
      // Create Object
      changedID = parseFloat(id);
    }
    return changedID;
  }

  public static convertUserToObjectID(user: User): ObjectID | null { // TODO: Fix this method...
    let userID = null;
    // Check Created By
    if (user) {
      // Check User Model
      if (typeof user === 'object' &&
        user.constructor.name !== 'ObjectID') {
        // This is the User Model
        userID = Utils.convertToObjectID(user.id);
      }
      // Check String
      if (typeof user === 'string') {
        // This is a String
        userID = Utils.convertToObjectID(user);
      }
    }
    return userID;
  }

  public static isEmptyArray(array): boolean {
    if (Array.isArray(array) && array.length > 0) {
      return false;
    }
    return true;
  }

  static buildUserFullName(user: User, withID = true, withEmail = false, inversedName = false) {
    let fullName: string;
    if (!user || !user.name) {
      return 'Unknown';
    }
    if (inversedName) {
      if (user.firstName) {
        fullName = `${user.name}, ${user.firstName}`;
      } else {
        fullName = user.name;
      }
    } else {
      // eslint-disable-next-line no-lonely-if
      if (user.firstName) {
        fullName = `${user.firstName} ${user.name}`;
      } else {
        fullName = user.name;
      }
    }
    if (withID && user.iNumber) {
      fullName += ` (${user.iNumber})`;
    }

    if (withEmail && user.email) {
      fullName += `; ${user.email}`;
    }

    return fullName;
  }

  // Save the users in file
  static saveFile(filename, content) {
    // Save
    fs.writeFileSync(path.join(__dirname, filename), content, 'UTF-8');
  }

  static getRandomInt() {
    return Math.floor((Math.random() * 2147483648) + 1); // INT32 (signed: issue in Schneider)
  }

  static buildEvseURL(subdomain) {
    if (subdomain) {
      return `${_centralSystemFrontEndConfig.protocol}://${subdomain}.${_centralSystemFrontEndConfig.host}:${_centralSystemFrontEndConfig.port}`;
    }
    return `${_centralSystemFrontEndConfig.protocol}://${_centralSystemFrontEndConfig.host}:${
      _centralSystemFrontEndConfig.port}`;
  }

  static async buildEvseUserURL(tenantID: string, user: User, hash = '') {

    const tenant = await TenantStorage.getTenant(tenantID);
    const _evseBaseURL = Utils.buildEvseURL(tenant.getSubdomain());
    // Add
    return _evseBaseURL + '/users?UserID=' + user.id + hash;
  }

  static async buildEvseChargingStationURL(chargingStation, hash = '') {
    const tenant = await chargingStation.getTenant();
    const _evseBaseURL = Utils.buildEvseURL(tenant.getSubdomain());

    return _evseBaseURL + '/charging-stations?ChargingStationID=' + chargingStation.getID() + hash;
  }

  static async buildEvseTransactionURL(chargingStation, transactionId, hash = '') {
    const tenant = await chargingStation.getTenant();
    const _evseBaseURL = Utils.buildEvseURL(tenant.getSubdomain());
    // Add
    return _evseBaseURL + '/transactions?TransactionID=' + transactionId + hash;
  }

  static isServerInProductionMode() {
    const env = process.env.NODE_ENV || 'dev';
    return (env === 'production');
  }

  static hideShowMessage(message): string {
    // Check Prod
    if (Utils.isServerInProductionMode()) {
      return 'An unexpected server error occurred. Check the server\'s logs!';
    }
    return message;
  }

  public static getRequestIP(request): string {
    if (request.connection.remoteAddress) {
      return request.connection.remoteAddress;
    } else if (request.headers.host) {
      const host = request.headers.host.split(':', 2);
      const ip = host[0];
      return ip;
    }
  }

  public static checkRecordLimit(recordLimit: number | string): number {
    // String?
    if (typeof recordLimit === 'string') {
      recordLimit = parseInt(recordLimit);
    }
    // Not provided?
    if (isNaN(recordLimit) || recordLimit < 0 || recordLimit === 0) {
      recordLimit = Constants.DB_RECORD_COUNT_DEFAULT;
    }
    // Check max
    if (recordLimit > Number.MAX_SAFE_INTEGER) {
      recordLimit = Number.MAX_SAFE_INTEGER;
    }
    return recordLimit;
  }

  static roundTo(number, scale) {
    return parseFloat(number.toFixed(scale));
  }

  static firstLetterInUpperCase(value): string {
    return value[0].toUpperCase() + value.substring(1);
  }

  public static checkRecordSkip(recordSkip: number | string): number {
    // String?
    if (typeof recordSkip === 'string') {
      recordSkip = parseInt(recordSkip);
    }
    // Not provided?
    if (isNaN(recordSkip) || recordSkip < 0) {
      // Default
      recordSkip = 0;
    }
    return recordSkip;
  }

  static generateToken(email) {
    return crypto.createHash('sha1').update(`${new Date().toISOString()}~${email}`).digest('hex');
  }

  /**
   * Duplicate a JSON object
   * @param src
   * @returns a copy of the source
   */
  static duplicateJSON(src): any {
    if (!src || typeof src !== 'object') {
      return src;
    }
    // Recreate all of it
    return JSON.parse(JSON.stringify(src));
  }

  static getRoleNameFromRoleID(roleID) {
    switch (roleID) {
      case Constants.ROLE_BASIC:
        return 'Basic';
      case Constants.ROLE_DEMO:
        return 'Demo';
      case Constants.ROLE_ADMIN:
        return 'Admin';
      case Constants.ROLE_SUPER_ADMIN:
        return 'Super Admin';
      default:
        return 'Unknown';
    }
  }

  public static async hashPasswordBcrypt(password: string): Promise<string> {
    // eslint-disable-next-line no-undef
    return await new Promise((fulfill, reject) => {
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

  public static async checkPasswordBCrypt(password, hash): Promise<boolean> {
    // eslint-disable-next-line no-undef
    return await new Promise((fulfill, reject) => {
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

  static isPasswordStrongEnough(password) {
    const uc = password.match(Constants.PWD_UPPERCASE_RE);
    const lc = password.match(Constants.PWD_LOWERCASE_RE);
    const n = password.match(Constants.PWD_NUMBER_RE);
    const sc = password.match(Constants.PWD_SPECIAL_CHAR_RE);
    return password.length >= Constants.PWD_MIN_LENGTH &&
      uc && uc.length >= Constants.PWD_UPPERCASE_MIN_COUNT &&
      lc && lc.length >= Constants.PWD_LOWERCASE_MIN_COUNT &&
      n && n.length >= Constants.PWD_NUMBER_MIN_COUNT &&
      sc && sc.length >= Constants.PWD_SPECIAL_MIN_COUNT;
  }


  static generatePassword() {
    let password = '';
    const randomLength = Math.floor(Math.random() * (Constants.PWD_MAX_LENGTH - Constants.PWD_MIN_LENGTH)) + Constants.PWD_MIN_LENGTH;
    while (!Utils.isPasswordStrongEnough(password)) {
      // eslint-disable-next-line no-useless-escape
      password = passwordGenerator(randomLength, false, /[\w\d!#\$%\^&\*\.\?\-]/);
    }
    return password;
  }

  public static getStatusDescription(status: string): string {
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

  public static checkIfSiteValid(filteredRequest: any, req: Request): void {
    if (req.method !== 'POST' && !filteredRequest.id) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'Site ID is mandatory', Constants.HTTP_GENERAL_ERROR,
        'SiteService', '_checkIfSiteValid',
        req.user.id);
    }
    if (!filteredRequest.name) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'Site Name is mandatory',
        Constants.HTTP_GENERAL_ERROR,
        'SiteService', '_checkIfSiteValid',
        req.user.id, filteredRequest.id);
    }
    if (!filteredRequest.companyID) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'Company ID is mandatory for the Site',
        Constants.HTTP_GENERAL_ERROR,
        'SiteService', '_checkIfSiteValid',
        req.user.id, filteredRequest.id);
    }
  }

  public static checkIfSiteAreaValid(filteredRequest: any, req: Request): void {
    if (req.method !== 'POST' && !filteredRequest.id) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'Site Area ID is mandatory', Constants.HTTP_GENERAL_ERROR,
        'SiteAreaService', '_checkIfSiteAreaValid',
        req.user.id);
    }
    if (!filteredRequest.name) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'Site Area is mandatory', Constants.HTTP_GENERAL_ERROR,
        'SiteAreaService', '_checkIfSiteAreaValid',
        req.user.id, filteredRequest.id);
    }
    if (!filteredRequest.siteID) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'Site ID is mandatory', Constants.HTTP_GENERAL_ERROR,
        'SiteAreaService', '_checkIfSiteAreaValid',
        req.user.id, filteredRequest.id);
    }
  }

  public static checkIfCompanyValid(filteredRequest: any, req: Request): void {
    if (req.method !== 'POST' && !filteredRequest.id) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'Company ID is mandatory', Constants.HTTP_GENERAL_ERROR,
        'CompanyService', 'checkIfCompanyValid',
        req.user.id);
    }
    if (!filteredRequest.name) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'Company Name is mandatory', Constants.HTTP_GENERAL_ERROR,
        'CompanyService', 'checkIfCompanyValid',
        req.user.id, filteredRequest.id);
    }
  }

  public static checkIfVehicleValid(filteredRequest, req: Request) {
    // Update model?
    if (req.method !== 'POST' && !filteredRequest.id) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'Vehicle ID is mandatory', Constants.HTTP_GENERAL_ERROR,
        'Vehicle', 'checkIfVehicleValid',
        req.user.id);
    }
    if (!filteredRequest.type) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'Vehicle Type is mandatory', Constants.HTTP_GENERAL_ERROR,
        'Vehicle', 'checkIfVehicleValid',
        req.user.id, filteredRequest.id);
    }
    if (!filteredRequest.model) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'Vehicle Model is mandatory', Constants.HTTP_GENERAL_ERROR,
        'Vehicle', 'checkIfVehicleValid',
        req.user.id, filteredRequest.id);
    }
    if (!filteredRequest.vehicleManufacturerID) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'Vehicle Manufacturer is mandatory', Constants.HTTP_GENERAL_ERROR,
        'Vehicle', 'checkIfVehicleValid',
        req.user.id, filteredRequest.id);
    }
  }

  public static checkIfVehicleManufacturerValid(filteredRequest, req) {
    // Update model?
    if (req.method !== 'POST' && !filteredRequest.id) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'Vehicle Manufacturer ID is mandatory', Constants.HTTP_GENERAL_ERROR,
        'VehicleManufacturer', 'checkIfVehicleManufacturerValid',
        req.user.id);
    }
    if (!filteredRequest.name) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'Vehicle Manufacturer Name is mandatory', Constants.HTTP_GENERAL_ERROR,
        'VehicleManufacturer', 'checkIfVehicleManufacturerValid',
        req.user.id, filteredRequest.id);
    }
  }

  public static checkIfUserValid(filteredRequest: Partial<HttpUserRequest>, user: User, req: Request) {
    const tenantID = req.user.tenantID;
    if (!tenantID) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'Tenant is mandatory', Constants.HTTP_GENERAL_ERROR,
        'Users', 'checkIfUserValid');
    }
    // Update model?
    if (req.method !== 'POST' && !filteredRequest.id) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'User ID is mandatory', Constants.HTTP_GENERAL_ERROR,
        'Users', 'checkIfUserValid',
        req.user.id);
    }
    // Creation?
    if (req.method === 'POST') {
      if (!filteredRequest.role) {
        filteredRequest.role = Constants.ROLE_BASIC;
      }
    } else {
      // Do not allow to change if not Admin
      if (!Authorizations.isAdmin(req.user.role)) {
        filteredRequest.role = user.role;
      }
    }
    if (req.method === 'POST' && !filteredRequest.status) {
      filteredRequest.status = Constants.USER_STATUS_BLOCKED;
    }
    // Creation?
    if ((filteredRequest.role !== Constants.ROLE_BASIC) && (filteredRequest.role !== Constants.ROLE_DEMO) &&
        !Authorizations.isAdmin(req.user.role) && !Authorizations.isSuperAdmin(req.user.role)) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Only Admins can assign the role '${Utils.getRoleNameFromRoleID(filteredRequest.role)}'`, Constants.HTTP_GENERAL_ERROR,
        'Users', 'checkIfUserValid', req.user.id, filteredRequest.id);
    }
    // Only Basic, Demo, Admin user other Tenants (!== default)
    if (tenantID !== 'default' && filteredRequest.role && filteredRequest.role === Constants.ROLE_SUPER_ADMIN) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'User cannot have the Super Admin role in this Tenant', Constants.HTTP_GENERAL_ERROR,
        'Users', 'checkIfUserValid', req.user.id, filteredRequest.id);
    }
    // Only Admin and Super Admin can use role different from Basic
    if ((filteredRequest.role === Constants.ROLE_ADMIN || filteredRequest.role === Constants.ROLE_SUPER_ADMIN) &&
        !Authorizations.isAdmin(req.user.role) && !Authorizations.isSuperAdmin(req.user.role)) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `User without role Admin or Super Admin tried to ${filteredRequest.id ? 'update' : 'create'} an User with the '${Utils.getRoleNameFromRoleID(filteredRequest.role)}' role`, Constants.HTTP_GENERAL_ERROR,
        'Users', 'checkIfUserValid', req.user.id, filteredRequest.id);
    }
    if (!filteredRequest.name) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'User Last Name is mandatory', Constants.HTTP_GENERAL_ERROR,
        'Users', 'checkIfUserValid', req.user.id, filteredRequest.id);
    }
    if (req.method === 'POST' && !filteredRequest.email) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'User Email is mandatory', Constants.HTTP_GENERAL_ERROR,
        'Users', 'checkIfUserValid', req.user.id, filteredRequest.id);
    }
    if (req.method === 'POST' && !Utils._isUserEmailValid(filteredRequest.email)) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `User Email ${filteredRequest.email} is not valid`, Constants.HTTP_GENERAL_ERROR,
        'Users', 'checkIfUserValid', req.user.id, filteredRequest.id);
    }
    if (filteredRequest.password && !Utils._isPasswordValid(filteredRequest.password)) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'User Password is not valid', Constants.HTTP_GENERAL_ERROR,
        'Users', 'checkIfUserValid', req.user.id, filteredRequest.id);
    }
    if (filteredRequest.phone && !Utils._isPhoneValid(filteredRequest.phone)) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `User Phone ${filteredRequest.phone} is not valid`, Constants.HTTP_GENERAL_ERROR,
        'Users', 'checkIfUserValid', req.user.id, filteredRequest.id);
    }
    if (filteredRequest.mobile && !Utils._isPhoneValid(filteredRequest.mobile)) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `User Mobile ${filteredRequest.mobile} is not valid`, Constants.HTTP_GENERAL_ERROR,
        'Users', 'checkIfUserValid', req.user.id, filteredRequest.id);
    }
    if (filteredRequest.iNumber && !Utils._isINumberValid(filteredRequest.iNumber)) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `User I-Number ${filteredRequest.iNumber} is not valid`, Constants.HTTP_GENERAL_ERROR,
        'Users', 'checkIfUserValid', req.user.id, filteredRequest.id);
    }
    if (filteredRequest.tagIDs) {
      // Check
      if (!Array.isArray(filteredRequest.tagIDs)) { // TODO: this piece is not very robust, and mutates filteredRequest even tho it's named "check". Should be changed, honestly
        if (filteredRequest.tagIDs !== '') {
          filteredRequest.tagIDs = filteredRequest.tagIDs.split(',');
        }
      }
      if (!Utils._areTagIDsValid(filteredRequest.tagIDs)) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `User Tags ${filteredRequest.tagIDs} is/are not valid`, Constants.HTTP_GENERAL_ERROR,
          'Users', 'checkIfUserValid', req.user.id, filteredRequest.id);
      }
    }
    // At least one tag ID
    if (!filteredRequest.tagIDs || filteredRequest.tagIDs.length === 0) {
      filteredRequest.tagIDs = [Utils.generateTagID(filteredRequest.name, filteredRequest.firstName)];
    }
    if (filteredRequest.plateID && !Utils._isPlateIDValid(filteredRequest.plateID)) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `User Plate ID ${filteredRequest.plateID} is not valid`, Constants.HTTP_GENERAL_ERROR,
        'Users', 'checkIfUserValid', req.user.id, filteredRequest.id);
    }
  }

  private static _isPasswordValid(password: string): boolean {
    // eslint-disable-next-line no-useless-escape
    return /(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!#@:;,<>\/''\$%\^&\*\.\?\-_\+\=\(\)])(?=.{8,})/.test(password);
  }

  private static _isUserEmailValid(email: string) {
    return /^(([^<>()\[\]\\.,;:\s@']+(\.[^<>()\[\]\\.,;:\s@']+)*)|('.+'))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(email);
  }

  private static _areTagIDsValid(tagIDs: string[]|string) {
    if (typeof tagIDs === 'string') {
      return /^[A-Za-z0-9,]*$/.test(tagIDs);
    }
    return tagIDs.filter((tagID) => {
      return /^[A-Za-z0-9,]*$/.test(tagID);
    }).length === tagIDs.length;
  }

  private static _isPhoneValid(phone: string): boolean {
    return /^\+?([0-9] ?){9,14}[0-9]$/.test(phone);
  }

  private static _isINumberValid(iNumber) {
    return /^[A-Z]{1}[0-9]{6}$/.test(iNumber);
  }

  private static _isPlateIDValid(plateID) {
    return /^[A-Z0-9-]*$/.test(plateID);
  }
}
