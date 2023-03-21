import * as CountriesList from 'countries-list';

import ChargingStation, { ChargePoint, Connector, ConnectorType, CurrentType, Voltage } from '../../../types/ChargingStation';
import { OCPICapability, OCPIEvse, OCPIEvseStatus } from '../../../types/ocpi/OCPIEvse';
import { OCPIConnector, OCPIConnectorFormat, OCPIConnectorType, OCPIPowerType, OCPIVoltage } from '../../../types/ocpi/OCPIConnector';
import { OCPILocation, OCPILocationOptions, OCPILocationType, OCPIOpeningTimes } from '../../../types/ocpi/OCPILocation';
import { OCPISession, OCPISessionStatus } from '../../../types/ocpi/OCPISession';
import Transaction, { InactivityStatus } from '../../../types/Transaction';

import AppError from '../../../exception/AppError';
import { ChargePointStatus } from '../../../types/ocpp/OCPPServer';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import Constants from '../../../utils/Constants';
import Consumption from '../../../types/Consumption';
import ConsumptionStorage from '../../../storage/mongodb/ConsumptionStorage';
import { DataResult } from '../../../types/DataResult';
import DbParams from '../../../types/database/DbParams';
import { HTTPError } from '../../../types/HTTPError';
import Logging from '../../../utils/Logging';
import LoggingHelper from '../../../utils/LoggingHelper';
import NotificationHelper from '../../../utils/NotificationHelper';
import { OCPIBusinessDetails } from '../../../types/ocpi/OCPIBusinessDetails';
import { OCPICdr } from '../../../types/ocpi/OCPICdr';
import { OCPIResponse } from '../../../types/ocpi/OCPIResponse';
import { OCPIStatusCode } from '../../../types/ocpi/OCPIStatusCode';
import { OCPIToken } from '../../../types/ocpi/OCPIToken';
import OCPIUtils from '../OCPIUtils';
import OCPPUtils from '../../ocpp/utils/OCPPUtils';
import { OcpiSetting } from '../../../types/Setting';
import { PricingSource } from '../../../types/Pricing';
import { Request } from 'express';
import RoamingUtils from '../../../utils/RoamingUtils';
import { ServerAction } from '../../../types/Server';
import Site from '../../../types/Site';
import SiteStorage from '../../../storage/mongodb/SiteStorage';
import { StatusCodes } from 'http-status-codes';
import Tag from '../../../types/Tag';
import TagStorage from '../../../storage/mongodb/TagStorage';
import Tenant from '../../../types/Tenant';
import TransactionStorage from '../../../storage/mongodb/TransactionStorage';
import User from '../../../types/User';
import Utils from '../../../utils/Utils';
import countries from 'i18n-iso-countries';
import moment from 'moment';

const MODULE_NAME = 'OCPIUtilsService';

export default class OCPIUtilsService {
  public static getServiceUrl(req: Request, role: string): string {
    const baseUrl = OCPIUtilsService.getBaseUrl(req);
    return `${baseUrl}/ocpi/${role}`;
  }

  public static getBaseUrl(req: Request): string {
    // Get host from the req
    const host = req.get('host');
    // Return Service url
    return `https://${host}`;
  }

  public static isSuccessResponse(response: OCPIResponse): boolean {
    return !Utils.objectHasProperty(response, 'status_code') ||
      response.status_code === 1000;
  }

  public static async getAllCpoLocations(tenant: Tenant, limit: number, skip: number,
      options: OCPILocationOptions, withChargingStations: boolean, settings: OcpiSetting): Promise<DataResult<OCPILocation>> {
    // Result
    const ocpiLocationsResult: DataResult<OCPILocation> = { count: 0, result: [] };
    // Get all sites
    const sites = await SiteStorage.getSites(tenant,
      { issuer: true, public: true },
      limit === 0 ? Constants.DB_PARAMS_MAX_LIMIT : { limit, skip },
      ['id', 'name', 'address', 'ownerName', 'lastChangedOn', 'createdOn']);
    // Convert Sites to Locations
    for (const site of sites.result) {
      ocpiLocationsResult.result.push(
        await OCPIUtilsService.convertSite2Location(tenant, site, options, withChargingStations, settings));
    }
    let nbrOfSites = sites.count;
    if (nbrOfSites === -1) {
      const sitesCount = await SiteStorage.getSites(tenant,
        { issuer: true, public: true }, Constants.DB_PARAMS_COUNT_ONLY);
      nbrOfSites = sitesCount.count;
    }
    // Set count
    ocpiLocationsResult.count = nbrOfSites;
    // Return locations
    return ocpiLocationsResult;
  }

  public static async getEmspTokensFromTags(tenant: Tenant, limit: number, skip: number,
      dateFrom?: Date, dateTo?: Date): Promise<DataResult<OCPIToken>> {
    // Result
    const tokens: OCPIToken[] = [];
    // Get all tokens
    const tags = await TagStorage.getTags(tenant,
      { issuer: true, dateFrom, dateTo, withUsersOnly: true, withUser: true },
      { limit, skip },
      [ 'id', 'visualID', 'active', 'userID', 'user.status', 'user.deleted', 'lastChangedOn' ]);
    // Convert Sites to Locations
    for (const tag of tags.result) {
      // Create Token
      const ocpiToken = OCPIUtils.buildEmspTokenFromTag(tenant, tag);
      tokens.push(ocpiToken);
    }
    let nbrOfTags = tags.count;
    if (nbrOfTags === -1) {
      const tagsCount = await TagStorage.getTags(tenant,
        { issuer: true, dateFrom, dateTo, withUsersOnly: true },
        Constants.DB_PARAMS_COUNT_ONLY);
      nbrOfTags = tagsCount.count;
    }
    return {
      count: nbrOfTags,
      result: tokens
    };
  }

