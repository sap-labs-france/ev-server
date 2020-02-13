import { BillingContentType, PricingContentType, RefundContentType, SettingDBContent, SmartChargingContentType } from '../types/Setting';
import { HTTPError, HTTPUserError } from '../types/HTTPError';
import User, { Status } from '../types/User';
import bcrypt from 'bcryptjs';
import { Request } from 'express';
import fs from 'fs';
import _ from 'lodash';
import { ObjectID } from 'mongodb';
import path from 'path';
import tzlookup from 'tz-lookup';
import url from 'url';
import uuidV4 from 'uuid/v4';
import Authorizations from '../authorization/Authorizations';
import AppError from '../exception/AppError';
import BackendError from '../exception/BackendError';
import TenantStorage from '../storage/mongodb/TenantStorage';
import UserStorage from '../storage/mongodb/UserStorage';
import ChargingStation from '../types/ChargingStation';
import ConnectorStats from '../types/ConnectorStats';
import OCPIEndpoint from '../types/ocpi/OCPIEndpoint';
import { ChargePointStatus, OCPPProtocol, OCPPVersion } from '../types/ocpp/OCPPServer';
import { HttpUserRequest } from '../types/requests/HttpUserRequest';
import Tag from '../types/Tag';
import Tenant from '../types/Tenant';
import { InactivityStatus, InactivityStatusLevel } from '../types/Transaction';
import UserToken from '../types/UserToken';
import Configuration from './Configuration';
import Constants from './Constants';
import Cypher from './Cypher';
import passwordGenerator = require('password-generator');
import { Role } from '../types/Authorization';

const _centralSystemFrontEndConfig = Configuration.getCentralSystemFrontEndConfig();
const _tenants = [];

export default class Utils {
  public static getEndOfChargeNotificationIntervalMins(chargingStation: ChargingStation, connectorId: number) {
    let intervalMins = 0;
    if (!chargingStation || !chargingStation.connectors) {
      return 0;
    }
    const connector = chargingStation.connectors[connectorId - 1];
    if (connector.power <= 3680) {
      // Notifify every 120 mins
      intervalMins = 120;
    } else if (connector.power <= 7360) {
      // Notifify every 60 mins
      intervalMins = 60;
    } else if (connector.power < 50000) {
      // Notifify every 30 mins
      intervalMins = 30;
    } else if (connector.power >= 50000) {
      // Notifify every 15 mins
      intervalMins = 15;
    }
    return intervalMins;
  }

  public static getInactivityStatusLevel(chargingStation: ChargingStation, connectorId: number, inactivitySecs: number): InactivityStatus {
    if (!inactivitySecs) {
      return InactivityStatus.INFO;
    }
    // Get Notification Interval
    const intervalMins = Utils.getEndOfChargeNotificationIntervalMins(chargingStation, connectorId);
    // Check
    if (inactivitySecs < (intervalMins * 60)) {
      return InactivityStatus.INFO;
    } else if (inactivitySecs < (intervalMins * 60 * 2)) {
      return InactivityStatus.WARNING;
    }
    return InactivityStatus.ERROR;
  }

