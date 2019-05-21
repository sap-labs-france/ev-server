const { ObjectId } = require('mongodb');
const Configuration = require('./Configuration');
const uuidV4 = require('uuid/v4');
const ObjectID = require('mongodb').ObjectID;
const Constants = require('./Constants');
const BackendError = require('../exception/BackendError');
const crypto = require('crypto');
const ClientOAuth2 = require('client-oauth2');
const axios = require('axios');
const url = require('url');
const fs = require('fs');
const path = require('path');

require('source-map-support').install();

const _centralSystemFrontEndConfig = Configuration.getCentralSystemFrontEndConfig();
const _tenants = [];
class Utils {
  static generateGUID() {
    return uuidV4();
  }

  static generateTagID(name, firstName) {
    let tagID = '';
    if (name.length > 0) {
      tagID = name[0];
    } else {
      tagID = 'U';
    }
    if (firstName.length > 0) {
      tagID += firstName[0];
    } else {
      tagID += 'U';
    }
    tagID += Math.floor((Math.random() * 2147483648) + 1);
    return tagID;
  }

  // Temporary method for Revenue Cloud concept
  static async pushTransactionToRevenueCloud(action, transaction, user, actionOnUser) {
    const Logging = require('./Logging'); // Avoid fucking circular deps

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
        'quantity': transaction.getTotalConsumption() / 1000,
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
    // ChargeBox Identity
    Utils._normalizeOneSOAPParam(headers, 'chargeBoxIdentity');
    // Action
    Utils._normalizeOneSOAPParam(headers, 'Action');
    // To
    Utils._normalizeOneSOAPParam(headers, 'To');
    // Parse the request
    const urlParts = url.parse(req.url, true);
    const tenantID = urlParts.query.TenantID;
    // Check
    await Utils.checkTenant(tenantID);
    // Set the Tenant ID
    headers.tenantID = tenantID;
  }

  static _normalizeOneSOAPParam(headers, name) {
    // Object?
    if (typeof headers[name] === 'object' && headers[name].$value) {
      // Yes: Set header
      headers[name] = headers[name].$value;
    }
  }

  static async checkTenant(tenantID) {
    const Tenant = require('../entity/Tenant'); // Avoid fucking circular deps
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
      if (!ObjectId.isValid(tenantID)) {
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
    if (typeof document != "object") {
      return true;
    }
    // Check
    return Object.keys(document).length == 0;
  }

  static removeExtraEmptyLines(tab) {
    // Start from the end
    for (let i = tab.length - 1; i > 0; i--) {
      // Two consecutive empty lines?
      if (tab[i].length == 0 && tab[i - 1].length == 0) {
        // Remove the last one
        tab.splice(i, 1);
      }
      // Check last line
      if (i == 1 && tab[i - 1].length == 0) {
        // Remove the first one
        tab.splice(i - 1, 1);
      }
    }
  }

  static convertToObjectID(id) {
    let changedID = id;
    // Check
    if (typeof id == "string") {
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
    if (typeof id == "string") {
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
    if (typeof id == "string") {
      // Create Object
      changedID = parseFloat(id);
    }
    return changedID;
  }

  static convertUserToObjectID(user) {
    let userID = null;
    // Check Created By
    if (user) {
      // Set
      userID = user;
      // Check User Model
      if (typeof user == "object" &&
        user.constructor.name != "ObjectID") {
        // This is the User Model
        userID = Utils.convertToObjectID(user.id);
      }
      // Check String
      if (typeof user == "string") {
        // This is a String
        userID = Utils.convertToObjectID(user);
      }
    }
    return userID;
  }

  static isEmptyArray(array) {
    if (array && array.length > 0) {
      return false;
    }
    return true;
  }

  static buildUserFullName(user, withID = true) {
    if (!user) {
      return "Unknown";
    }
    // First name?
    if (!user.firstName) {
      return user.name;
    }
    // Set the ID?
    if (withID) {
      return `${user.firstName} ${user.name} (${user.id})`;
    } else {
      return `${user.firstName} ${user.name}`;
    }
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
    } else {
      return message;
    }
  }

  static checkRecordLimit(recordLimit) {
    // String?
    if (typeof recordLimit == "string") {
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

  static checkRecordSkip(recordSkip) {
    // String?
    if (typeof recordSkip == "string") {
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
    if (src === null || src === undefined || typeof src !== 'object') {
      return src;
    }
    // Recreate all of it
    return JSON.parse(JSON.stringify(src));
  }
}

module.exports = Utils;