  public static async convertSite2Location(tenant: Tenant, site: Site,
      options: OCPILocationOptions, withChargingStations: boolean, settings: OcpiSetting): Promise<OCPILocation> {
    const hasValidSiteGpsCoordinates = Utils.hasValidGpsCoordinates(site.address?.coordinates);
    return {
      id: site.id,
      type: OCPILocationType.UNKNOWN,
      name: site.name,
      address: `${site.address.address1} ${site.address.address2}`,
      city: site.address.city,
      postal_code: site.address.postalCode,
      country: countries.getAlpha3Code(site.address.country, CountriesList.countries[options.countryID].languages[0]),
      coordinates: {
        longitude: hasValidSiteGpsCoordinates ? site.address.coordinates[0].toString() : Constants.SFDP_LONGITUDE.toString(),
        latitude: hasValidSiteGpsCoordinates ? site.address.coordinates[1].toString() : Constants.SFDP_LATTITUDE.toString()
      },
      evses: withChargingStations ?
        await OCPIUtilsService.getCpoEvsesFromSite(tenant, site.id, options, null, Constants.DB_PARAMS_MAX_LIMIT, settings) : [],
      operator: OCPIUtilsService.getOperatorBusinessDetails(settings) ?? { name: 'Undefined' },
      owner: {
        name: site.ownerName ?? 'Undefined',
      },
      last_updated: site.lastChangedOn ? site.lastChangedOn : site.createdOn,
      opening_times: this.buildCpoOpeningTimes(tenant, site)
    };
  }

  // TODO: Implement the Opening Hours in the Site and send it to OCPI
  public static buildCpoOpeningTimes(tenant: Tenant, site: Site): OCPIOpeningTimes {
    switch (tenant?.id) {
      // SLF
      case '5be7fb271014d90008992f06':
        switch (site.id) {
          // Mougins
          case '5abeba8d4bae1457eb565e5b':
            return {
              regular_hours: [
                {
                  weekday: 1, // Monday
                  period_begin: '08:00',
                  period_end: '18:00'
                },
                {
                  weekday: 2,
                  period_begin: '08:00',
                  period_end: '18:00'
                },
                {
                  weekday: 3,
                  period_begin: '08:00',
                  period_end: '18:00'
                },
                {
                  weekday: 4,
                  period_begin: '08:00',
                  period_end: '18:00'
                },
                {
                  weekday: 5,
                  period_begin: '08:00',
                  period_end: '18:00'
                },
              ],
              twentyfourseven: false
            };
          // Caen
          case '5abeba9e4bae1457eb565e66':
            return {
              regular_hours: [
                {
                  weekday: 1, // Monday
                  period_begin: '00:00',
                  period_end: '08:00'
                },
                {
                  weekday: 1, // Monday
                  period_begin: '18:00',
                  period_end: '23:59'
                },
                {
                  weekday: 2,
                  period_begin: '00:00',
                  period_end: '08:00'
                },
                {
                  weekday: 2,
                  period_begin: '18:00',
                  period_end: '23:59'
                },
                {
                  weekday: 3,
                  period_begin: '00:00',
                  period_end: '08:00'
                },
                {
                  weekday: 3,
                  period_begin: '18:00',
                  period_end: '23:59'
                },
                {
                  weekday: 4,
                  period_begin: '00:00',
                  period_end: '08:00'
                },
                {
                  weekday: 4,
                  period_begin: '18:00',
                  period_end: '23:59'
                },
                {
                  weekday: 5,
                  period_begin: '00:00',
                  period_end: '08:00'
                },
                {
                  weekday: 5,
                  period_begin: '18:00',
                  period_end: '23:59'
                },
                {
                  weekday: 6,
                  period_begin: '00:00',
                  period_end: '23:59'
                },
                {
                  weekday: 7,
                  period_begin: '00:00',
                  period_end: '23:59'
                },
              ],
              twentyfourseven: false
            };
        }
    }
    // Default
    return {
      twentyfourseven: true,
    };
  }

  public static async getCpoEvsesFromSite(tenant: Tenant, siteID: string,
      options: OCPILocationOptions, dbParams: DbParams, dbFilters: Record<string, any> = {}, settings: OcpiSetting): Promise<OCPIEvse[]> {
    // Build evses array
    const evses: OCPIEvse[] = [];
    // Convert charging stations to evse(s)
    const chargingStations = await ChargingStationStorage.getChargingStations(tenant,
      { ...dbFilters, siteIDs: [ siteID ], public: true, issuer: true, withSiteArea: true, withSite: true },
      dbParams ?? Constants.DB_PARAMS_MAX_LIMIT,
      [ 'id', 'inactive', 'chargePoints', 'connectors', 'coordinates', 'tariffID', 'lastSeen', 'siteAreaID', 'siteID', 'companyID', 'siteArea', 'site' ]);
    for (const chargingStation of chargingStations.result) {
      const chargingStationEvses: OCPIEvse[] = [];
      if (!Utils.isEmptyArray(chargingStation.chargePoints)) {
        for (const chargePoint of chargingStation.chargePoints) {
          if (chargePoint.cannotChargeInParallel) {
            chargingStationEvses.push(...OCPIUtilsService.convertChargingStation2UniqueEvse(tenant, chargingStation, chargePoint, options, settings));
          } else {
            chargingStationEvses.push(...OCPIUtilsService.convertChargingStation2MultipleEvses(tenant, chargingStation, chargePoint, options, settings));
          }
        }
      } else {
        chargingStationEvses.push(...OCPIUtilsService.convertChargingStation2MultipleEvses(tenant, chargingStation, null, options, settings));
      }
      // Always update OCPI data
      await ChargingStationStorage.saveChargingStationOcpiData(tenant, chargingStation.id, { evses: chargingStationEvses });
      evses.push(...chargingStationEvses);
    }
    return evses;
  }