  public static hasOwnProperty(object: object, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  public static getUIInactivityStatusLevel(inactivityStatus: InactivityStatus): InactivityStatusLevel {
    switch (inactivityStatus) {
      case InactivityStatus.INFO:
        return 'info';
      case InactivityStatus.WARNING:
        return 'warning';
      case InactivityStatus.ERROR:
        return 'danger';
    }
    return 'info';

  }

  public static generateGUID() {
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

  public static getIfChargingStationIsInactive(chargingStation): boolean {
    let inactive = false;
    // Get Heartbeat Interval from conf
    const config = Configuration.getChargingStationConfig();
    if (config) {
      const heartbeatIntervalSecs = config.heartbeatIntervalSecs;
      // Compute against the last Heartbeat
      if (chargingStation.lastHeartBeat) {
        const inactivitySecs = Math.floor((Date.now() - chargingStation.lastHeartBeat.getTime()) / 1000);
        // Inactive?
        if (inactivitySecs > (heartbeatIntervalSecs * 5)) {
          inactive = true;
        }
      }
    }
    return inactive;
  }

  public static getConnectorStatusesFromChargingStations(chargingStations: ChargingStation[]): ConnectorStats {
    const connectorStats: ConnectorStats = {
      totalChargers: 0,
      availableChargers: 0,
      totalConnectors: 0,
      chargingConnectors: 0,
      suspendedConnectors: 0,
      availableConnectors: 0,
      unavailableConnectors: 0,
      preparingConnectors: 0,
      finishingConnectors: 0,
      faultedConnectors: 0
    };
    // Chargers
    for (const chargingStation of chargingStations) {
      // Check not deleted
      if (chargingStation.deleted) {
        continue;
      }
      // Check connectors
      Utils.checkAndUpdateConnectorsStatus(chargingStation);
      // Set Inactive flag
      chargingStation.inactive = Utils.getIfChargingStationIsInactive(chargingStation);
      connectorStats.totalChargers++;
      // Handle Connectors
      if (!chargingStation.connectors) {
        chargingStation.connectors = [];
      }
      for (const connector of chargingStation.connectors) {
        if (!connector) {
          continue;
        }
        connectorStats.totalConnectors++;
        // Not Available?
        if (chargingStation.inactive ||
          connector.status === ChargePointStatus.UNAVAILABLE) {
          connectorStats.unavailableConnectors++;
          // Available?
        } else if (connector.status === ChargePointStatus.AVAILABLE) {
          connectorStats.availableConnectors++;
          // Suspended?
        } else if (connector.status === ChargePointStatus.SUSPENDED_EV ||
          connector.status === ChargePointStatus.SUSPENDED_EVSE) {
          connectorStats.suspendedConnectors++;
          // Charging?
        } else if (connector.status === ChargePointStatus.CHARGING ||
          connector.status === ChargePointStatus.OCCUPIED) {
          connectorStats.chargingConnectors++;
          // Faulted?
        } else if (connector.status === ChargePointStatus.FAULTED) {
          connectorStats.faultedConnectors++;
          // Preparing?
        } else if (connector.status === ChargePointStatus.PREPARING) {
          connectorStats.preparingConnectors++;
          // Finishing?
        } else if (connector.status === ChargePointStatus.FINISHING) {
          connectorStats.finishingConnectors++;
        }
      }
      // Handle Chargers
      for (const connector of chargingStation.connectors) {
        if (!connector) {
          continue;
        }
        // Check if Available
        if (!chargingStation.inactive && connector.status === ChargePointStatus.AVAILABLE) {
          connectorStats.availableChargers++;
          break;
        }
      }
    }
    return connectorStats;
  }

  public static checkAndUpdateConnectorsStatus(chargingStation: ChargingStation) {
    // Cannot charge in //
    if (chargingStation.cannotChargeInParallel) {
      let lockAllConnectors = false;
      // Check
      for (const connector of chargingStation.connectors) {
        if (!connector) {
          continue;
        }
        if (connector.status !== ChargePointStatus.AVAILABLE) {
          lockAllConnectors = true;
          break;
        }
      }
      // Lock?
      if (lockAllConnectors) {
        for (const connector of chargingStation.connectors) {
          if (!connector) {
            continue;
          }
          if (connector.status === ChargePointStatus.AVAILABLE) {
            // Check OCPP Version
            if (chargingStation.ocppVersion === OCPPVersion.VERSION_15) {
              // Set OCPP 1.5 Occupied
              connector.status = ChargePointStatus.OCCUPIED;
            } else {
              // Set OCPP 1.6 Unavailable
              connector.status = ChargePointStatus.UNAVAILABLE;
            }
          }
        }
      }
    }
  }

  // Temporary method for Revenue Cloud concept
  // static async pushTransactionToRevenueCloud(tenantID: string, action: string, transaction: Transaction, user: User, actionOnUser: User) {
  //   // Refund Transaction
  //   const cloudRevenueAuth = new ClientOAuth2({
  //     clientId: 'sb-revenue-cloud!b1122|revenue-cloud!b1532',
  //     clientSecret: 'BtuZkWlC/58HmEMoqBCHc0jBoVg=',
  //     accessTokenUri: 'https://seed-innovation.authentication.eu10.hana.ondemand.com/oauth/token'
  //   });
  //   // Get the token
  //   const authResponse = await cloudRevenueAuth.credentials.getToken();
  //   // Send HTTP request
  //   const result = await axios.post(
  //     'https://eu10.revenue.cloud.sap/api/usage-record/v1/usage-records',
  //     {
  //       'metricId': 'ChargeCurrent_Trial',
  //       'quantity': transaction.stop.totalConsumption / 1000,
  //       'startedAt': transaction.timestamp,
  //       'endedAt': transaction.stop.timestamp,
  //       'userTechnicalId': transaction.tagID
  //     },
  //     {
  //       'headers': {
  //         'Authorization': 'Bearer ' + authResponse.accessToken,
  //         'Content-Type': 'application/json'
  //       }
  //     }
  //   );
  //   // Log
  //   Logging.logSecurityInfo({
  //     user, actionOnUser, action,
  //     tenantID: tenantID,
  //     source: transaction.chargeBoxID,
  //     module: 'Utils', method: 'pushTransactionToRevenueCloud',
  //     message: `Transaction ID '${transaction.id}' has been refunded successfully`,
  //     detailedMessages: result.data
  //   });
  // }

  public static getLanguageFromLocale(locale: string) {
    let language = Constants.DEFAULT_LANGUAGE;
    // Set the User's locale
    if (locale && locale.length > 2) {
      language = locale.substring(0, 2);
    }
    return language;
  }

  public static async normalizeAndCheckSOAPParams(headers, req) {
    // Normalize
    Utils._normalizeOneSOAPParam(headers, 'chargeBoxIdentity');
    Utils._normalizeOneSOAPParam(headers, 'Action');
    Utils._normalizeOneSOAPParam(headers, 'To');
    Utils._normalizeOneSOAPParam(headers, 'From.Address');
    Utils._normalizeOneSOAPParam(headers, 'ReplyTo.Address');
    // Parse the request (lower case for fucking charging station DBT URL registration)
    const urlParts = url.parse(decodeURIComponent(req.url.toLowerCase()), true);
    const tenantID = urlParts.query.tenantid as string;
    const token = urlParts.query.token;
    // Check
    await Utils.checkTenant(tenantID);
    // Set the Tenant ID
    headers.tenantID = tenantID;
    headers.token = token;

    if (!Utils.isChargingStationIDValid(headers.chargeBoxIdentity)) {
      throw new BackendError({
        source: headers.chargeBoxIdentity,
        module: 'Utils',
        method: 'normalizeAndCheckSOAPParams',
        message: 'The Charging Station ID is invalid'
      });
    }
  }

  public static _normalizeOneSOAPParam(headers, name) {
    const val = _.get(headers, name);
    if (val && val.$value) {
      _.set(headers, name, val.$value);
    }
  }

  public static async checkTenant(tenantID: string): Promise<void> {
    if (!tenantID) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: 'Utils',
        method: 'checkTenant',
        message: 'The Tenant ID is mandatory'
      });
    }
    // Check in cache
    if (_tenants.includes(tenantID)) {
      return Promise.resolve(null);
    }
    if (tenantID !== Constants.DEFAULT_TENANT) {
      // Valid Object ID?
      if (!ObjectID.isValid(tenantID)) {
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: 'Utils',
          method: 'checkTenant',
          message: `Invalid Tenant ID '${tenantID}'`
        });
      }
      // Get the Tenant
      const tenant = await TenantStorage.getTenant(tenantID);
      if (!tenant) {
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: 'Utils',
          method: 'checkTenant',
          message: `Invalid Tenant ID '${tenantID}'`
        });
      }
    }
    _tenants.push(tenantID);
  }

  static convertToBoolean(value: any) {
    let result = false;
    // Check boolean
    if (value) {
      // Check the type
      if (typeof value === 'boolean') {
        // Already a boolean
        result = value;
      } else {
        // Convert
        result = (value === 'true');
      }
    }
    return result;
  }

  public static convertToDate(date: any): Date {
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

  public static replaceSpecialCharsInCSVValueParam(value: string): string {
    return value ? value.replace(/\n/g, '') : '';
  }

  public static escapeSpecialCharsInRegex(value: string): string {
    return value ? value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
  }

  public static isEmptyJSon(document) {
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

  public static removeExtraEmptyLines(tab) {
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

  public static isComponentActiveFromToken(userToken: UserToken, componentName: string): boolean {
    return userToken.activeComponents.includes(componentName);
  }

  public static convertToObjectID(id: any): ObjectID {
    let changedID = id;
    // Check
    if (typeof id === 'string') {
      // Create Object
      changedID = new ObjectID(id);
    }
    return changedID;
  }

  public static convertToInt(value: any): number {
    let changedValue = value;
    if (!value) {
      return 0;
    }
    // Check
    if (typeof value === 'string') {
      // Create Object
      changedValue = parseInt(value);
    }
    return changedValue;
  }

  public static convertToFloat(value: any): number {
    let changedValue = value;
    if (!value) {
      return 0;
    }
    // Check
    if (typeof value === 'string') {
      // Create Object
      changedValue = parseFloat(value);
    }
    return changedValue;
  }

  public static convertUserToObjectID(user: User|UserToken|string): ObjectID | null { // TODO: Fix this method...
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

  public static buildUserFullName(user: User, withID = true, withEmail = false, inversedName = false) {
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
  public static saveFile(filename, content) {
    // Save
    fs.writeFileSync(path.join(__dirname, filename), content, 'UTF-8');
  }

  public static getRandomInt(): number {
    return Math.floor((Math.random() * 2147483648) + 1); // INT32 (signed: issue in Schneider)
  }

  public static buildEvseURL(subdomain): string {
    if (subdomain) {
      return `${_centralSystemFrontEndConfig.protocol}://${subdomain}.${_centralSystemFrontEndConfig.host}:${_centralSystemFrontEndConfig.port}`;
    }
    return `${_centralSystemFrontEndConfig.protocol}://${_centralSystemFrontEndConfig.host}:${
      _centralSystemFrontEndConfig.port}`;
  }

  public static buildOCPPServerURL(tenantID: string, ocppVersion: OCPPVersion, ocppProtocol: OCPPProtocol, token?: string): string {
    let ocppUrl;
    const version = ocppVersion === OCPPVersion.VERSION_16 ? 'OCPP16' : 'OCPP15';
    switch (ocppProtocol) {
      case OCPPProtocol.JSON:
        ocppUrl = `${Configuration.getJsonEndpointConfig().baseUrl}/OCPP16/${tenantID}`;
        if (token) {
          ocppUrl += `/${token}`;
        }
        return ocppUrl;
      case OCPPProtocol.SOAP:
      default:
        ocppUrl = `${Configuration.getWSDLEndpointConfig().baseUrl}/${version}?TenantID=${tenantID}`;
        if (token) {
          ocppUrl += `%26Token=${token}`;
        }
        return ocppUrl;
    }
  }

  public static async buildEvseUserURL(tenantID: string, user: User, hash = ''): Promise<string> {
    const tenant = await TenantStorage.getTenant(tenantID);
    const _evseBaseURL = Utils.buildEvseURL(tenant.subdomain);
    // Add
    return _evseBaseURL + '/users?UserID=' + user.id + hash;
  }

  public static async buildEvseChargingStationURL(tenantID: string, chargingStation: ChargingStation, hash = ''): Promise<string> {
    const tenant = await TenantStorage.getTenant(tenantID);
    const _evseBaseURL = Utils.buildEvseURL(tenant.subdomain);
    return _evseBaseURL + '/charging-stations?ChargingStationID=' + chargingStation.id + hash;
  }

  public static async buildEvseTransactionURL(tenantID: string, chargingStation: ChargingStation, transactionId, hash = ''): Promise<string> {
    const tenant = await TenantStorage.getTenant(tenantID);
    const _evseBaseURL = Utils.buildEvseURL(tenant.subdomain);
    return _evseBaseURL + '/transactions?TransactionID=' + transactionId + hash;
  }

  public static async buildEvseBillingSettingsURL(tenantID: string): Promise<string> {
    const tenant = await TenantStorage.getTenant(tenantID);
    const _evseBaseURL = Utils.buildEvseURL(tenant.subdomain);
    return _evseBaseURL + '/settings#billing';
  }

  public static isServerInProductionMode(): boolean {
    const env = process.env.NODE_ENV || 'dev';
    return (env === 'production');
  }

  public static hideShowMessage(message): string {
    // Check Prod
    if (Utils.isServerInProductionMode()) {
      return 'An unexpected server error occurred. Check the server\'s logs!';
    }
    return message;
  }

  public static getRequestIP(request): string {
    if (request.ip) {
      return request.ip;
    } else if (request.headers['x-forwarded-for']) {
      return request.headers['x-forwarded-for'];
    } else if (request.connection.remoteAddress) {
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
      recordLimit = Utils.convertToInt(recordLimit);
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

  public static roundTo(number, scale) {
    return Utils.convertToFloat(number.toFixed(scale));
  }

  public static firstLetterInUpperCase(value): string {
    return value[0].toUpperCase() + value.substring(1);
  }

  public static firstLetterInLowerCase(value): string {
    return value[0].toLowerCase() + value.substring(1);
  }

  public static getConnectorLetterFromConnectorID(connectorID: number): string {
    return String.fromCharCode(65 + connectorID - 1);
  }

  public static getConnectorIDFromConnectorLetter(connectorLetter: string): number {
    return connectorLetter.charCodeAt(0) - 64;
  }

  public static checkRecordSkip(recordSkip: number | string): number {
    // String?
    if (typeof recordSkip === 'string') {
      recordSkip = Utils.convertToInt(recordSkip);
    }
    // Not provided?
    if (isNaN(recordSkip) || recordSkip < 0) {
      // Default
      recordSkip = 0;
    }
    return recordSkip;
  }

  public static generateToken(email) {
    return Cypher.hash(`${new Date().toISOString()}~${email}`);
  }

  public static duplicateJSON(src): any {
    if (!src || typeof src !== 'object') {
      return src;
    }
    // Recreate all of it
    return JSON.parse(JSON.stringify(src));
  }

  public static getRoleNameFromRoleID(roleID) {
    switch (roleID) {
      case Role.BASIC:
        return 'Basic';
      case Role.DEMO:
        return 'Demo';
      case Role.ADMIN:
        return 'Admin';
      case Role.SUPER_ADMIN:
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

  public static isPasswordStrongEnough(password) {
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


  public static generatePassword() {
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
      case Status.PENDING:
        return 'Pending';
      case Status.LOCKED:
        return 'Locked';
      case Status.BLOCKED:
        return 'Blocked';
      case Status.ACTIVE:
        return 'Active';
      case Status.INACTIVE:
        return 'Inactive';
      default:
        return 'Unknown';
    }
  }

  public static hashPassword(password) {
    return Cypher.hash(password);
  }

  public static checkIfOCPIEndpointValid(ocpiEndpoint: Partial<OCPIEndpoint>, req: Request): void {
    if (req.method !== 'POST' && !ocpiEndpoint.id) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The OCPI Endpoint ID is mandatory',
        module: 'Utils',
        method: 'checkIfOCPIEndpointValid'
      });
    }
    if (!ocpiEndpoint.name) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The OCPI Endpoint name is mandatory',
        module: 'Utils',
        method: 'checkIfOCPIEndpointValid',
        user: req.user.id
      });
    }
    if (!ocpiEndpoint.role) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The OCPI Endpoint role is mandatory',
        module: 'Utils',
        method: 'checkIfOCPIEndpointValid',
        user: req.user.id
      });
    }
    if (!ocpiEndpoint.baseUrl) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The OCPI Endpoint base URL is mandatory',
        module: 'Utils',
        method: 'checkIfOCPIEndpointValid',
        user: req.user.id
      });
    }
    if (!ocpiEndpoint.localToken) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The OCPI Endpoint local token is mandatory',
        module: 'Utils',
        method: 'checkIfOCPIEndpointValid',
        user: req.user.id
      });
    }
    if (!ocpiEndpoint.token) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The OCPI Endpoint token is mandatory',
        module: 'Utils',
        method: 'checkIfOCPIEndpointValid',
        user: req.user.id
      });
    }
  }

  public static checkIfSiteValid(filteredRequest: any, req: Request): void {
    if (req.method !== 'POST' && !filteredRequest.id) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Site ID is mandatory',
        module: 'SiteService',
        method: '_checkIfSiteValid',
        user: req.user.id
      });
    }
    if (!filteredRequest.name) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Site Name is mandatory',
        module: 'SiteService',
        method: '_checkIfSiteValid',
        user: req.user.id
      });
    }
    if (!filteredRequest.companyID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Company ID is mandatory for the Site',
        module: 'SiteService',
        method: '_checkIfSiteValid',
        user: req.user.id
      });
    }
  }

  public static checkIfSiteAreaValid(filteredRequest: any, req: Request): void {
    if (req.method !== 'POST' && !filteredRequest.id) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Site Area ID is mandatory',
        module: 'SiteAreaService',
        method: '_checkIfSiteAreaValid',
        user: req.user.id
      });
    }
    if (!filteredRequest.name) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Site Area name is mandatory',
        module: 'SiteAreaService',
        method: '_checkIfSiteAreaValid',
        user: req.user.id
      });
    }
    if (!filteredRequest.siteID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Site ID is mandatory',
        module: 'SiteAreaService',
        method: '_checkIfSiteAreaValid',
        user: req.user.id
      });
    }
  }

  public static checkIfCompanyValid(filteredRequest: any, req: Request): void {
    if (req.method !== 'POST' && !filteredRequest.id) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Company ID is mandatory',
        module: 'CompanyService',
        method: 'checkIfCompanyValid',
        user: req.user.id
      });
    }
    if (!filteredRequest.name) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Company Name is mandatory',
        module: 'CompanyService',
        method: 'checkIfCompanyValid',
        user: req.user.id
      });
    }
  }

  public static checkIfVehicleValid(filteredRequest, req: Request) {
    // Update model?
    if (req.method !== 'POST' && !filteredRequest.id) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Vehicle ID is mandatory',
        module: 'VehicleService',
        method: 'checkIfVehicleValid',
        user: req.user.id
      });
    }
    if (!filteredRequest.type) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Vehicle Type is mandatory',
        module: 'VehicleService',
        method: 'checkIfVehicleValid',
        user: req.user.id
      });
    }
    if (!filteredRequest.model) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Vehicle Model is mandatory',
        module: 'VehicleService',
        method: 'checkIfVehicleValid',
        user: req.user.id
      });
    }
    if (!filteredRequest.vehicleManufacturerID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Vehicle Manufacturer is mandatory',
        module: 'VehicleService',
        method: 'checkIfVehicleValid',
        user: req.user.id
      });
    }
  }

  public static checkIfVehicleManufacturerValid(filteredRequest, req) {
    // Update model?
    if (req.method !== 'POST' && !filteredRequest.id) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Vehicle Manufacturer ID is mandatory',
        module: 'VehicleManufacturer',
        method: 'checkIfVehicleManufacturerValid',
        user: req.user.id
      });
    }
    if (!filteredRequest.name) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Vehicle Manufacturer Name is mandatory',
        module: 'VehicleManufacturer',
        method: 'checkIfVehicleManufacturerValid',
        user: req.user.id
      });
    }
  }

  public static async checkIfUserTagsAreValid(user: User, tags: Tag[], req: Request) {
    // Check that the Badge ID is not already used
    if (Authorizations.isAdmin(req.user) || Authorizations.isSuperAdmin(req.user)) {
      if (tags) {
        for (const tag of tags) {
          const foundUser = await UserStorage.getUserByTagId(req.user.tenantID, tag.id);
          if (foundUser && (!user || (foundUser.id !== user.id))) {
            // Tag already used!
            throw new AppError({
              source: Constants.CENTRAL_SERVER,
              errorCode: HTTPUserError.TAG_ID_ALREADY_USED_ERROR,
              message: `The Tag ID '${tag.id}' is already used by User '${Utils.buildUserFullName(foundUser)}'`,
              module: 'Utils',
              method: 'checkIfUserTagsAreValid',
              user: req.user.id
            });
          }
        }
      }
    }
  }

  public static checkIfUserValid(filteredRequest: Partial<HttpUserRequest>, user: User, req: Request) {
    const tenantID = req.user.tenantID;
    if (!tenantID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Tenant is mandatory',
        module: 'UserService',
        method: 'checkIfUserValid',
        user: req.user.id
      });
    }
    // Update model?
    if (req.method !== 'POST' && !filteredRequest.id) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'User ID is mandatory',
        module: 'UserService',
        method: 'checkIfUserValid',
        user: req.user.id
      });
    }
    // Creation?
    if (req.method === 'POST') {
      if (!filteredRequest.role) {
        filteredRequest.role = Role.BASIC;
      }
    } else if (!Authorizations.isAdmin(req.user)) {
      filteredRequest.role = user.role;
    }
    if (req.method === 'POST' && !filteredRequest.status) {
      filteredRequest.status = Status.BLOCKED;
    }
    // Creation?
    if ((filteredRequest.role !== Role.BASIC) && (filteredRequest.role !== Role.DEMO) &&
      !Authorizations.isAdmin(req.user) && !Authorizations.isSuperAdmin(req.user)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Only Admins can assign the role '${Utils.getRoleNameFromRoleID(filteredRequest.role)}'`,
        module: 'UserService',
        method: 'checkIfUserValid',
        user: req.user.id,
        actionOnUser: filteredRequest.id
      });
    }
    // Only Basic, Demo, Admin user other Tenants (!== default)
    if (tenantID !== 'default' && filteredRequest.role && filteredRequest.role === Role.SUPER_ADMIN) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'User cannot have the Super Admin role in this Tenant',
        module: 'UserService',
        method: 'checkIfUserValid',
        user: req.user.id,
        actionOnUser: filteredRequest.id
      });
    }
    // Only Admin and Super Admin can use role different from Basic
    if ((filteredRequest.role === Role.ADMIN || filteredRequest.role === Role.SUPER_ADMIN) &&
      !Authorizations.isAdmin(req.user) && !Authorizations.isSuperAdmin(req.user)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `User without role Admin or Super Admin tried to ${filteredRequest.id ? 'update' : 'create'} an User with the '${Utils.getRoleNameFromRoleID(filteredRequest.role)}' role`,
        module: 'UserService',
        method: 'checkIfUserValid',
        user: req.user.id,
        actionOnUser: filteredRequest.id
      });
    }
    if (!filteredRequest.name) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'User Last Name is mandatory',
        module: 'UserService',
        method: 'checkIfUserValid',
        user: req.user.id,
        actionOnUser: filteredRequest.id
      });
    }
    if (req.method === 'POST' && !filteredRequest.email) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'User Email is mandatory',
        module: 'UserService',
        method: 'checkIfUserValid',
        user: req.user.id,
        actionOnUser: filteredRequest.id
      });
    }
    if (req.method === 'POST' && !Utils._isUserEmailValid(filteredRequest.email)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `User Email ${filteredRequest.email} is not valid`,
        module: 'UserService',
        method: 'checkIfUserValid',
        user: req.user.id,
        actionOnUser: filteredRequest.id
      });
    }
    if (filteredRequest.password && !Utils.isPasswordValid(filteredRequest.password)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'User Password is not valid',
        module: 'UserService',
        method: 'checkIfUserValid',
        user: req.user.id,
        actionOnUser: filteredRequest.id
      });
    }
    if (filteredRequest.phone && !Utils._isPhoneValid(filteredRequest.phone)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `User Phone ${filteredRequest.phone} is not valid`,
        module: 'UserService',
        method: 'checkIfUserValid',
        user: req.user.id,
        actionOnUser: filteredRequest.id
      });
    }
    if (filteredRequest.mobile && !Utils._isPhoneValid(filteredRequest.mobile)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `User Mobile ${filteredRequest.mobile} is not valid`,
        module: 'UserService',
        method: 'checkIfUserValid',
        user: req.user.id,
        actionOnUser: filteredRequest.id
      });
    }
    if (filteredRequest.iNumber && !Utils._isINumberValid(filteredRequest.iNumber)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `User I-Number ${filteredRequest.iNumber} is not valid`,
        module: 'UserService',
        method: 'checkIfUserValid',
        user: req.user.id,
        actionOnUser: filteredRequest.id
      });
    }
    if (filteredRequest.tags) {
      if (!Utils._areTagsValid(filteredRequest.tags)) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.GENERAL_ERROR,
          message: `User Tags ${filteredRequest.tags} is/are not valid`,
          module: 'UserService',
          method: 'checkIfUserValid',
          user: req.user.id,
          actionOnUser: filteredRequest.id
        });
      }
    }
    if (filteredRequest.plateID && !Utils._isPlateIDValid(filteredRequest.plateID)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `User Plate ID ${filteredRequest.plateID} is not valid`,
        module: 'UserService',
        method: 'checkIfUserValid',
        user: req.user.id,
        actionOnUser: filteredRequest.id
      });
    }
  }

  public static getTimezone(coordinates: number[]) {
    if (coordinates && coordinates.length === 2) {
      return tzlookup(coordinates[1], coordinates[0]);
    }
    return null;
  }

  public static getTenantActiveComponents(tenant: Tenant): string[] {
    const components: string[] = [];
    for (const componentName in tenant.components) {
      if (tenant.components[componentName].active) {
        components.push(componentName);
      }
    }
    return components;
  }

  public static isTenantComponentActive(tenant: Tenant, component: string): boolean {
    for (const componentName in tenant.components) {
      if (componentName === component) {
        return tenant.components[componentName].active;
      }
    }
    return false;
  }

  public static createDefaultSettingContent(activeComponent, currentSettingContent): SettingDBContent {
    switch (activeComponent.name) {
      // Pricing
      case Constants.COMPONENTS.PRICING:
        if (!currentSettingContent || currentSettingContent.type !== activeComponent.type) {
          // Create default settings
          if (activeComponent.type === Constants.SETTING_PRICING_CONTENT_TYPE_SIMPLE) {
            // Simple Pricing
            return {
              'type': Constants.SETTING_PRICING_CONTENT_TYPE_SIMPLE,
              'simple': {}
            } as SettingDBContent;
          } else if (activeComponent.type === Constants.SETTING_PRICING_CONTENT_TYPE_CONVERGENT_CHARGING) {
            // SAP CC
            return {
              'type': Constants.SETTING_PRICING_CONTENT_TYPE_CONVERGENT_CHARGING,
              'convergentCharging': {}
            } as SettingDBContent;
          }
        }
        break;

      // Billing
      case Constants.COMPONENTS.BILLING:
        if (!currentSettingContent || currentSettingContent.type !== activeComponent.type) {
          // Only Stripe
          return {
            'type': Constants.SETTING_BILLING_CONTENT_TYPE_STRIPE,
            'stripe': {}
          } as SettingDBContent;
        }
        break;

      // Refund
      case Constants.COMPONENTS.REFUND:
        if (!currentSettingContent || currentSettingContent.type !== activeComponent.type) {
          // Only Concur
          return {
            'type': Constants.SETTING_REFUND_CONTENT_TYPE_CONCUR,
            'concur': {}
          } as SettingDBContent;
        }
        break;

      // Refund
      case Constants.COMPONENTS.OCPI:
        if (!currentSettingContent || currentSettingContent.type !== activeComponent.type) {
          // Only Gireve
          return {
            'type': Constants.SETTING_REFUND_CONTENT_TYPE_GIREVE,
            'ocpi': {}
          } as SettingDBContent;
        }
        break;

      // SAC
      case Constants.COMPONENTS.ANALYTICS:
        if (!currentSettingContent || currentSettingContent.type !== activeComponent.type) {
          // Only SAP Analytics
          return {
            'type': Constants.SETTING_REFUND_CONTENT_TYPE_SAC,
            'sac': {}
          } as SettingDBContent;
        }
        break;

      // SAC
      case Constants.COMPONENTS.SMART_CHARGING:
        if (!currentSettingContent || currentSettingContent.type !== activeComponent.type) {
          // Only SAP sapSmartCharging
          return {
            'type': Constants.SETTING_SMART_CHARGING_CONTENT_TYPE_SAP_SMART_CHARGING,
            'sapSmartCharging': {}
          } as SettingDBContent;
        }
        break;
    }
  }

  public static isChargingStationIDValid(name: string): boolean {
    return /^[A-Za-z0-9_-]*$/.test(name);
  }

  public static isPasswordValid(password: string): boolean {
    // eslint-disable-next-line no-useless-escape
    return /(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!#@:;,<>\/''\$%\^&\*\.\?\-_\+\=\(\)])(?=.{8,})/.test(password);
  }

  private static _isUserEmailValid(email: string) {
    return /^(([^<>()\[\]\\.,;:\s@']+(\.[^<>()\[\]\\.,;:\s@']+)*)|('.+'))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(email);
  }

  private static _areTagsValid(tags: Tag[]) {
    return tags.filter((tag) => /^[A-Za-z0-9,]*$/.test(tag.id)).length === tags.length;
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
