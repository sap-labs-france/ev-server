import { AnalyticsSettingsType, AssetSettingsType, BillingSettingsType, PricingSettingsType, RefundSettingsType, RoamingSettingsType, SettingDBContent, SmartChargingContentType } from '../types/Setting';
import { Car, CarCatalog, CarType } from '../types/Car';
import { ChargePointStatus, OCPPProtocol, OCPPVersion } from '../types/ocpp/OCPPServer';
import ChargingStation, { ChargePoint, Connector, ConnectorCurrentLimitSource, CurrentType, SiteAreaLimitSource } from '../types/ChargingStation';
import Transaction, { CSPhasesUsed, InactivityStatus } from '../types/Transaction';
import User, { UserRole, UserStatus } from '../types/User';

import { ActionsResponse } from '../types/GlobalType';
import Address from '../types/Address';
import AppError from '../exception/AppError';
import Asset from '../types/Asset';
import Authorizations from '../authorization/Authorizations';
import { AxiosError } from 'axios';
import BackendError from '../exception/BackendError';
import { ChargingProfile } from '../types/ChargingProfile';
import ChargingStationStorage from '../storage/mongodb/ChargingStationStorage';
import Company from '../types/Company';
import Configuration from './Configuration';
import ConnectorStats from '../types/ConnectorStats';
import Constants from './Constants';
import Consumption from '../types/Consumption';
import Cypher from './Cypher';
import { HTTPError } from '../types/HTTPError';
import { HttpEndUserReportErrorRequest } from '../types/requests/HttpNotificationRequest';
import Logging from './Logging';
import OCPIEndpoint from '../types/ocpi/OCPIEndpoint';
import { OCPIResult } from '../types/ocpi/OCPIResult';
import { ObjectID } from 'mongodb';
import { Request } from 'express';
import { ServerAction } from '../types/Server';
import Site from '../types/Site';
import SiteArea from '../types/SiteArea';
import SiteAreaStorage from '../storage/mongodb/SiteAreaStorage';
import Tag from '../types/Tag';
import Tenant from '../types/Tenant';
import TenantComponents from '../types/TenantComponents';
import TenantStorage from '../storage/mongodb/TenantStorage';
import UserToken from '../types/UserToken';
import _ from 'lodash';
import bcrypt from 'bcryptjs';
import countries from 'i18n-iso-countries';
import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import moment from 'moment';
import passwordGenerator from 'password-generator';
import path from 'path';
import tzlookup from 'tz-lookup';
import url from 'url';
import { v4 as uuid } from 'uuid';
import validator from 'validator';

const MODULE_NAME = 'Utils';

export default class Utils {
  public static handleAxiosError(axiosError: AxiosError, urlRequest: string, action: ServerAction, module: string, method: string): void {
    // Handle Error outside 2xx range
    if (axiosError.response) {
      throw new BackendError({
        action, module, method,
        message: `HTTP Error '${axiosError.response.status}' while processing the URL '${urlRequest}'`,
      });
    }
    throw new BackendError({
      action, module, method,
      message: `HTTP error while processing the URL '${urlRequest}'`,
    });
  }

  public static isTransactionInProgressOnThreePhases(chargingStation: ChargingStation, transaction: Transaction): boolean {
    const currentType = Utils.getChargingStationCurrentType(chargingStation, null, transaction.connectorId);
    if (currentType === CurrentType.AC &&
       (transaction.currentInstantAmpsL1 > 0 && (transaction.currentInstantAmpsL2 === 0 || transaction.currentInstantAmpsL3 === 0)) ||
       (transaction.currentInstantAmpsL2 > 0 && (transaction.currentInstantAmpsL1 === 0 || transaction.currentInstantAmpsL3 === 0)) ||
       (transaction.currentInstantAmpsL3 > 0 && (transaction.currentInstantAmpsL1 === 0 || transaction.currentInstantAmpsL2 === 0))) {
      return false;
    }
    return true;
  }

  public static getUsedPhasesInTransactionInProgress(chargingStation: ChargingStation, transaction: Transaction): CSPhasesUsed {
    const currentType = Utils.getChargingStationCurrentType(chargingStation, null, transaction.connectorId);
    // AC Chargers
    if (currentType === CurrentType.AC && Utils.checkIfPhasesProvidedInTransactionInProgress(transaction)) {
      const cSPhasesUsed: CSPhasesUsed = {
        csPhase1: false,
        csPhase2: false,
        csPhase3: false
      };
      // Check current consumption
      if (transaction.currentInstantAmpsL1 > 0) {
        cSPhasesUsed.csPhase1 = true;
      }
      if (transaction.currentInstantAmpsL2 > 0) {
        cSPhasesUsed.csPhase2 = true;
      }
      if (transaction.currentInstantAmpsL3 > 0) {
        cSPhasesUsed.csPhase3 = true;
      }
      return cSPhasesUsed;
    }
    // Standard on three phases
    return {
      csPhase1: true,
      csPhase2: true,
      csPhase3: true
    };
  }

  public static checkIfPhasesProvidedInTransactionInProgress(transaction: Transaction): boolean {
    return transaction.currentInstantAmps > 0 &&
      (transaction.currentInstantAmpsL1 > 0 ||
       transaction.currentInstantAmpsL2 > 0 ||
       transaction.currentInstantAmpsL3 > 0);
  }

  public static getNumberOfUsedPhasesInTransactionInProgress(chargingStation: ChargingStation, transaction: Transaction): number {
    const currentType = Utils.getChargingStationCurrentType(chargingStation, null, transaction.connectorId);
    let nbrOfPhases = -1;
    if (currentType === CurrentType.AC && transaction.phasesUsed) {
      nbrOfPhases = 0;
      if (transaction.phasesUsed.csPhase1) {
        nbrOfPhases++;
      }
      if (transaction.phasesUsed.csPhase2) {
        nbrOfPhases++;
      }
      if (transaction.phasesUsed.csPhase3) {
        nbrOfPhases++;
      }
    }
    return nbrOfPhases;
  }

  public static getEndOfChargeNotificationIntervalMins(chargingStation: ChargingStation, connectorId: number): number {
    let intervalMins = 0;
    if (!chargingStation || !chargingStation.connectors) {
      return 0;
    }
    const connector = Utils.getConnectorFromID(chargingStation, connectorId);
    if (connector) {
      if (connector.power <= 3680) {
        // Notify every 120 mins
        intervalMins = 120;
      } else if (connector.power <= 7360) {
        // Notify every 60 mins
        intervalMins = 60;
      } else if (connector.power < 50000) {
        // Notify every 30 mins
        intervalMins = 30;
      } else if (connector.power >= 50000) {
        // Notify every 15 mins
        intervalMins = 15;
      }
    }
    return intervalMins;
  }

  public static async executePromiseWithTimeout<T>(timeoutMs: number, promise: Promise<T>, failureMessage: string): Promise<T> {
    let timeoutHandle;
    const timeoutPromise = new Promise<never>((resolve, reject) => {
      timeoutHandle = setTimeout(() => reject(new Error(failureMessage)), timeoutMs);
    });
    return Promise.race([
      promise,
      timeoutPromise,
    ]).then((result) => {
      clearTimeout(timeoutHandle);
      return result;
    });
  }

