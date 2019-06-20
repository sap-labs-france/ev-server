import { ObjectID } from 'mongodb';
import Configuration from './Configuration';
import uuidV4 from 'uuid/v4';
import Constants from './Constants';
import BackendError from '../exception/BackendError';
import crypto from 'crypto';
import ClientOAuth2 from 'client-oauth2';
import axios from 'axios';
import url from 'url';
import fs from 'fs';
import path from 'path';
import Logging from './Logging';
import Tenant from '../entity/Tenant';
import SourceMap from 'source-map-support';
import _ from 'lodash';

// import User from '../entity/User';
SourceMap.install();

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
  static async pushTransactionToRevenueCloud(action, transaction, user, actionOnUser) {
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
    // Parse the request
    const urlParts = url.parse(req.url, true);
    const tenantID = urlParts.query.TenantID;
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
    // Check in cache
    if (_tenants.indexOf(tenantID) >= 0) {
      return;
    }
    // Check Tenant ID
    if (!tenantID) {
      // Error
      throw new BackendError(null, `The Tenant ID is mandatory`);
    }
    // Check if not default tenant?
    if (tenantID !== Constants.DEFAULT_TENANT) {
      // Check if object id is valid
      if (!ObjectID.isValid(tenantID)) {
        // Error
        throw new BackendError(null, `Invalid Tenant ID '${tenantID}'`);
      }
      // Check if the Tenant exists
      const tenant = await Tenant.getTenant(tenantID);
      // Found?
      if (!tenant) {
        // Error
        throw new BackendError(null, `Invalid Tenant ID '${tenantID}'`);
      }
    }
    // Ok
    _tenants.push(tenantID);
  }

  static convertToDate(date) {
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

  static convertToObjectID(id) {
    let changedID = id;
    // Check
    if (typeof id === "string") {
      // Create Object
      changedID = new ObjectID(id);
    }
    return changedID;
  }

  static convertToInt(id) {
    let changedID = id;
    if (!id) {
      return 0;
    }
    // Check
    if (typeof id === "string") {
      // Create Object
      changedID = parseInt(id);
    }
    return changedID;
  }

  static convertToFloat(id) {
    let changedID = id;
    if (!id) {
      return 0;
    }
    // Check
    if (typeof id === "string") {
      // Create Object
      changedID = parseFloat(id);
    }
    return changedID;
  }

  public static convertUserToObjectID(user: any): ObjectID|null { // TODO Fix this method...
    let userID = null;
    // Check Created By
    if (user) {
      // Set
      userID = user;
      // Check User Model
      if (typeof user === "object" &&
        user.constructor.name !== "ObjectID" && ('id' in user || 'getID' in user)) {
        // This is the User Model
        userID = Utils.convertToObjectID('id' in user ? user.id : user.getID());
      }
      // Check String
      if (typeof user === "string") {
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

  static buildUserFullName(user, withID = true, withEmail = false, inversedName = false) {
    let fullName: string;
    if (!user) {
      return "Unknown";
    }
    if (inversedName) {
      if (user.firstName) {
        fullName = `${user.name}, ${user.firstName}`;
      } else {
        fullName = user.name;
      }
    } else {
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

  static async buildEvseUserURL(user, hash = '') {
    const tenant = await user.getTenant();
    const _evseBaseURL = Utils.buildEvseURL(tenant.getSubdomain());
    // Add
    return _evseBaseURL + "/users?UserID=" + user.getID() + hash;
  }

  static async buildEvseChargingStationURL(chargingStation, hash = '') {
    const tenant = await chargingStation.getTenant();
    const _evseBaseURL = Utils.buildEvseURL(tenant.getSubdomain());

    return _evseBaseURL + "/charging-stations?ChargingStationID=" + chargingStation.getID() + hash;
  }

  static async buildEvseTransactionURL(chargingStation, transactionId, hash = '') {
    const tenant = await chargingStation.getTenant();
    const _evseBaseURL = Utils.buildEvseURL(tenant.getSubdomain());
    // Add
    return _evseBaseURL + "/transactions?TransactionID=" + transactionId + hash;
  }

  static isServerInProductionMode() {
    const env = process.env.NODE_ENV || 'dev';
    return (env === "production");
  }

  static hideShowMessage(message) {
    // Check Prod
    if (Utils.isServerInProductionMode()) {
      return "An unexpected server error occurred. Check the server's logs!";
    }
    return message;

  }

  public static checkRecordLimit(recordLimit: number|string): number {
    // String?
    if (typeof recordLimit === 'string') {
      recordLimit = parseInt(recordLimit);
    }
    // Not provided?
    if (isNaN(recordLimit) || recordLimit < 0 || recordLimit === 0) {
      // Default
      recordLimit = Constants.DEFAULT_DB_LIMIT;
    }
    return recordLimit;
  }

  static roundTo(number, scale) {
    return parseFloat(number.toFixed(scale));
  }

  static firstLetterInUpperCase(value) {
    return value[0].toUpperCase() + value.substring(1);
  }

  public static checkRecordSkip(recordSkip: number|string): number {
    // String?
    if (typeof recordSkip === "string") {
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
   * Duplicate a json object
   * @param src
   * @returns a copy of the source
   */
  static duplicateJSON(src) {
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

  static isUndefined(obj) {
    return typeof obj === 'undefined';
  }
}