  public static async getCpoEvse(tenant: Tenant, locationId: string, evseUid: string, options: OCPILocationOptions, settings: OcpiSetting): Promise<OCPIEvse> {
    // Get site
    const evses = await OCPIUtilsService.getCpoEvsesFromSite(
      tenant, locationId, options, Constants.DB_PARAMS_SINGLE_RECORD,
      { 'ocpiData.evses.uid' : evseUid }, settings);
    if (!Utils.isEmptyArray(evses)) {
      return evses.find((evse) => evse.uid === evseUid);
    }
  }

  public static async processEmspTransactionFromSession(tenant: Tenant, session: OCPISession, action: ServerAction,
      transaction?: Transaction, user?: User): Promise<void> {
    let newTransaction = false;
    if (!OCPIUtilsService.validateEmspSession(session)) {
      throw new AppError({
        module: MODULE_NAME, method: 'processEmspTransactionFromSession', action,
        errorCode: StatusCodes.BAD_REQUEST,
        message: 'Session object is invalid',
        detailedMessages: { session },
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    // Init default values
    if (!session.total_cost) {
      session.total_cost = 0;
    }
    if (!session.kwh) {
      session.kwh = 0;
    }
    // Get Transaction
    if (!transaction) {
      transaction = await TransactionStorage.getOCPITransactionBySessionID(tenant, session.id, { withUser: true });
      user = transaction?.user;
    }
    // Check the CDR
    if (transaction?.ocpiData?.cdr?.id) {
      await Logging.logWarning({
        ...LoggingHelper.getTransactionProperties(transaction),
        tenantID: tenant.id,
        actionOnUser: transaction.userID,
        module: MODULE_NAME, method: 'processEmspTransactionFromSession', action,
        message: `Transaction ID '${transaction.id}' has already a CDR`,
        detailedMessages: { session, transaction }
      });
      return;
    }
    // Check the Session Status
    if (transaction?.ocpiData?.session?.status === OCPISessionStatus.COMPLETED) {
      await Logging.logWarning({
        ...LoggingHelper.getTransactionProperties(transaction),
        tenantID: tenant.id,
        actionOnUser: transaction.userID,
        module: MODULE_NAME, method: 'processEmspTransactionFromSession', action,
        message: `Transaction ID '${transaction.id}' has already been completed`,
        detailedMessages: { session, transaction }
      });
      return;
    }
    // Get the Charging Station
    const evse = session.location.evses[0];
    let chargingStation: ChargingStation;
    if (transaction) {
      chargingStation = await ChargingStationStorage.getChargingStation(
        tenant, transaction.chargeBoxID);
    } else {
      chargingStation = await ChargingStationStorage.getChargingStationByOcpiLocationEvseUid(
        tenant, session.location.id, evse.uid);
    }
    if (!chargingStation) {
      throw new AppError({
        module: MODULE_NAME, method: 'processEmspTransactionFromSession', action,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Charging Station with EVSE ID '${evse.uid}' and Location ID '${session.location.id}' does not exist`,
        detailedMessages: { session },
        ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR
      });
    }
    // Create Transaction
    if (!transaction) {
      newTransaction = true;
      // Get the Tag
      const tag = await TagStorage.getTag(tenant, session.auth_id, { withUser: true });
      if (!tag) {
        throw new AppError({
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          module: MODULE_NAME, method: 'processEmspTransactionFromSession', action,
          errorCode: HTTPError.GENERAL_ERROR,
          message: `No Tag has been found with ID '${session.auth_id}'`,
          detailedMessages: { session },
          ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
        });
      }
      // Get User
      user = tag.user;
      if (!user) {
        throw new AppError({
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          module: MODULE_NAME, method: 'processEmspTransactionFromSession', action,
          errorCode: HTTPError.GENERAL_ERROR,
          message: `No User has been found with Tag ID '${session.auth_id}'`,
          detailedMessages: { session },
          ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
        });
      }
      // Get the connector ID
      let connectorID = 1;
      if (evse.connectors && evse.connectors.length === 1) {
        const evseConnectorID = evse.connectors[0].id;
        for (const chargingStationConnector of chargingStation.connectors) {
          if (evseConnectorID === chargingStationConnector.id) {
            connectorID = chargingStationConnector.connectorId;
          }
        }
      }
      // Create the Transaction
      transaction = {
        id: await TransactionStorage.findAvailableID(tenant),
        issuer: false,
        userID: user.id,
        tagID: tag.id,
        timestamp: session.start_datetime,
        chargeBoxID: chargingStation.id,
        companyID: chargingStation.companyID,
        siteID: chargingStation.siteID,
        siteAreaID: chargingStation.siteAreaID,
        timezone: Utils.getTimezone(chargingStation.coordinates),
        connectorId: connectorID,
        price: session.total_cost,
        roundedPrice: Utils.truncTo(session.total_cost, 2),
        priceUnit: session.currency,
        pricingSource: PricingSource.OCPI,
        stateOfCharge: 0,
        currentInactivityStatus: InactivityStatus.INFO,
        currentInstantWatts: 0,
        currentStateOfCharge: 0,
        currentConsumptionWh: 0,
        currentTotalConsumptionWh: 0,
        currentTotalInactivitySecs: 0,
        currentCumulatedPrice: 0,
        currentCumulatedRoundedPrice: 0,
        lastConsumption: {
          value: 0,
          timestamp: session.start_datetime
        },
      } as Transaction;
    }
    // Set the connector
    const connector = Utils.getConnectorFromID(chargingStation, transaction.connectorId);
    if (connector) {
      connector.status = OCPIUtils.convertOcpiSessionStatusToConnectorStatus(session.status);
    }
    // Create the last consumption (first time)
    if (!transaction.lastConsumption) {
      transaction.lastConsumption = {
        value: transaction.meterStart,
        timestamp: transaction.timestamp
      };
    }
    // Session in the past
    if (moment(session.last_updated).isBefore(transaction.lastConsumption.timestamp)) {
      await Logging.logError({
        ...LoggingHelper.getTransactionProperties(transaction),
        tenantID: tenant.id,
        actionOnUser: transaction.userID,
        module: MODULE_NAME, method: 'processEmspTransactionFromSession', action,
        message: `Ignore session update session.last_updated < transaction.currentTimestamp for transaction ${transaction.id}`,
        detailedMessages: { session, transaction }
      });
      return;
    }
    // Create Consumption
    if (session.kwh > 0) {
      await OCPIUtilsService.createAndSaveEmspConsumption(tenant, chargingStation, transaction, session);
    }
    transaction.ocpiData = { session };
    transaction.currentTimestamp = session.last_updated;
    transaction.lastConsumption = {
      value: session.kwh * 1000,
      timestamp: session.last_updated
    };
    if (session.end_datetime || session.status === OCPISessionStatus.COMPLETED) {
      const stopTimestamp = session.end_datetime ? session.end_datetime : new Date();
      transaction.stop = {
        extraInactivityComputed: false,
        extraInactivitySecs: 0,
        meterStop: session.kwh * 1000,
        price: session.total_cost,
        roundedPrice: Utils.truncTo(session.total_cost, 2),
        priceUnit: session.currency,
        pricingSource: PricingSource.OCPI,
        stateOfCharge: 0,
        tagID: session.auth_id,
        timestamp: stopTimestamp,
        totalConsumptionWh: session.kwh * 1000,
        totalDurationSecs: Math.round(moment.duration(moment(stopTimestamp).diff(moment(transaction.timestamp))).asSeconds()),
        totalInactivitySecs: transaction.currentTotalInactivitySecs,
        inactivityStatus: transaction.currentInactivityStatus,
        userID: transaction.userID
      };
      NotificationHelper.notifyStopTransaction(tenant, transaction, chargingStation, user);
    }
    await TransactionStorage.saveTransaction(tenant, transaction);
    await OCPPUtils.updateChargingStationConnectorRuntimeDataWithTransaction(tenant, chargingStation, transaction, true);
    if (newTransaction) {
      NotificationHelper.notifyStartTransaction(tenant, transaction, chargingStation, user);
    }
  }

  public static async processEmspCdr(tenant: Tenant, cdr: OCPICdr, action: ServerAction): Promise<void> {
    if (!OCPIUtilsService.validateEmspCdr(cdr)) {
      throw new AppError({
        module: MODULE_NAME, method: 'processEmspCdr', action,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Cdr object is invalid',
        detailedMessages: { cdr },
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    // Get Transaction
    const transaction = await TransactionStorage.getOCPITransactionBySessionID(tenant, cdr.id);
    if (!transaction) {
      throw new AppError({
        module: MODULE_NAME, method: 'processEmspCdr', action,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `No Transaction found for OCPI Session ID '${cdr.id}'`,
        detailedMessages: { cdr },
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    // Get Charging Station
    const chargingStation = await ChargingStationStorage.getChargingStation(tenant, transaction.chargeBoxID);
    if (!chargingStation) {
      throw new AppError({
        ...LoggingHelper.getTransactionProperties(transaction),
        module: MODULE_NAME, method: 'processEmspCdr', action,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Charging Station does not exist',
        detailedMessages: { transaction, cdr },
        ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR
      });
    }
    if (!cdr.total_cost) {
      cdr.total_cost = 0;
    }
    if (!cdr.total_energy) {
      cdr.total_energy = 0;
    }
    if (!cdr.total_time) {
      cdr.total_time = 0;
    }
    if (!cdr.total_parking_time) {
      cdr.total_parking_time = 0;
    }
    transaction.stop = {
      extraInactivityComputed: true,
      extraInactivitySecs: 0,
      inactivityStatus: Utils.getInactivityStatusLevel(
        transaction.chargeBox, transaction.connectorId, Utils.createDecimal(cdr.total_parking_time).mul(3600).toNumber()),
      meterStop: Utils.createDecimal(cdr.total_energy).mul(1000).toNumber(),
      price: cdr.total_cost,
      priceUnit: cdr.currency,
      pricingSource: PricingSource.OCPI,
      roundedPrice: Utils.truncTo(cdr.total_cost, 2),
      stateOfCharge: 0,
      tagID: cdr.auth_id,
      timestamp: cdr.stop_date_time,
      totalConsumptionWh: Utils.createDecimal(cdr.total_energy).mul(1000).toNumber(),
      totalDurationSecs: Utils.createDecimal(cdr.total_time).mul(3600).toNumber(),
      totalInactivitySecs: Utils.createDecimal(cdr.total_parking_time).mul(3600).toNumber(),
      userID: transaction.userID
    };
    if (!transaction.ocpiData) {
      transaction.ocpiData = {};
    }
    transaction.ocpiData.cdr = cdr;
    await TransactionStorage.saveTransaction(tenant, transaction);
    await OCPPUtils.updateChargingStationConnectorRuntimeDataWithTransaction(tenant, chargingStation, transaction, true);
  }

  public static async updateCreateTagWithEmspToken(tenant: Tenant, token: OCPIToken, tag: Tag, emspUser: User, action: ServerAction): Promise<Tag> {
    if (!OCPIUtilsService.validateCpoToken(token)) {
      throw new AppError({
        module: MODULE_NAME, method: 'updateCpoToken', action,
        errorCode: StatusCodes.BAD_REQUEST,
        message: 'Token object is invalid',
        detailedMessages: { token },
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    // External organization
    if (!emspUser) {
      throw new AppError({
        module: MODULE_NAME, method: 'updateCpoToken', action,
        errorCode: StatusCodes.CONFLICT,
        message: 'eMSP User is mandatory',
        detailedMessages: { token },
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    // External organization
    if (emspUser.issuer) {
      throw new AppError({
        module: MODULE_NAME, method: 'updateCpoToken', action,
        errorCode: StatusCodes.CONFLICT,
        message: 'Token already assigned to an internal user',
        actionOnUser: emspUser,
        detailedMessages: { token },
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    // Check the tag
    if (tag?.issuer) {
      throw new AppError({
        module: MODULE_NAME, method: 'updateCpoToken', action,
        errorCode: StatusCodes.CONFLICT,
        message: 'Token already exists in the current organization',
        detailedMessages: token,
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    // Do not set the visualID property as this field is not unique from the eMSP side!!!
    const tagToSave: Tag = {
      id: token.uid,
      issuer: false,
      userID: emspUser.id,
      active: token.valid === true ? true : false,
      description: token.visual_number,
      lastChangedOn: token.last_updated,
      ocpiToken: token,
      user: emspUser,
    };
    // Save Tag
    if (!tag || JSON.stringify(tagToSave.ocpiToken) !== JSON.stringify(tag.ocpiToken)) {
      await TagStorage.saveTag(tenant, tagToSave);
    }
    return tagToSave;
  }

  public static convertConnector2OcpiConnector(tenant: Tenant, chargingStation: ChargingStation,
      connector: Connector, countryID: string, partyID: string, settings: OcpiSetting): OCPIConnector {
    let type: OCPIConnectorType, format: OCPIConnectorFormat;
    const chargePoint = Utils.getChargePointFromID(chargingStation, connector?.chargePointID);
    const voltage: OCPIVoltage = OCPIUtilsService.getChargingStationOCPIVoltage(chargingStation, chargePoint, connector.connectorId);
    const amperage = OCPIUtilsService.getChargingStationOCPIAmperage(chargingStation, chargePoint, connector.connectorId);
    const ocpiNumberOfConnectedPhases = OCPIUtilsService.getChargingStationOCPINumberOfConnectedPhases(chargingStation, chargePoint, connector.connectorId);
    switch (connector.type) {
      case ConnectorType.CHADEMO:
        type = OCPIConnectorType.CHADEMO;
        format = OCPIConnectorFormat.CABLE;
        break;
      case ConnectorType.TYPE_2:
        type = OCPIConnectorType.IEC_62196_T2;
        // Type 2 connector with more than 32A (per phase or not) needs attached cable
        if (amperage > 32) {
          format = OCPIConnectorFormat.CABLE;
        } else {
          format = OCPIConnectorFormat.SOCKET;
        }
        break;
      case ConnectorType.COMBO_CCS:
        type = OCPIConnectorType.IEC_62196_T2_COMBO;
        format = OCPIConnectorFormat.CABLE;
        break;
      case ConnectorType.DOMESTIC:
        type = OCPIConnectorType.DOMESTIC_E;
        format = OCPIConnectorFormat.SOCKET;
        break;
    }
    return {
      id: RoamingUtils.buildEvseConnectorID(countryID, partyID, chargingStation, connector.connectorId),
      standard: type,
      format: format,
      voltage: voltage,
      amperage: amperage,
      power_type: OCPIUtilsService.convertOCPINumberOfConnectedPhases2PowerType(ocpiNumberOfConnectedPhases),
      tariff_id: OCPIUtilsService.buildTariffID(tenant, chargingStation, connector, settings),
      last_updated: chargingStation.lastSeen
    };
  }

  public static validateCpoToken(token: OCPIToken): boolean {
    if (!token.uid ||
        !token.auth_id ||
        !token.type ||
        !token.issuer ||
        !token.whitelist ||
        !token.last_updated) {
      return false;
    }
    return true;
  }

  private static getOperatorBusinessDetails(settings: OcpiSetting): OCPIBusinessDetails {
    const businessDetails = settings.businessDetails;
    if (businessDetails) {
      for (const key in businessDetails.logo) {
        const data = businessDetails.logo[key];
        if (!data) {
          delete businessDetails.logo[key];
        }
      }
      if (!businessDetails.logo?.url &&
          !businessDetails.logo?.thumbnail &&
          !businessDetails.logo?.category &&
          !businessDetails.logo?.type &&
          !businessDetails.logo?.width &&
          !businessDetails.logo?.height) {
        delete businessDetails.logo;
      }
    }
    return businessDetails;
  }

  private static convertChargingStation2MultipleEvses(tenant: Tenant, chargingStation: ChargingStation,
      chargePoint: ChargePoint, options: OCPILocationOptions, settings: OcpiSetting): OCPIEvse[] {
    const hasValidChargingStationGpsCoordinates = Utils.hasValidGpsCoordinates(chargingStation?.coordinates);
    // Loop through connectors and send one evse per connector
    let connectors: Connector[];
    if (chargePoint) {
      connectors = Utils.getConnectorsFromChargePoint(chargingStation, chargePoint);
    } else {
      connectors = chargingStation.connectors.filter((connector) => connector !== null);
    }
    const evses: OCPIEvse[] = [];
    for (const connector of connectors) {
      const evse: OCPIEvse = {
        uid: RoamingUtils.buildEvseUID(chargingStation, connector.connectorId),
        evse_id: RoamingUtils.buildEvseID(options.countryID, options.partyID, chargingStation, connector.connectorId),
        location_id: chargingStation.siteID,
        status: chargingStation.inactive ? OCPIEvseStatus.INOPERATIVE : OCPIUtils.convertStatusToOcpiStatus(connector.status),
        capabilities: [OCPICapability.REMOTE_START_STOP_CAPABLE, OCPICapability.RFID_READER],
        connectors: [OCPIUtilsService.convertConnector2OcpiConnector(
          tenant, chargingStation, connector, options.countryID, options.partyID, settings)],
        last_updated: chargingStation.lastSeen,
        coordinates: {
          longitude: hasValidChargingStationGpsCoordinates ? chargingStation.coordinates[0].toString() : Constants.SFDP_LONGITUDE.toString(),
          latitude: hasValidChargingStationGpsCoordinates ? chargingStation.coordinates[1].toString() : Constants.SFDP_LATTITUDE.toString()
        }
      };
      // Check addChargeBoxID flag
      if (options?.addChargeBoxAndOrgIDs) {
        evse.chargingStationID = chargingStation.id;
        evse.siteID = chargingStation.siteID;
        evse.siteAreaID = chargingStation.siteAreaID;
        evse.companyID = chargingStation.companyID;
      }
      evses.push(evse);
    }
    return evses;
  }

  private static convertChargingStation2UniqueEvse(tenant: Tenant, chargingStation: ChargingStation,
      chargePoint: ChargePoint, options: OCPILocationOptions, settings: OcpiSetting): OCPIEvse[] {
    const hasValidChargingStationGpsCoordinates = Utils.hasValidGpsCoordinates(chargingStation?.coordinates);
    let connectors: Connector[];
    if (chargePoint) {
      connectors = Utils.getConnectorsFromChargePoint(chargingStation, chargePoint);
    } else {
      connectors = chargingStation.connectors.filter((connector) => connector !== null);
    }
    // Get all connectors
    const ocpiConnectors: OCPIConnector[] = connectors.map((connector: Connector) =>
      OCPIUtilsService.convertConnector2OcpiConnector(tenant, chargingStation, connector, options.countryID, options.partyID, settings));
    // Get connectors aggregated status
    const connectorOneStatus = OCPIUtilsService.convertToOneConnectorStatus(connectors);
    // Build evse
    const evse: OCPIEvse = {
      // Evse uid must contains the chargePoint.id
      uid: RoamingUtils.buildEvseUID(chargingStation, connectors[0].connectorId),
      evse_id: RoamingUtils.buildEvseID(options.countryID, options.partyID, chargingStation, connectors[0].connectorId),
      location_id: chargingStation.siteID,
      status: chargingStation.inactive ? OCPIEvseStatus.INOPERATIVE : OCPIUtils.convertStatusToOcpiStatus(connectorOneStatus),
      capabilities: [OCPICapability.REMOTE_START_STOP_CAPABLE, OCPICapability.RFID_READER],
      connectors: ocpiConnectors,
      last_updated: chargingStation.lastSeen,
      coordinates: {
        longitude: hasValidChargingStationGpsCoordinates ? chargingStation.coordinates[0].toString() : Constants.SFDP_LONGITUDE.toString(),
        latitude: hasValidChargingStationGpsCoordinates ? chargingStation.coordinates[1].toString() : Constants.SFDP_LATTITUDE.toString()
      }
    };
    // Check addChargeBoxID flag
    if (options?.addChargeBoxAndOrgIDs) {
      evse.chargingStationID = chargingStation.id;
      evse.siteID = chargingStation.siteID;
      evse.siteAreaID = chargingStation.siteAreaID;
      evse.companyID = chargingStation.companyID;
    }
    return [evse];
  }

  private static convertToOneConnectorStatus(connectors: Connector[]): ChargePointStatus {
    // Build array with charging station ordered by priority
    const statusesOrdered: ChargePointStatus[] = [ChargePointStatus.AVAILABLE, ChargePointStatus.OCCUPIED, ChargePointStatus.CHARGING, ChargePointStatus.FAULTED];
    let aggregatedConnectorStatusIndex = 0;
    // Loop through connector
    for (const connector of connectors) {
      if (statusesOrdered.indexOf(connector.status) > aggregatedConnectorStatusIndex) {
        aggregatedConnectorStatusIndex = statusesOrdered.indexOf(connector.status);
      }
    }
    // Return value
    return statusesOrdered[aggregatedConnectorStatusIndex];
  }

  // FIXME: We should probably only have charging station output characteristics everywhere
  private static getChargingStationOCPIVoltage(chargingStation: ChargingStation, chargePoint: ChargePoint, connectorId: number): OCPIVoltage {
    switch (Utils.getChargingStationCurrentType(chargingStation, chargePoint, connectorId)) {
      case CurrentType.AC:
        return Utils.getChargingStationVoltage(chargingStation, chargePoint, connectorId);
      case CurrentType.DC:
        return Voltage.VOLTAGE_400;
      default:
        return null;
    }
  }

  private static getChargingStationOCPIAmperage(chargingStation: ChargingStation, chargePoint: ChargePoint, connectorId: number): number {
    switch (Utils.getChargingStationCurrentType(chargingStation, chargePoint, connectorId)) {
      case CurrentType.AC:
        return Utils.getChargingStationAmperagePerPhase(chargingStation, chargePoint, connectorId);
      case CurrentType.DC:
        return Math.round(Utils.getChargingStationPower(chargingStation, chargePoint, connectorId) /
          OCPIUtilsService.getChargingStationOCPIVoltage(chargingStation, chargePoint, connectorId));
      default:
        return null;
    }
  }

  private static getChargingStationOCPINumberOfConnectedPhases(chargingStation: ChargingStation, chargePoint: ChargePoint, connectorId: number): number {
    switch (Utils.getChargingStationCurrentType(chargingStation, chargePoint, connectorId)) {
      case CurrentType.AC:
        return Utils.getNumberOfConnectedPhases(chargingStation, chargePoint, connectorId);
      case CurrentType.DC:
        return 0;
      default:
        return null;
    }
  }

  private static buildTariffID(tenant: Tenant, chargingStation: ChargingStation, connector: Connector, settings: OcpiSetting): string {
    const defaultTariff = 'Default';
    // Connector?
    if (!Utils.isNullOrEmptyString(connector.tariffID)) {
      return connector.tariffID;
    }
    // Charging Station?
    if (!Utils.isNullOrEmptyString(chargingStation.tariffID)) {
      return chargingStation.tariffID;
    }
    // Site Area?
    if (!Utils.isNullOrEmptyString(chargingStation.siteArea?.tariffID)) {
      return chargingStation.siteArea.tariffID;
    }
    // Site?
    if (!Utils.isNullOrEmptyString(chargingStation.site?.tariffID)) {
      return chargingStation.site.tariffID;
    }
    // Tenant?
    if (!Utils.isNullOrEmptyString(settings?.tariffID)) {
      return settings.tariffID;
    }
    // Backup rules (give time to customers to maintain their corresponding objects)
    switch (tenant?.id) {
      // Station-e
      case '60633bb1834fed0016310189':
        // Check Site Area
        switch (chargingStation?.siteAreaID) {
          // A Droite Park Marcel Pagnol
          case '60d5a20c9deee6001419cabb':
            switch (chargingStation?.id) {
              case 'BMPBA':
                // Type 2
                if (connector.type === ConnectorType.TYPE_2) {
                  return 'STE-AC_22k';
                }
                // DC
                return 'STE-DC_25k';
              case 'P91800RMRCLPGNL22AC':
                return 'STE-AC_22k';
            }
            return defaultTariff;
          // A Droite Park Les Bains des Docks
          case '61697ae8d9c095772ca9a771':
            switch (chargingStation?.id) {
              case 'HBDBA':
              case 'HBDBB':
                // Type 2
                if (connector.type === ConnectorType.TYPE_2) {
                  return 'STE-AC_22k';
                }
                // DC
                return 'STE-DC_60k';
            }
            return defaultTariff;
        }
        return defaultTariff;
      // SLF
      case '5be7fb271014d90008992f06':
        // Check Site Area
        switch (chargingStation?.siteAreaID) {
          // Mougins - South
          case '5abebb1b4bae1457eb565e98':
            return 'AC_Sud2';
          // Mougins - South - Fastcharging
          case '5b72cef274ae30000855e458':
            return 'DC_Sud';
        }
        return defaultTariff;
      // Proviridis
      case '5e2701b248aaa90007904cca':
        return '1';
      // Exadys
      case '5ff4c5ca1804a20013ce8a23':
        return 'Tarif_Standard';
      // Inouid
      case '602e260fa9b0290023fb68d2':
        return 'Payant1';
      // Properphi
      case '603655d291930d0014017e0a':
        switch (chargingStation?.siteAreaID) {
          // F3C Baume les dames
          case '60990f1cc48de10014ea4fdc':
            switch (chargingStation?.id) {
              case 'F3CBaume-CAHORS25DC':
                return 'EVSE_DC';
              case 'F3CBaume-LAFON22AC':
                return 'EVSE_AC';
            }
            return defaultTariff;
          // Garage Cheval
          case '60e40cfc32a7e60014672290':
            switch (chargingStation?.id) {
              case 'F3CALBON-CAHORS25DC':
                return 'EVSE_DC';
              case 'F3CALBON-SCHNEIDER22AC':
                return 'EVSE_AC';
            }
            return defaultTariff;
        }
        return defaultTariff;
      // eChargeNow
      case '60b9f4336493830016c9a68c':
        return 'Tarif_Standard';
    }
    // Default
    return defaultTariff;
  }

  private static convertOCPINumberOfConnectedPhases2PowerType(ocpiNumberOfConnectedPhases: number): OCPIPowerType {
    switch (ocpiNumberOfConnectedPhases) {
      case 0:
        return OCPIPowerType.DC;
      case 1:
        return OCPIPowerType.AC_1_PHASE;
      case 3:
        return OCPIPowerType.AC_3_PHASE;
    }
  }

  private static async createAndSaveEmspConsumption(tenant: Tenant, chargingStation: ChargingStation, transaction: Transaction, session: OCPISession): Promise<void> {
    const consumptionEnergyWh = Utils.createDecimal(session.kwh).mul(1000).minus(Utils.convertToFloat(transaction.lastConsumption.value)).toNumber();
    const consumptionDurationSecs = Utils.createDecimal(moment(session.last_updated).diff(transaction.lastConsumption.timestamp, 'milliseconds')).div(1000).toNumber();
    if (consumptionEnergyWh > 0 || consumptionDurationSecs > 0) {
      // Compute Consumption data
      const sampleMultiplier = consumptionDurationSecs > 0 ? Utils.createDecimal(3600).div(consumptionDurationSecs).toNumber() : 0;
      const consumptionInstantWatts = consumptionEnergyWh > 0 ? Utils.createDecimal(consumptionEnergyWh).mul(sampleMultiplier).toNumber() : 0;
      const consumptionAmount = Utils.createDecimal(session.total_cost).minus(transaction.currentCumulatedPrice).toNumber();
      // Update Transaction runtime data
      transaction.currentInstantWatts = consumptionInstantWatts;
      transaction.currentConsumptionWh = consumptionEnergyWh > 0 ? consumptionEnergyWh : 0;
      transaction.currentTotalConsumptionWh = Utils.createDecimal(transaction.currentTotalConsumptionWh).plus(transaction.currentConsumptionWh).toNumber();
      transaction.currentCumulatedPrice = session.total_cost;
      transaction.currentCumulatedRoundedPrice = Utils.truncTo(session.total_cost, 2);
      if (consumptionEnergyWh <= 0) {
        transaction.currentTotalInactivitySecs = Utils.createDecimal(transaction.currentTotalInactivitySecs).plus(consumptionDurationSecs).toNumber();
        transaction.currentInactivityStatus = Utils.getInactivityStatusLevel(
          transaction.chargeBox, transaction.connectorId, transaction.currentTotalInactivitySecs);
      }
      // Create Consumption
      const consumption: Consumption = {
        transactionId: transaction.id,
        connectorId: transaction.connectorId,
        chargeBoxID: transaction.chargeBoxID,
        siteAreaID: transaction.siteAreaID,
        siteID: transaction.siteID,
        userID: transaction.userID,
        pricingSource: transaction.pricingSource,
        startedAt: new Date(transaction.lastConsumption.timestamp),
        endedAt: new Date(session.last_updated),
        consumptionWh: transaction.currentConsumptionWh,
        consumptionAmps: Utils.convertWattToAmp(chargingStation, null, transaction.connectorId, transaction.currentConsumptionWh),
        instantWatts: Math.floor(transaction.currentInstantWatts),
        instantAmps: Utils.convertWattToAmp(chargingStation, null, transaction.connectorId, transaction.currentInstantWatts),
        cumulatedConsumptionWh: transaction.currentTotalConsumptionWh,
        cumulatedConsumptionAmps: Utils.convertWattToAmp(
          chargingStation, null, transaction.connectorId, transaction.currentTotalConsumptionWh),
        totalInactivitySecs: transaction.currentTotalInactivitySecs,
        totalDurationSecs: transaction.stop ?
          moment.duration(moment(transaction.stop.timestamp).diff(moment(transaction.timestamp))).asSeconds() :
          moment.duration(moment(transaction.lastConsumption.timestamp).diff(moment(transaction.timestamp))).asSeconds(),
        stateOfCharge: transaction.currentStateOfCharge,
        amount: consumptionAmount,
        roundedAmount: Utils.truncTo(consumptionAmount, 2),
        currencyCode: session.currency,
        cumulatedAmount: session.total_cost
      };
      await ConsumptionStorage.saveConsumption(tenant, consumption);
    }
  }

  private static validateEmspSession(session: OCPISession): boolean {
    if (!session.id
      || !session.start_datetime
      || !session.auth_id
      || !session.auth_method
      || !session.location
      || !session.currency
      || !session.status
      || !session.last_updated
    ) {
      return false;
    }
    return OCPIUtilsService.validateEmspLocation(session.location);
  }

  private static validateEmspCdr(cdr: OCPICdr): boolean {
    if (!cdr.id
      || !cdr.start_date_time
      || !cdr.stop_date_time
      || !cdr.auth_id
      || !cdr.auth_method
      || !cdr.location
      || !cdr.currency
      || !cdr.charging_periods
      || !cdr.last_updated
    ) {
      return false;
    }
    return OCPIUtilsService.validateEmspLocation(cdr.location);
  }

  private static validateEmspLocation(location: OCPILocation): boolean {
    if (!location.evses || location.evses.length !== 1 || !location.evses[0].uid) {
      return false;
    }
    return true;
  }
}