  public static async sleep(ms): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  public static logOcpiResult(
    tenantID: string, action: ServerAction, module: string, method: string, ocpiResult: OCPIResult,
    messageSuccess: string, messageError: string, messageSuccessAndError: string,
    messageNoSuccessNoError: string): void {
    // Replace
    messageSuccess = messageSuccess.replace('{{inSuccess}}', ocpiResult.success.toString());
    messageError = messageError.replace('{{inError}}', ocpiResult.failure.toString());
    messageSuccessAndError = messageSuccessAndError.replace('{{inSuccess}}', ocpiResult.success.toString());
    messageSuccessAndError = messageSuccessAndError.replace('{{inError}}', ocpiResult.failure.toString());
    if (Utils.isEmptyArray(ocpiResult.logs)) {
      ocpiResult.logs = null;
    }
    // Success and Error
    if (ocpiResult.success > 0 && ocpiResult.failure > 0) {
      Logging.logError({
        tenantID: tenantID,
        source: Constants.CENTRAL_SERVER,
        action, module, method,
        message: messageSuccessAndError,
        detailedMessages: ocpiResult.logs
      });
    } else if (ocpiResult.success > 0) {
      Logging.logInfo({
        tenantID: tenantID,
        source: Constants.CENTRAL_SERVER,
        action, module, method,
        message: messageSuccess,
        detailedMessages: ocpiResult.logs
      });
    } else if (ocpiResult.failure > 0) {
      Logging.logError({
        tenantID: tenantID,
        source: Constants.CENTRAL_SERVER,
        action, module, method,
        message: messageError,
        detailedMessages: ocpiResult.logs
      });
    } else {
      Logging.logInfo({
        tenantID: tenantID,
        source: Constants.CENTRAL_SERVER,
        action, module, method,
        message: messageNoSuccessNoError,
        detailedMessages: ocpiResult.logs
      });
    }
  }

  public static logActionsResponse(
    tenantID: string, action: ServerAction, module: string, method: string, actionsResponse: ActionsResponse,
    messageSuccess: string, messageError: string, messageSuccessAndError: string,
    messageNoSuccessNoError: string): void {
    // Replace
    messageSuccess = messageSuccess.replace('{{inSuccess}}', actionsResponse.inSuccess.toString());
    messageError = messageError.replace('{{inError}}', actionsResponse.inError.toString());
    messageSuccessAndError = messageSuccessAndError.replace('{{inSuccess}}', actionsResponse.inSuccess.toString());
    messageSuccessAndError = messageSuccessAndError.replace('{{inError}}', actionsResponse.inError.toString());
    // Success and Error
    if (actionsResponse.inSuccess > 0 && actionsResponse.inError > 0) {
      Logging.logError({
        tenantID: tenantID,
        source: Constants.CENTRAL_SERVER,
        action, module, method,
        message: messageSuccessAndError
      });
    } else if (actionsResponse.inSuccess > 0) {
      Logging.logInfo({
        tenantID: tenantID,
        source: Constants.CENTRAL_SERVER,
        action, module, method,
        message: messageSuccess
      });
    } else if (actionsResponse.inError > 0) {
      Logging.logError({
        tenantID: tenantID,
        source: Constants.CENTRAL_SERVER,
        action, module, method,
        message: messageError
      });
    } else {
      Logging.logInfo({
        tenantID: tenantID,
        source: Constants.CENTRAL_SERVER,
        action, module, method,
        message: messageNoSuccessNoError
      });
    }
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

  public static objectHasProperty(object: any, key: string): boolean {
    return _.has(object, key);
  }

  public static isBooleanValue(value: boolean): boolean {
    return _.isBoolean(value);
  }

  public static generateUUID(): string {
    return uuid();
  }

  static generateTagID(name: string, firstName: string): string {
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

  public static isIterable(obj: any): boolean {
    if (obj) {
      return typeof obj[Symbol.iterator] === 'function';
    }
    return false;
  }

  public static isUndefined(obj: any): boolean {
    return typeof obj === 'undefined';
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

  /**
   * Map user locale (en_US, fr_FR...) to language (en, fr...)
   * @param locale
   */
  public static getLanguageFromLocale(locale: string): string {
    let language = Constants.DEFAULT_LANGUAGE;
    // Get the language
    if (locale && locale.length >= 2) {
      language = locale.substring(0, 2);
    }
    return language;
  }

  /**
   * Map language (en, fr...) to user locale (en_US, fr_FR...)
   * @param language
   */
  static getLocaleFromLanguage(language: string): string {
    if (language === 'fr') {
      return 'fr_FR';
    } else if (language === 'es') {
      return 'es_MX';
    } else if (language === 'de') {
      return 'de_DE';
    } else if (language === 'pt') {
      return 'pt_PT';
    }
    return Constants.DEFAULT_LOCALE;
  }

  public static async normalizeAndCheckSOAPParams(headers: any, req: any): Promise<void> {
    // Normalize
    Utils.normalizeOneSOAPParam(headers, 'chargeBoxIdentity');
    Utils.normalizeOneSOAPParam(headers, 'Action');
    Utils.normalizeOneSOAPParam(headers, 'To');
    Utils.normalizeOneSOAPParam(headers, 'From.Address');
    Utils.normalizeOneSOAPParam(headers, 'ReplyTo.Address');
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
        module: MODULE_NAME,
        method: 'normalizeAndCheckSOAPParams',
        message: 'The Charging Station ID is invalid'
      });
    }
  }

  public static getConnectorLimitSourceString(limitSource: ConnectorCurrentLimitSource): string {
    switch (limitSource) {
      case ConnectorCurrentLimitSource.CHARGING_PROFILE:
        return 'Charging Profile';
      case ConnectorCurrentLimitSource.CONNECTOR:
        return 'Connector';
      case ConnectorCurrentLimitSource.STATIC_LIMITATION:
        return 'Static Limitation';
    }
  }

  public static async checkTenant(tenantID: string): Promise<void> {
    if (!tenantID) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'checkTenant',
        message: 'The Tenant ID is mandatory'
      });
    }
    if (tenantID !== Constants.DEFAULT_TENANT) {
      // Valid Object ID?
      if (!ObjectID.isValid(tenantID)) {
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME,
          method: 'checkTenant',
          message: `Invalid Tenant ID '${tenantID}'`
        });
      }
      // Get the Tenant
      const tenant = await TenantStorage.getTenant(tenantID);
      if (!tenant) {
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME,
          method: 'checkTenant',
          message: `Invalid Tenant ID '${tenantID}'`
        });
      }
    }
  }

  public static convertToBoolean(value: any): boolean {
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

  public static convertToDate(value: any): Date {
    // Check
    if (!value) {
      return null;
    }
    // Check Type
    if (!(value instanceof Date)) {
      return new Date(value);
    }
    return value;
  }

  public static replaceSpecialCharsInCSVValueParam(value: string): string {
    return value ? value.replace(/\n/g, '') : '';
  }

  public static escapeSpecialCharsInRegex(value: string): string {
    return value ? value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
  }

  public static isEmptyJSon(document: any): boolean {
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

  public static removeExtraEmptyLines(tab: string[]): void {
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

  public static isComponentActiveFromToken(userToken: UserToken, componentName: TenantComponents): boolean {
    return userToken.activeComponents.includes(componentName);
  }

  public static convertToObjectID(id: any): ObjectID {
    let changedID: ObjectID = id;
    // Check
    if (typeof id === 'string') {
      // Create Object
      changedID = new ObjectID(id);
    }
    return changedID;
  }

  public static convertToInt(value: any): number {
    let changedValue: number = value;
    if (!value) {
      return 0;
    }
    if (Number.isSafeInteger(value)) {
      return value;
    }
    // Check
    if (typeof value === 'string') {
      // Create Object
      changedValue = parseInt(value);
    }
    return changedValue;
  }

  public static convertToFloat(value: any): number {
    let changedValue: number = value;
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

  public static computeSimplePrice(pricePerkWh: number, consumptionWh: number): number {
    return Utils.convertToFloat((pricePerkWh * (consumptionWh / 1000)).toFixed(6));
  }

  public static computeSimpleRoundedPrice(pricePerkWh: number, consumptionWh: number): number {
    return Utils.convertToFloat((pricePerkWh * (consumptionWh / 1000)).toFixed(2));
  }

  public static convertUserToObjectID(user: User | UserToken | string): ObjectID | null {
    let userID: ObjectID | null = null;
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

  public static convertAmpToWatt(chargingStation: ChargingStation, chargePoint: ChargePoint, connectorID = 0, ampValue: number): number {
    const voltage = Utils.getChargingStationVoltage(chargingStation, chargePoint, connectorID);
    if (voltage) {
      return voltage * ampValue;
    }
    return 0;
  }

  public static convertWattToAmp(chargingStation: ChargingStation, chargePoint: ChargePoint, connectorID = 0, wattValue: number): number {
    const voltage = Utils.getChargingStationVoltage(chargingStation, chargePoint, connectorID);
    if (voltage) {
      return wattValue / voltage;
    }
    return 0;
  }

  public static getChargePointFromID(chargingStation: ChargingStation, chargePointID: number): ChargePoint {
    if (!chargingStation.chargePoints) {
      return null;
    }
    return chargingStation.chargePoints.find((chargePoint) => chargePoint && (chargePoint.chargePointID === chargePointID));
  }

  public static getConnectorFromID(chargingStation: ChargingStation, connectorID: number): Connector {
    if (!chargingStation.connectors) {
      return null;
    }
    return chargingStation.connectors.find((connector) => connector && (connector.connectorId === connectorID));
  }

  public static computeChargingStationTotalAmps(chargingStation: ChargingStation): number {
    let totalAmps = 0;
    if (chargingStation) {
      // Check at Charging Station
      if (chargingStation.maximumPower) {
        return Utils.convertWattToAmp(chargingStation, null, 0, chargingStation.maximumPower);
      }
      // Check at charge point level
      if (chargingStation.chargePoints) {
        for (const chargePoint of chargingStation.chargePoints) {
          totalAmps += chargePoint.amperage;
        }
      }
      // Check at connector level
      if (totalAmps === 0 && chargingStation.connectors) {
        for (const connector of chargingStation.connectors) {
          totalAmps += connector.amperage;
        }
      }
    }
    return totalAmps;
  }

  public static getChargingStationPower(chargingStation: ChargingStation, chargePoint: ChargePoint, connectorId = 0): number {
    let totalPower = 0;
    if (chargingStation) {
      // Check at charge point level
      if (chargingStation.chargePoints) {
        for (const chargePointOfCS of chargingStation.chargePoints) {
          if (!chargePoint || chargePoint.chargePointID === chargePointOfCS.chargePointID) {
            // Charging Station
            if (connectorId === 0 && chargePointOfCS.power) {
              totalPower += chargePointOfCS.power;
            // Connector
            } else if (chargePointOfCS.connectorIDs.includes(connectorId) && chargePointOfCS.power) {
              if (chargePointOfCS.cannotChargeInParallel || chargePointOfCS.sharePowerToAllConnectors) {
                // Check Connector ID
                const connector = Utils.getConnectorFromID(chargingStation, connectorId);
                if (connector?.power) {
                  return connector.power;
                }
                return chargePointOfCS.power;
              }
              // Power is shared evenly on connectors
              return chargePointOfCS.power / chargePointOfCS.connectorIDs.length;
            }
          }
        }
      }
      // Check at connector level
      if (totalPower === 0 && chargingStation.connectors) {
        for (const connector of chargingStation.connectors) {
          if (connectorId === 0 && connector.power) {
            totalPower += connector.power;
          }
          if (connector.connectorId === connectorId && connector.power) {
            return connector.power;
          }
        }
      }
    }
    if (!totalPower) {
      const amperage = Utils.getChargingStationAmperage(chargingStation, chargePoint, connectorId);
      const voltage = Utils.getChargingStationVoltage(chargingStation, chargePoint, connectorId);
      if (voltage && amperage) {
        return voltage * amperage;
      }
    }
    return totalPower;
  }

  public static getNumberOfConnectedPhases(chargingStation: ChargingStation, chargePoint?: ChargePoint, connectorId = 0): number {
    if (chargingStation) {
      // Check at charge point level
      if (chargingStation.chargePoints) {
        for (const chargePointOfCS of chargingStation.chargePoints) {
          if (!chargePoint || chargePoint.chargePointID === chargePointOfCS.chargePointID) {
            // Charging Station
            if (connectorId === 0 && chargePointOfCS.numberOfConnectedPhase) {
              return chargePointOfCS.numberOfConnectedPhase;
            }
            // Connector
            if (chargePointOfCS.connectorIDs.includes(connectorId) && chargePointOfCS.numberOfConnectedPhase) {
              // Check Connector ID
              const connector = Utils.getConnectorFromID(chargingStation, connectorId);
              if (connector?.numberOfConnectedPhase) {
                return connector.numberOfConnectedPhase;
              }
              return chargePointOfCS.numberOfConnectedPhase;
            }
          }
        }
      }
      // Check at connector level
      if (chargingStation.connectors) {
        for (const connector of chargingStation.connectors) {
          // Take the first
          if (connectorId === 0 && connector.numberOfConnectedPhase) {
            return connector.numberOfConnectedPhase;
          }
          if (connector.connectorId === connectorId && connector.numberOfConnectedPhase) {
            return connector.numberOfConnectedPhase;
          }
        }
      }
    }
    return 1;
  }

  public static getChargingStationVoltage(chargingStation: ChargingStation, chargePoint?: ChargePoint, connectorId = 0): number {
    if (chargingStation) {
      // Check at charging station level
      if (chargingStation.voltage) {
        return chargingStation.voltage;
      }
      // Check at charge point level
      if (chargingStation.chargePoints) {
        for (const chargePointOfCS of chargingStation.chargePoints) {
          if (!chargePoint || chargePoint.chargePointID === chargePointOfCS.chargePointID) {
            // Charging Station
            if (connectorId === 0 && chargePointOfCS.voltage) {
              return chargePointOfCS.voltage;
            }
            // Connector
            if (chargePointOfCS.connectorIDs.includes(connectorId) && chargePointOfCS.voltage) {
              // Check Connector ID
              const connector = Utils.getConnectorFromID(chargingStation, connectorId);
              if (connector?.voltage) {
                return connector.voltage;
              }
              return chargePointOfCS.voltage;
            }
          }
        }
      }
      // Check at connector level
      if (chargingStation.connectors) {
        for (const connector of chargingStation.connectors) {
          // Take the first
          if (connectorId === 0 && connector.voltage) {
            return connector.voltage;
          }
          if (connector.connectorId === connectorId && connector.voltage) {
            return connector.voltage;
          }
        }
      }
    }
    return 0;
  }

  public static getChargingStationCurrentType(chargingStation: ChargingStation, chargePoint: ChargePoint, connectorId = 0): CurrentType {
    if (chargingStation) {
      // Check at charge point level
      if (chargingStation.chargePoints) {
        for (const chargePointOfCS of chargingStation.chargePoints) {
          if (!chargePoint || chargePoint.chargePointID === chargePointOfCS.chargePointID) {
            // Charging Station
            if (connectorId === 0 && chargePointOfCS.currentType) {
              return chargePointOfCS.currentType;
            // Connector
            } else if (chargePointOfCS.connectorIDs.includes(connectorId) && chargePointOfCS.currentType) {
              // Check Connector ID
              const connector = Utils.getConnectorFromID(chargingStation, connectorId);
              if (connector?.currentType) {
                return connector.currentType;
              }
              return chargePointOfCS.currentType;
            }
          }
        }
      }
      // Check at connector level
      if (chargingStation.connectors) {
        for (const connector of chargingStation.connectors) {
          // Take the first
          if (connectorId === 0 && connector.currentType) {
            return connector.currentType;
          }
          if (connector.connectorId === connectorId && connector.currentType) {
            return connector.currentType;
          }
        }
      }
    }
    return null;
  }

  public static getChargingStationAmperage(chargingStation: ChargingStation, chargePoint?: ChargePoint, connectorId = 0): number {
    let totalAmps = 0;
    if (chargingStation) {
      // Check at charge point level
      if (chargingStation.chargePoints) {
        for (const chargePointOfCS of chargingStation.chargePoints) {
          if (!chargePoint || chargePoint.chargePointID === chargePointOfCS.chargePointID) {
            // Charging Station
            if (connectorId === 0 && chargePointOfCS.amperage) {
              totalAmps += chargePointOfCS.amperage;
            } else if (chargePointOfCS.connectorIDs.includes(connectorId) && chargePointOfCS.amperage) {
              if (chargePointOfCS.cannotChargeInParallel || chargePointOfCS.sharePowerToAllConnectors) {
                // Same power for all connectors
                // Check Connector ID first
                const connector = Utils.getConnectorFromID(chargingStation, connectorId);
                if (connector?.amperage) {
                  return connector.amperage;
                }
                return chargePointOfCS.amperage;
              }
              // Power is split evenly per connector
              return chargePointOfCS.amperage / chargePointOfCS.connectorIDs.length;
            }
          }
        }
      }
      // Check at connector level
      if (totalAmps === 0 && chargingStation.connectors) {
        for (const connector of chargingStation.connectors) {
          if (connectorId === 0 && connector.amperage) {
            totalAmps += connector.amperage;
          }
          if (connector.connectorId === connectorId && connector.amperage) {
            return connector.amperage;
          }
        }
      }
    }
    return totalAmps;
  }

  public static getChargingStationAmperagePerPhase(chargingStation: ChargingStation, chargePoint?: ChargePoint, connectorId = 0): number {
    const totalAmps = Utils.getChargingStationAmperage(chargingStation, chargePoint, connectorId);
    const numberOfConnectedPhases = Utils.getNumberOfConnectedPhases(chargingStation, chargePoint, connectorId);
    if (totalAmps % numberOfConnectedPhases === 0) {
      return totalAmps / numberOfConnectedPhases;
    }
    return Math.round(totalAmps / numberOfConnectedPhases);
  }

  public static getChargingStationAmperageLimit(chargingStation: ChargingStation, chargePoint: ChargePoint, connectorId = 0): number {
    let amperageLimit = 0;
    if (chargingStation) {
      if (connectorId > 0) {
        return Utils.getConnectorFromID(chargingStation, connectorId)?.amperageLimit;
      }
      // Check at charge point level
      if (chargingStation.chargePoints) {
        for (const chargePointOfCS of chargingStation.chargePoints) {
          if (!chargePoint || chargePoint.chargePointID === chargePointOfCS.chargePointID) {
            if (chargePointOfCS.excludeFromPowerLimitation) {
              continue;
            }
            if (chargePointOfCS.cannotChargeInParallel ||
              chargePointOfCS.sharePowerToAllConnectors) {
              // Add limit amp of one connector
              amperageLimit += Utils.getConnectorFromID(chargingStation, chargePointOfCS.connectorIDs[0])?.amperageLimit;
            } else {
              // Add limit amp of all connectors
              for (const connectorID of chargePointOfCS.connectorIDs) {
                amperageLimit += Utils.getConnectorFromID(chargingStation, connectorID)?.amperageLimit;
              }
            }
          }
        }
      }
      // Check at connector level
      if (amperageLimit === 0 && chargingStation.connectors) {
        for (const connector of chargingStation.connectors) {
          amperageLimit += connector.amperageLimit;
        }
      }
    }
    return amperageLimit;
  }

  public static isEmptyArray(array: any[]): boolean {
    if (!array) {
      return true;
    }
    if (Array.isArray(array) && array.length > 0) {
      return false;
    }
    return true;
  }

  static isEmptyObject(obj: any): boolean {
    return !Object.keys(obj).length;
  }

  public static findDuplicatesInArray(arr: any[]): any[] {
    const sorted_arr = arr.slice().sort();
    const results: any[] = [];
    for (let i = 0; i < sorted_arr.length - 1; i++) {
      if (_.isEqual(sorted_arr[i + 1], sorted_arr[i])) {
        results.push(sorted_arr[i]);
      }
    }
    return results;
  }

  public static buildUserFullName(user: User | UserToken, withID = true, withEmail = false): string {
    let fullName: string;
    if (!user || !user.name) {
      return '-';
    }
    if (user.firstName) {
      fullName = `${user.firstName} ${user.name}`;
    } else {
      fullName = user.name;
    }
    if (withID && user.id) {
      fullName += ` (${user.id})`;
    }
    if (withEmail && user.email) {
      fullName += ` ${user.email}`;
    }
    return fullName;
  }

  public static buildCarCatalogName(carCatalog: CarCatalog, withID = false): string {
    let carCatalogName: string;
    if (!carCatalog) {
      return '-';
    }
    carCatalogName = carCatalog.vehicleMake;
    if (carCatalog.vehicleModel) {
      carCatalogName += ` ${carCatalog.vehicleModel}`;
    }
    if (carCatalog.vehicleModelVersion) {
      carCatalogName += ` ${carCatalog.vehicleModelVersion}`;
    }
    if (withID && carCatalog.id) {
      carCatalogName += ` (${carCatalog.id})`;
    }
    return carCatalogName;
  }

  public static buildCarName(car: Car, withID = false): string {
    let carName: string;
    if (!car) {
      return '-';
    }
    if (car.carCatalog) {
      carName = Utils.buildCarCatalogName(car.carCatalog, withID);
    }
    if (!carName) {
      carName = `VIN '${car.vin}', License Plate '${car.licensePlate}'`;
    } else {
      carName += ` with VIN '${car.vin}' and License Plate '${car.licensePlate}'`;
    }
    if (withID && car.id) {
      carName += ` (${car.id})`;
    }
    return carName;
  }

  // Save the users in file
  public static saveFile(filename: string, content: string): void {
    // Save
    fs.writeFileSync(path.join(__dirname, filename), content, 'UTF-8');
  }

  public static getRandomInt(): number {
    return Math.floor((Math.random() * 2147483648) + 1); // INT32 (signed: issue in Schneider)
  }

  public static buildRestServerURL(): string {
    const centralSystemRestServer = Configuration.getCentralSystemRestServer();
    return `${centralSystemRestServer.protocol}://${centralSystemRestServer.host}:${centralSystemRestServer.port}`;
  }

  public static buildEvseURL(subdomain: string = null): string {
    const centralSystemFrontEndConfig = Configuration.getCentralSystemFrontEndConfig();
    if (subdomain) {
      return `${centralSystemFrontEndConfig.protocol}://${subdomain}.${centralSystemFrontEndConfig.host}:${centralSystemFrontEndConfig.port}`;
    }
    return `${centralSystemFrontEndConfig.protocol}://${centralSystemFrontEndConfig.host}:${centralSystemFrontEndConfig.port}`;
  }

  public static buildOCPPServerURL(tenantID: string, ocppVersion: OCPPVersion, ocppProtocol: OCPPProtocol, token?: string): string {
    let ocppUrl: string;
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

  public static async buildEvseTagURL(tenantID: string, tag: Tag): Promise<string> {
    const tenant = await TenantStorage.getTenant(tenantID);
    return `${Utils.buildEvseURL(tenant.subdomain)}/users#tag?TagID=${tag.id}`;
  }


  public static async buildEvseChargingStationURL(tenantID: string, chargingStation: ChargingStation, hash = ''): Promise<string> {
    const tenant = await TenantStorage.getTenant(tenantID);
    return `${Utils.buildEvseURL(tenant.subdomain)}/charging-stations?ChargingStationID=${chargingStation.id}${hash}`;
  }

  public static async buildEvseTransactionURL(tenantID: string, chargingStation: ChargingStation, transactionId: number, hash = ''): Promise<string> {
    const tenant = await TenantStorage.getTenant(tenantID);
    return `${Utils.buildEvseURL(tenant.subdomain)}/transactions?TransactionID=${transactionId.toString()}${hash}`;
  }

  public static async buildEvseBillingSettingsURL(tenantID: string): Promise<string> {
    const tenant = await TenantStorage.getTenant(tenantID);
    return `${Utils.buildEvseURL(tenant.subdomain)}/settings#billing`;
  }

  public static async buildEvseBillingInvoicesURL(tenantID: string): Promise<string> {
    const tenant = await TenantStorage.getTenant(tenantID);
    return `${Utils.buildEvseURL(tenant.subdomain)}/invoices`;
  }

  public static async buildEvseBillingDownloadInvoicesURL(tenantID: string, invoiceID: string): Promise<string> {
    const tenant = await TenantStorage.getTenant(tenantID);
    return `${Utils.buildEvseURL(tenant.subdomain)}/invoices?InvoiceID=${invoiceID}#all`;
  }

  public static hideShowMessage(message: string): string {
    // Check Prod
    if (Utils.isProductionEnv()) {
      return 'An unexpected server error occurred. Check the server\'s logs!';
    }
    return message;
  }

  public static getRequestIP(request: http.IncomingMessage | Partial<Request>): string | string[] {
    if (request['ip']) {
      return request['ip'];
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

  public static roundTo(number: number, scale: number): number {
    return Utils.convertToFloat(number.toFixed(scale));
  }

  public static firstLetterInUpperCase(value: string): string {
    return value[0].toUpperCase() + value.substring(1);
  }

  public static firstLetterInLowerCase(value: string): string {
    return value[0].toLowerCase() + value.substring(1);
  }

  public static cloneObject(object: any): any {
    return JSON.parse(JSON.stringify(object));
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

  public static generateToken(email: string): string {
    return Cypher.hash(`${crypto.randomBytes(256).toString('hex')}}~${new Date().toISOString()}~${email}`);
  }

  public static getRoleNameFromRoleID(roleID: string): string {
    switch (roleID) {
      case UserRole.BASIC:
        return 'Basic';
      case UserRole.DEMO:
        return 'Demo';
      case UserRole.ADMIN:
        return 'Admin';
      case UserRole.SUPER_ADMIN:
        return 'Super Admin';
      default:
        return 'Unknown';
    }
  }

  public static async hashPasswordBcrypt(password: string): Promise<string> {
    // eslint-disable-next-line no-undef
    return await new Promise((fulfill, reject) => {
      // Generate a salt with 15 rounds
      bcrypt.genSalt(10, (error, salt) => {
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

  public static async checkPasswordBCrypt(password: string, hash: string): Promise<boolean> {
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

  public static isPasswordStrongEnough(password: string): boolean {
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

  public static containsAddressGPSCoordinates(address: Address): boolean {
    // Check if GPS are available
    if (address && Utils.containsGPSCoordinates(address.coordinates)) {
      return true;
    }
    return false;
  }

  public static containsGPSCoordinates(coordinates: number[]): boolean {
    // Check if GPs are available
    if (coordinates && coordinates.length === 2 && coordinates[0] && coordinates[1]) {
      // Check Longitude & Latitude
      if (new RegExp(Constants.REGEX_VALIDATION_LONGITUDE).test(coordinates[0].toString()) &&
        new RegExp(Constants.REGEX_VALIDATION_LATITUDE).test(coordinates[1].toString())) {
        return true;
      }
    }
    return false;
  }

  public static generatePassword(): string {
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
      case UserStatus.PENDING:
        return 'Pending';
      case UserStatus.LOCKED:
        return 'Locked';
      case UserStatus.BLOCKED:
        return 'Blocked';
      case UserStatus.ACTIVE:
        return 'Active';
      case UserStatus.INACTIVE:
        return 'Inactive';
      default:
        return 'Unknown';
    }
  }

  public static hashPassword(password: string): string {
    return Cypher.hash(password);
  }

  public static checkIfOCPIEndpointValid(ocpiEndpoint: Partial<OCPIEndpoint>, req: Request): void {
    if (req.method !== 'POST' && !ocpiEndpoint.id) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The OCPI Endpoint ID is mandatory',
        module: MODULE_NAME,
        method: 'checkIfOCPIEndpointValid'
      });
    }
    if (!ocpiEndpoint.name) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The OCPI Endpoint name is mandatory',
        module: MODULE_NAME,
        method: 'checkIfOCPIEndpointValid',
        user: req.user.id
      });
    }
    if (!ocpiEndpoint.role) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The OCPI Endpoint role is mandatory',
        module: MODULE_NAME,
        method: 'checkIfOCPIEndpointValid',
        user: req.user.id
      });
    }
    if (!ocpiEndpoint.baseUrl) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The OCPI Endpoint base URL is mandatory',
        module: MODULE_NAME,
        method: 'checkIfOCPIEndpointValid',
        user: req.user.id
      });
    }
    if (ocpiEndpoint.countryCode && !countries.isValid(ocpiEndpoint.countryCode)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `The OCPI Endpoint ${ocpiEndpoint.countryCode} country code provided is invalid`,
        module: MODULE_NAME,
        method: 'checkIfOCPIEndpointValid',
        user: req.user.id
      });
    }
    if (!ocpiEndpoint.localToken) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The OCPI Endpoint local token is mandatory',
        module: MODULE_NAME,
        method: 'checkIfOCPIEndpointValid',
        user: req.user.id
      });
    }
    if (!ocpiEndpoint.token) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The OCPI Endpoint token is mandatory',
        module: MODULE_NAME,
        method: 'checkIfOCPIEndpointValid',
        user: req.user.id
      });
    }
  }

  public static checkIfChargingProfileIsValid(chargingStation: ChargingStation, chargePoint: ChargePoint,
    filteredRequest: ChargingProfile, req: Request): void {
    if (!Utils.objectHasProperty(filteredRequest, 'chargingStationID')) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.CHARGING_PROFILE_UPDATE,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Charging Station ID is mandatory',
        module: MODULE_NAME, method: 'checkIfChargingProfileIsValid',
        user: req.user.id
      });
    }
    if (!Utils.objectHasProperty(filteredRequest, 'connectorID')) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.CHARGING_PROFILE_UPDATE,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Connector ID is mandatory',
        module: MODULE_NAME, method: 'checkIfChargingProfileIsValid',
        user: req.user.id
      });
    }
    if (!filteredRequest.profile) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.CHARGING_PROFILE_UPDATE,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Charging Profile is mandatory',
        module: MODULE_NAME, method: 'checkIfChargingProfileIsValid',
        user: req.user.id
      });
    }
    if (!filteredRequest.profile.chargingProfileId || !filteredRequest.profile.stackLevel ||
      !filteredRequest.profile.chargingProfilePurpose || !filteredRequest.profile.chargingProfileKind ||
      !filteredRequest.profile.chargingSchedule) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.CHARGING_PROFILE_UPDATE,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Invalid Charging Profile',
        module: MODULE_NAME, method: 'checkIfChargingProfileIsValid',
        user: req.user.id
      });
    }
    if (!filteredRequest.profile.chargingSchedule.chargingSchedulePeriod) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.CHARGING_PROFILE_UPDATE,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Invalid Charging Profile\'s Schedule',
        module: MODULE_NAME, method: 'checkIfChargingProfileIsValid',
        user: req.user.id
      });
    }
    if (filteredRequest.profile.chargingSchedule.chargingSchedulePeriod.length === 0) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.CHARGING_PROFILE_UPDATE,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Charging Profile\'s schedule must not be empty',
        module: MODULE_NAME, method: 'checkIfChargingProfileIsValid',
        user: req.user.id
      });
    }
    // Check End of Schedule <= 24h
    const endScheduleDate = new Date(new Date(filteredRequest.profile.chargingSchedule.startSchedule).getTime() +
      filteredRequest.profile.chargingSchedule.duration * 1000);
    if (!moment(endScheduleDate).isBefore(moment(filteredRequest.profile.chargingSchedule.startSchedule).add('1', 'd').add('1', 'm'))) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.CHARGING_PROFILE_UPDATE,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Charging Profile\'s schedule should not exeed 24 hours',
        module: MODULE_NAME, method: 'checkIfChargingProfileIsValid',
        user: req.user.id
      });
    }
    // Check Max Limitation of each Schedule
    // const numberOfPhases = Utils.getNumberOfConnectedPhases(chargingStation, null, filteredRequest.connectorID);
    // const numberOfConnectors = filteredRequest.connectorID === 0 ?
    //   (chargePoint ? chargePoint.connectorIDs.length : chargingStation.connectors.length) : 1;
    const maxAmpLimit = Utils.getChargingStationAmperageLimit(
      chargingStation, chargePoint, filteredRequest.connectorID);
    for (const chargingSchedulePeriod of filteredRequest.profile.chargingSchedule.chargingSchedulePeriod) {
      // Check Min
      if (chargingSchedulePeriod.limit < 0) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          action: ServerAction.CHARGING_PROFILE_UPDATE,
          errorCode: HTTPError.GENERAL_ERROR,
          message: 'Charging Schedule is below the min limitation (0A)',
          module: MODULE_NAME, method: 'checkIfChargingProfileIsValid',
          user: req.user.id,
          detailedMessages: { chargingSchedulePeriod }
        });
      }
      // Check Max
      if (chargingSchedulePeriod.limit > maxAmpLimit) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          action: ServerAction.CHARGING_PROFILE_UPDATE,
          errorCode: HTTPError.GENERAL_ERROR,
          message: `Charging Schedule is above the max limitation (${maxAmpLimit}A)`,
          module: MODULE_NAME, method: 'checkIfChargingProfileIsValid',
          user: req.user.id,
          detailedMessages: { chargingSchedulePeriod }
        });
      }
    }
  }

  public static checkIfSiteValid(site: Partial<Site>, req: Request): void {
    if (req.method !== 'POST' && !site.id) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Site ID is mandatory',
        module: MODULE_NAME, method: 'checkIfSiteValid',
        user: req.user.id
      });
    }
    if (!site.name) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Site Name is mandatory',
        module: MODULE_NAME, method: 'checkIfSiteValid',
        user: req.user.id
      });
    }
    if (!site.companyID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Company ID is mandatory for the Site',
        module: MODULE_NAME, method: 'checkIfSiteValid',
        user: req.user.id
      });
    }
  }

  public static checkIfSiteAreaValid(siteArea: Partial<SiteArea>, req: Request): void {
    if (req.method !== 'POST' && !siteArea.id) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Site Area ID is mandatory',
        module: MODULE_NAME, method: 'checkIfSiteAreaValid',
        user: req.user.id
      });
    }
    if (!siteArea.name) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Site Area name is mandatory',
        module: MODULE_NAME, method: 'checkIfSiteAreaValid',
        user: req.user.id
      });
    }
    if (!siteArea.siteID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Site ID is mandatory',
        module: MODULE_NAME, method: 'checkIfSiteAreaValid',
        user: req.user.id
      });
    }
    // Power
    if (siteArea.maximumPower <= 0) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Site maximum power must be a positive number but got ${siteArea.maximumPower} kW`,
        module: MODULE_NAME, method: 'checkIfSiteAreaValid',
        user: req.user.id
      });
    }
    if (siteArea.voltage !== 230 && siteArea.voltage !== 110) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Site voltage must be either 110V or 230V but got ${siteArea.voltage} kW`,
        module: MODULE_NAME, method: 'checkIfSiteAreaValid',
        user: req.user.id
      });
    }
    if (siteArea.numberOfPhases !== 1 && siteArea.numberOfPhases !== 3) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Site area number of phases must be either 1 or 3 but got ${siteArea.numberOfPhases}`,
        module: MODULE_NAME, method: 'checkIfSiteAreaValid',
        user: req.user.id
      });
    }
  }

  public static checkIfCompanyValid(company: Partial<Company>, req: Request): void {
    if (req.method !== 'POST' && !company.id) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Company ID is mandatory',
        module: MODULE_NAME, method: 'checkIfCompanyValid',
        user: req.user.id
      });
    }
    if (!company.name) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Company Name is mandatory',
        module: MODULE_NAME, method: 'checkIfCompanyValid',
        user: req.user.id
      });
    }
  }

  public static isValidDate(date: any): boolean {
    return moment(date).isValid();
  }

  public static checkIfAssetValid(asset: Partial<Asset>, req: Request): void {
    if (req.method !== 'POST' && !asset.id) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Asset ID is mandatory',
        module: MODULE_NAME, method: 'checkIfAssetValid',
        user: req.user.id
      });
    }
    if (!asset.name) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Asset Name is mandatory',
        module: MODULE_NAME, method: 'checkIfAssetValid',
        user: req.user.id
      });
    }
    if (!asset.siteAreaID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Asset Site Area is mandatory',
        module: MODULE_NAME, method: 'checkIfAssetValid',
        user: req.user.id
      });
    }
    if (!asset.assetType) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Asset type is mandatory',
        module: MODULE_NAME, method: 'checkIfAssetValid',
        user: req.user.id
      });
    }
    if (asset.dynamicAsset) {
      if (!asset.connectionID) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.GENERAL_ERROR,
          message: 'Asset connection is mandatory',
          module: MODULE_NAME, method: 'checkIfAssetValid',
          user: req.user.id
        });
      }
      if (!asset.meterID) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.GENERAL_ERROR,
          message: 'Asset meter ID is mandatory',
          module: MODULE_NAME, method: 'checkIfAssetValid',
          user: req.user.id
        });
      }
    }
  }

  public static isDevelopmentEnv(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  public static isProductionEnv(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  public static isTestEnv(): boolean {
    return process.env.NODE_ENV === 'test';
  }

  public static async checkIfUserTagIsValid(tag: Partial<Tag>, req: Request): Promise<void> {
    // Check authorization
    if (!Authorizations.isAdmin(req.user)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Only Admins can change/create the Tags',
        module: MODULE_NAME, method: 'checkIfUserTagIsValid',
        user: req.user.id
      });
    }
    // Check badge ID
    if (!tag.id) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Tag ID is mandatory',
        module: MODULE_NAME, method: 'checkIfUserTagIsValid',
        user: req.user.id
      });
    }
    // Check description
    if (!tag.description) {
      tag.description = `Tag ID '${tag.id}'`;
    }
    // Check user ID
    if (!tag.userID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'User ID is mandatory',
        module: MODULE_NAME, method: 'checkIfUserTagIsValid',
        user: req.user.id
      });
    }
    // Check user activation
    if (!Utils.objectHasProperty(tag, 'active')) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Tag Active property is mandatory',
        module: MODULE_NAME, method: 'checkIfUserTagIsValid',
        user: req.user.id
      });
    }
  }


  public static checkIfUserValid(filteredRequest: Partial<User>, user: User, req: Request): void {
    const tenantID = req.user.tenantID;
    if (!tenantID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Tenant is mandatory',
        module: MODULE_NAME,
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
        module: MODULE_NAME,
        method: 'checkIfUserValid',
        user: req.user.id
      });
    }
    // Creation?
    if (req.method === 'POST') {
      if (!filteredRequest.role) {
        filteredRequest.role = UserRole.BASIC;
      }
    } else if (!Authorizations.isAdmin(req.user)) {
      filteredRequest.role = user.role;
    }
    if (req.method === 'POST' && !filteredRequest.status) {
      filteredRequest.status = UserStatus.BLOCKED;
    }
    // Creation?
    if ((filteredRequest.role !== UserRole.BASIC) && (filteredRequest.role !== UserRole.DEMO) &&
      !Authorizations.isAdmin(req.user) && !Authorizations.isSuperAdmin(req.user)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Only Admins can assign the role '${Utils.getRoleNameFromRoleID(filteredRequest.role)}'`,
        module: MODULE_NAME,
        method: 'checkIfUserValid',
        user: req.user.id,
        actionOnUser: filteredRequest.id
      });
    }
    // Only Basic, Demo, Admin user other Tenants (!== default)
    if (tenantID !== 'default' && filteredRequest.role && filteredRequest.role === UserRole.SUPER_ADMIN) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'User cannot have the Super Admin role in this Tenant',
        module: MODULE_NAME,
        method: 'checkIfUserValid',
        user: req.user.id,
        actionOnUser: filteredRequest.id
      });
    }
    // Only Admin and Super Admin can use role different from Basic
    if ((filteredRequest.role === UserRole.ADMIN || filteredRequest.role === UserRole.SUPER_ADMIN) &&
      !Authorizations.isAdmin(req.user) && !Authorizations.isSuperAdmin(req.user)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `User without role Admin or Super Admin tried to ${filteredRequest.id ? 'update' : 'create'} an User with the '${Utils.getRoleNameFromRoleID(filteredRequest.role)}' role`,
        module: MODULE_NAME,
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
        module: MODULE_NAME,
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
        module: MODULE_NAME,
        method: 'checkIfUserValid',
        user: req.user.id,
        actionOnUser: filteredRequest.id
      });
    }
    if (req.method === 'POST' && !Utils.isUserEmailValid(filteredRequest.email)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `User Email '${filteredRequest.email}' is not valid`,
        module: MODULE_NAME,
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
        module: MODULE_NAME,
        method: 'checkIfUserValid',
        user: req.user.id,
        actionOnUser: filteredRequest.id
      });
    }
    if (filteredRequest.phone && !Utils.isPhoneValid(filteredRequest.phone)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `User Phone '${filteredRequest.phone}' is not valid`,
        module: MODULE_NAME,
        method: 'checkIfUserValid',
        user: req.user.id,
        actionOnUser: filteredRequest.id
      });
    }
    if (filteredRequest.mobile && !Utils.isPhoneValid(filteredRequest.mobile)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `User Mobile '${filteredRequest.mobile}' is not valid`,
        module: MODULE_NAME,
        method: 'checkIfUserValid',
        user: req.user.id,
        actionOnUser: filteredRequest.id
      });
    }
    if (filteredRequest.plateID && !Utils.isPlateIDValid(filteredRequest.plateID)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `User Plate ID '${filteredRequest.plateID}' is not valid`,
        module: MODULE_NAME,
        method: 'checkIfUserValid',
        user: req.user.id,
        actionOnUser: filteredRequest.id
      });
    }
  }

  public static async addSiteLimitationToConsumption(tenantID: string, siteArea: SiteArea, consumption: Consumption): Promise<void> {
    const tenant: Tenant = await TenantStorage.getTenant(tenantID);
    if (Utils.isTenantComponentActive(tenant, TenantComponents.ORGANIZATION) && siteArea) {
      // Get limit of the site area
      consumption.limitSiteAreaWatts = 0;
      // Maximum power of the Site Area provided?
      if (siteArea && siteArea.maximumPower) {
        consumption.limitSiteAreaWatts = siteArea.maximumPower;
        consumption.limitSiteAreaAmps = siteArea.maximumPower / siteArea.voltage;
        consumption.limitSiteAreaSource = SiteAreaLimitSource.SITE_AREA;
      } else {
        // Compute it for Charging Stations
        const chargingStationsOfSiteArea = await ChargingStationStorage.getChargingStations(tenantID, { siteAreaIDs: [siteArea.id] }, Constants.DB_PARAMS_MAX_LIMIT);
        for (const chargingStationOfSiteArea of chargingStationsOfSiteArea.result) {
          for (const connector of chargingStationOfSiteArea.connectors) {
            consumption.limitSiteAreaWatts += connector.power;
          }
        }
        consumption.limitSiteAreaAmps = Math.round(consumption.limitSiteAreaWatts / siteArea.voltage);
        consumption.limitSiteAreaSource = SiteAreaLimitSource.CHARGING_STATIONS;
        // Save Site Area max consumption
        if (siteArea) {
          siteArea.maximumPower = consumption.limitSiteAreaWatts;
          await SiteAreaStorage.saveSiteArea(tenantID, siteArea);
        }
      }
      consumption.smartChargingActive = siteArea.smartCharging;
    }
  }

  public static getTimezone(coordinates: number[]): string {
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

  public static isTenantComponentActive(tenant: Tenant, component: TenantComponents): boolean {
    for (const componentName in tenant.components) {
      if (componentName === component) {
        return tenant.components[componentName].active;
      }
    }
    return false;
  }

  public static createDefaultSettingContent(activeComponent: any, currentSettingContent: SettingDBContent): SettingDBContent {
    switch (activeComponent.name) {
      // Pricing
      case TenantComponents.PRICING:
        if (!currentSettingContent || currentSettingContent.type !== activeComponent.type) {
          // Create default settings
          if (activeComponent.type === PricingSettingsType.SIMPLE) {
            // Simple Pricing
            return {
              'type': PricingSettingsType.SIMPLE,
              'simple': {}
            } as SettingDBContent;
          } else if (activeComponent.type === PricingSettingsType.CONVERGENT_CHARGING) {
            // SAP CC
            return {
              'type': PricingSettingsType.CONVERGENT_CHARGING,
              'convergentCharging': {}
            } as SettingDBContent;
          }
        }
        break;

      // Billing
      case TenantComponents.BILLING:
        if (!currentSettingContent || currentSettingContent.type !== activeComponent.type) {
          // Only Stripe
          return {
            'type': BillingSettingsType.STRIPE,
            'stripe': {}
          } as SettingDBContent;
        }
        break;

      // Refund
      case TenantComponents.REFUND:
        if (!currentSettingContent || currentSettingContent.type !== activeComponent.type) {
          // Only Concur
          return {
            'type': RefundSettingsType.CONCUR,
            'concur': {}
          } as SettingDBContent;
        }
        break;

      // Refund
      case TenantComponents.OCPI:
        if (!currentSettingContent || currentSettingContent.type !== activeComponent.type) {
          // Only Gireve
          return {
            'type': RoamingSettingsType.GIREVE,
            'ocpi': {}
          } as SettingDBContent;
        }
        break;

      // SAC
      case TenantComponents.ANALYTICS:
        if (!currentSettingContent || currentSettingContent.type !== activeComponent.type) {
          // Only SAP Analytics
          return {
            'type': AnalyticsSettingsType.SAC,
            'sac': {}
          } as SettingDBContent;
        }
        break;

      // Smart Charging
      case TenantComponents.SMART_CHARGING:
        if (!currentSettingContent || currentSettingContent.type !== activeComponent.type) {
          // Only SAP sapSmartCharging
          return {
            'type': SmartChargingContentType.SAP_SMART_CHARGING,
            'sapSmartCharging': {}
          } as SettingDBContent;
        }
        break;

      // Asset
      case TenantComponents.ASSET:
        if (!currentSettingContent || currentSettingContent.type !== activeComponent.type) {
          // Only Asset
          return {
            'type': AssetSettingsType.ASSET,
            'asset': {
              connections: []
            }
          } as SettingDBContent;
        }
        break;
    }
  }

  public static isChargingStationIDValid(name: string): boolean {
    // eslint-disable-next-line no-useless-escape
    return /^[A-Za-z0-9_\.\-~]*$/.test(name);
  }

  public static isPasswordValid(password: string): boolean {
    // eslint-disable-next-line no-useless-escape
    return /(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!#@:;,<>\/''\$%\^&\*\.\?\-_\+\=\(\)])(?=.{8,})/.test(password);
  }

  public static checkIfCarValid(car: Partial<Car>, req: Request): void {
    if (req.method !== 'POST' && !car.id) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Car ID is mandatory',
        module: MODULE_NAME, method: 'checkIfCarValid',
        user: req.user.id
      });
    }
    if (!car.vin) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Car Vin is mandatory',
        module: MODULE_NAME, method: 'checkIfCarValid',
        user: req.user.id
      });
    }
    if (!car.licensePlate) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'License Plate is mandatory',
        module: MODULE_NAME, method: 'checkIfCarValid',
        user: req.user.id
      });
    }
    if (!Utils.isPlateIDValid(car.licensePlate)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Car License Plate ID '${car.licensePlate}' is not valid`,
        module: MODULE_NAME, method: 'checkIfCarValid',
        user: req.user.id,
        actionOnUser: car.id
      });
    }
    if (!car.carCatalogID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Car Catalog ID is mandatory',
        module: MODULE_NAME, method: 'checkIfCarValid',
        user: req.user.id
      });
    }
    if (!car.type) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Car type is mandatory',
        module: MODULE_NAME, method: 'checkIfCarValid',
        user: req.user.id
      });
    }
    if (!Authorizations.isAdmin(req.user)) {
      if (car.type === CarType.POOL_CAR) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.GENERAL_ERROR,
          message: 'Pool cars can only be created by admin',
          module: MODULE_NAME, method: 'checkIfCarValid',
          user: req.user.id
        });
      }
    }
    if (!car.converter) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Car Converter is mandatory',
        module: MODULE_NAME, method: 'checkIfCarValid',
        user: req.user.id
      });
    }
    if (!car.converter.amperagePerPhase) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Car Converter amperage per phase is mandatory',
        module: MODULE_NAME, method: 'checkIfCarValid',
        user: req.user.id
      });
    }
    if (!car.converter.numberOfPhases) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Car Converter number of phases is mandatory',
        module: MODULE_NAME, method: 'checkIfCarValid',
        user: req.user.id
      });
    }
    if (!car.converter.powerWatts) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Car Converter power is mandatory',
        module: MODULE_NAME, method: 'checkIfCarValid',
        user: req.user.id
      });
    }
    if (!car.converter.type) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Car Converter type is mandatory',
        module: MODULE_NAME, method: 'checkIfCarValid',
        user: req.user.id
      });
    }
  }

  public static checkIfEndUserErrorNotificationValid(endUserErrorNotificationValid: HttpEndUserReportErrorRequest, req: Request): void {
    if (!endUserErrorNotificationValid.subject) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Subject is mandatory.',
        module: MODULE_NAME, method: 'checkIfEndUserErrorNotificationValid',
        user: req.user.id
      });
    }
    if (!endUserErrorNotificationValid.description) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Description is mandatory.',
        module: MODULE_NAME, method: 'checkIfEndUserErrorNotificationValid',
        user: req.user.id
      });
    }
    if (endUserErrorNotificationValid.mobile && !this.isPhoneValid(endUserErrorNotificationValid.mobile)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Phone is invalid',
        module: MODULE_NAME, method: 'checkIfEndUserErrorNotificationValid',
        user: req.user.id
      });
    }
  }

  private static isPhoneValid(phone: string): boolean {
    return /^\+?([0-9] ?){9,14}[0-9]$/.test(phone);
  }

  private static isUserEmailValid(email: string): boolean {
    return validator.isEmail(email);
  }

  private static areTagsValid(tags: Tag[]): boolean {
    return tags.filter((tag) => /^[A-Za-z0-9,]*$/.test(tag.id)).length === tags.length;
  }

  private static isPlateIDValid(plateID): boolean {
    return /^[A-Z0-9- ]*$/.test(plateID);
  }

  private static normalizeOneSOAPParam(headers: any, name: string) {
    const val = _.get(headers, name);
    if (val && val.$value) {
      _.set(headers, name, val.$value);
    }
  }
}
