import * as CountriesList from 'countries-list';

import { CdrDimensionType, OCPIChargingPeriod } from '../../types/ocpi/OCPIChargingPeriod';
import ChargingStation, { Connector } from '../../types/ChargingStation';
import { OCPIAllowed, OCPIAuthorizationInfo } from '../../types/ocpi/OCPIAuthorizationInfo';
import { OCPIAuthMethod, OCPISession, OCPISessionStatus } from '../../types/ocpi/OCPISession';
import { OCPICapability, OCPIEvse, OCPIEvseStatus } from '../../types/ocpi/OCPIEvse';
import OCPIEndpoint, { OCPILastCpoPullToken, OCPILastCpoPushStatus } from '../../types/ocpi/OCPIEndpoint';
import { OCPILocation, OCPILocationOptions, OCPILocationReference, OCPILocationType } from '../../types/ocpi/OCPILocation';
import moment, { Moment } from 'moment';

import { AxiosResponse } from 'axios';
import BackendError from '../../exception/BackendError';
import { ChargePointStatus } from '../../types/ocpp/OCPPServer';
import Constants from '../../utils/Constants';
import Consumption from '../../types/Consumption';
import ConsumptionStorage from '../../storage/mongodb/ConsumptionStorage';
import Logging from '../../utils/Logging';
import LoggingHelper from '../../utils/LoggingHelper';
import NotificationHandler from '../../notification/NotificationHandler';
import { OCPICdr } from '../../types/ocpi/OCPICdr';
import OCPIClient from './OCPIClient';
import { OCPIConnector } from '../../types/ocpi/OCPIConnector';
import OCPIEndpointStorage from '../../storage/mongodb/OCPIEndpointStorage';
import { OCPIResult } from '../../types/ocpi/OCPIResult';
import { OCPIRole } from '../../types/ocpi/OCPIRole';
import { OCPIToken } from '../../types/ocpi/OCPIToken';
import OCPIUtils from '../../server/ocpi/OCPIUtils';
import OCPIUtilsService from '../../server/ocpi/service/OCPIUtilsService';
import OCPPStorage from '../../storage/mongodb/OCPPStorage';
import { OcpiSetting } from '../../types/Setting';
import { Promise } from 'bluebird';
import RoamingUtils from '../../utils/RoamingUtils';
import { ServerAction } from '../../types/Server';
import Site from '../../types/Site';
import SiteStorage from '../../storage/mongodb/SiteStorage';
import TagStorage from '../../storage/mongodb/TagStorage';
import Tenant from '../../types/Tenant';
import Transaction from '../../types/Transaction';
import TransactionStorage from '../../storage/mongodb/TransactionStorage';
import User from '../../types/User';
import UserStorage from '../../storage/mongodb/UserStorage';
import Utils from '../../utils/Utils';
import _ from 'lodash';
import countries from 'i18n-iso-countries';

const MODULE_NAME = 'CpoOCPIClient';

export default class CpoOCPIClient extends OCPIClient {
  public constructor(tenant: Tenant, settings: OcpiSetting, ocpiEndpoint: OCPIEndpoint) {
    super(tenant, settings, ocpiEndpoint, OCPIRole.CPO);
    if (ocpiEndpoint.role !== OCPIRole.CPO) {
      throw new BackendError({
        message: `CpoOcpiClient requires Ocpi Endpoint with role ${OCPIRole.CPO}`,
        module: MODULE_NAME, method: 'constructor',
      });
    }
  }

  public async pullTokens(partial = false): Promise<OCPIResult> {
    const result: OCPIResult = {
      success: 0,
      failure: 0,
      total: 0,
      logs: [],
      objectIDsInFailure: [],
    };
    // Get tokens endpoint url
    let tokensUrl = this.getEndpointUrl('tokens', ServerAction.OCPI_CPO_GET_TOKENS);
    // Perfs trace
    const startTime = new Date().getTime();
    // Get timestamp before starting process - to be saved in DB at the end of the process
    const startDate = new Date();
    // Build last execution date
    let momentFrom: Moment;
    if (partial) {
      // Get last job success date
      if (this.ocpiEndpoint.lastCpoPullTokens?.lastUpdatedOn) {
        // Last execution date
        momentFrom = moment(this.ocpiEndpoint.lastCpoPullTokens.lastUpdatedOn).utc();
      } else {
        // Last hour by default
        momentFrom = moment().utc().subtract(1, 'hours').startOf('hour');
      }
      // Update URL
      tokensUrl = `${tokensUrl}?date_from=${momentFrom.format()}&limit=1000`;
    } else {
      // Update URL
      tokensUrl = `${tokensUrl}?limit=1000`;
    }
    // Get all the EMSP Users
    const emspUsersMap = new Map<string, User>();
    const emspUsers = (await UserStorage.getUsers(this.tenant, { issuer: false }, Constants.DB_PARAMS_MAX_LIMIT)).result;
    for (const emspUser of emspUsers) {
      emspUsersMap.set(emspUser.email, emspUser);
    }
    let nextResult = true;
    let totalNumberOfTags = 0;
    do {
      const startTimeLoop = new Date().getTime();
      // Call IOP
      const response = await this.axiosInstance.get(
        tokensUrl,
        {
          headers: {
            Authorization: `Token ${this.ocpiEndpoint.token}`
          },
        }
      );
      if (!response.data?.data) {
        throw new BackendError({
          action: ServerAction.OCPI_CPO_GET_TOKENS,
          message: 'Invalid response from Pull Tokens',
          module: MODULE_NAME, method: 'pullTokens',
          detailedMessages: { tokensUrl }
        });
      }
      const numberOfTags = response.data.data.length as number;
      totalNumberOfTags += numberOfTags;
      await Logging.logDebug({
        tenantID: this.tenant.id,
        action: ServerAction.OCPI_CPO_GET_TOKENS,
        message: `${numberOfTags.toString()} Tokens retrieved from ${tokensUrl}`,
        module: MODULE_NAME, method: 'pullTokens'
      });
      const tokens = response.data.data as OCPIToken[];
      // Get all Tags at once from the DB
      const tagIDs = tokens.map((token) => token.uid);
      if (!Utils.isEmptyArray(tokens)) {
        const tags = await TagStorage.getTags(this.tenant,
          { tagIDs: tagIDs }, Constants.DB_PARAMS_MAX_LIMIT);
          // Check and get eMSP users from Tokens
        await this.checkAndCreateEMSPUsersFromTokens(tokens, emspUsersMap);
        // Update the tags
        await Promise.map(tokens, async (token) => {
          try {
            result.total++;
            // Get eMSP user
            const email = OCPIUtils.buildEmspEmailFromEmspToken(
              token, this.ocpiEndpoint.countryCode, this.ocpiEndpoint.partyId);
            const emspUser = emspUsersMap.get(email);
            // Get the Tag
            const emspTag = tags.result.find((tag) => tag.id === token.uid);
            await OCPIUtilsService.updateCreateTagWithEmspToken(
              this.tenant, token, emspTag, emspUser, ServerAction.OCPI_CPO_GET_TOKENS);
            result.success++;
          } catch (error) {
            result.failure++;
            result.objectIDsInFailure.push(token.uid);
            result.logs.push(
              `Failed to update Issuer '${token.issuer}' - ID '${token.uid}': ${error.message as string}`
            );
          }
        },
        { concurrency: Constants.OCPI_MAX_PARALLEL_REQUESTS });
      }
      const nextUrl = OCPIUtils.getNextUrl(response.headers.link);
      if (nextUrl && nextUrl.length > 0 && nextUrl !== tokensUrl) {
        tokensUrl = nextUrl;
      } else {
        nextResult = false;
      }
      const executionDurationLoopSecs = (new Date().getTime() - startTimeLoop) / 1000;
      const executionDurationTotalLoopSecs = (new Date().getTime() - startTime) / 1000;
      await Logging.logDebug({
        tenantID: this.tenant.id,
        action: ServerAction.OCPI_CPO_GET_TOKENS,
        message: `${numberOfTags.toString()} token(s) processed in ${executionDurationLoopSecs}s - Total of ${totalNumberOfTags} token(s) processed in ${executionDurationTotalLoopSecs}s`,
        module: MODULE_NAME, method: 'pullTokens',
        detailedMessages: { tokens }
      });
    } while (nextResult);
    // Save result in OCPI endpoint
    const lastCpoPullTokens: OCPILastCpoPullToken = {
      lastUpdatedOn: startDate,
      partial,
      successNbr: result ? result.success : 0,
      failureNbr: result ? result.failure : 0,
      totalNbr: result ? result.total : 0,
      tokenIDsInFailure: result ? _.uniq(result.objectIDsInFailure) : [],
    };
    await OCPIEndpointStorage.saveOcpiLastCpoPullTokens(
      this.tenant, this.ocpiEndpoint.id, lastCpoPullTokens);
    // Log
    const executionDurationSecs = (new Date().getTime() - startTime) / 1000;
    await Logging.logOcpiResult(this.tenant.id, ServerAction.OCPI_CPO_GET_TOKENS,
      MODULE_NAME, 'pullTokens', result,
      `{{inSuccess}} token(s) were successfully pulled in ${executionDurationSecs}s ${partial ? 'from ' + momentFrom.format() : ''}`,
      `{{inError}} token(s) failed to be pulled in ${executionDurationSecs}s ${partial ? 'from ' + momentFrom.format() : ''}`,
      `{{inSuccess}} token(s) were successfully pulled and {{inError}} failed to be pulled in ${executionDurationSecs}s ${partial ? 'from ' + momentFrom.format() : ''}`,
      `No tokens have been pulled ${partial ? 'from ' + momentFrom.format() : ''}`
    );
    return result;
  }

  public async authorizeToken(token: OCPIToken, chargingStation: ChargingStation, connector: Connector): Promise<string> {
    // Get tokens endpoint url
    const tokensUrl = `${this.getEndpointUrl('tokens', ServerAction.OCPI_CPO_AUTHORIZE_TOKEN)}/${token.uid}/authorize`;
    // Build payload
    const locationReference: OCPILocationReference = {
      location_id: chargingStation.siteID,
      evse_uids: [RoamingUtils.buildEvseUID(chargingStation, connector.connectorId)]
    };
    // Call IOP
    const response = await this.axiosInstance.post(
      tokensUrl,
      locationReference,
      {
        headers: {
          'Authorization': `Token ${this.ocpiEndpoint.token}`,
          'Content-Type': 'application/json'
        },
      });
    if (!response.data.data) {
      throw new BackendError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action: ServerAction.OCPI_CPO_AUTHORIZE_TOKEN,
        message: 'Invalid response from Post Authorize',
        module: MODULE_NAME, method: 'authorizeToken',
        detailedMessages: { locationReference }
      });
    }
    const authorizationInfo = response.data.data as OCPIAuthorizationInfo;
    if (authorizationInfo.allowed !== OCPIAllowed.ALLOWED) {
      throw new BackendError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action: ServerAction.OCPI_CPO_AUTHORIZE_TOKEN,
        message: `OCPI Tag ID '${token.uid}' has been rejected`,
        module: MODULE_NAME, method: 'authorizeToken',
        detailedMessages: { locationReference, authorizationInfo }
      });
    }
    if (!authorizationInfo.authorization_id) {
      throw new BackendError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action: ServerAction.OCPI_CPO_AUTHORIZE_TOKEN,
        message: `OCPI Tag ID '${token.uid}' has been rejected (no Authorization ID)`,
        module: MODULE_NAME, method: 'authorizeToken',
        detailedMessages: { locationReference, authorizationInfo }
      });
    }
    await Logging.logInfo({
      ...LoggingHelper.getChargingStationProperties(chargingStation),
      tenantID: this.tenant.id,
      action: ServerAction.OCPI_CPO_AUTHORIZE_TOKEN,
      message: `OCPI Tag ID '${token.uid}' has been authorized successfully`,
      module: MODULE_NAME, method: 'authorizeToken',
      detailedMessages: { locationReference, response: response.data }
    });
    return authorizationInfo.authorization_id;
  }

  public async startSession(ocpiToken: OCPIToken, chargingStation: ChargingStation, transaction: Transaction): Promise<void> {
    // Get tokens endpoint url
    const sessionsUrl = `${this.getEndpointUrl('sessions', ServerAction.OCPI_CPO_PUSH_SESSIONS)}/${this.getLocalCountryCode(ServerAction.OCPI_CPO_PUSH_SESSIONS)}/${this.getLocalPartyID(ServerAction.OCPI_CPO_PUSH_SESSIONS)}/${transaction.id.toString()}`;
    const site = await SiteStorage.getSite(this.tenant, chargingStation.siteID);
    const ocpiLocation: OCPILocation = this.convertChargingStationToOCPILocation(this.tenant, site, chargingStation,
      transaction.connectorId, this.getLocalCountryCode(ServerAction.OCPI_CPO_PUSH_SESSIONS), this.getLocalPartyID(ServerAction.OCPI_CPO_PUSH_SESSIONS));
    // Build payload
    const ocpiSession: OCPISession = {
      id: transaction.id.toString(),
      start_datetime: transaction.timestamp,
      kwh: 0,
      authorization_id: transaction.authorizationID,
      auth_method: OCPIAuthMethod.AUTH_REQUEST,
      auth_id: ocpiToken.auth_id,
      location: ocpiLocation,
      currency: this.settings.currency,
      status: OCPISessionStatus.PENDING,
      total_cost: 0, // Never calculate the cost of OCPI transaction
      last_updated: transaction.timestamp
    };
    // Call IOP
    const response = await this.axiosInstance.put(
      sessionsUrl,
      ocpiSession,
      {
        headers: {
          'Authorization': `Token ${this.ocpiEndpoint.token}`,
          'Content-Type': 'application/json'
        },
      }
    );
    transaction.ocpiData = {
      session: ocpiSession
    };
    await Logging.logInfo({
      ...LoggingHelper.getChargingStationProperties(chargingStation),
      tenantID: this.tenant.id,
      action: ServerAction.OCPI_CPO_START_SESSION,
      message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} OCPI Transaction has been started successfully`,
      module: MODULE_NAME, method: 'startSession',
      detailedMessages: { ocpiSession, response: response.data }
    });
  }

  public async updateSession(transaction: Transaction): Promise<void> {
    if (!transaction.ocpiData?.session) {
      throw new BackendError({
        ...LoggingHelper.getTransactionProperties(transaction),
        action: ServerAction.OCPI_CPO_PUSH_SESSIONS,
        message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} OCPI Data not found`,
        module: MODULE_NAME, method: 'updateSession',
      });
    }
    // Get tokens endpoint url
    const sessionsUrl = `${this.getEndpointUrl('sessions', ServerAction.OCPI_CPO_PUSH_SESSIONS)}/${this.getLocalCountryCode(ServerAction.OCPI_CPO_PUSH_SESSIONS)}/${this.getLocalPartyID(ServerAction.OCPI_CPO_PUSH_SESSIONS)}/${transaction.ocpiData.session.id}`;
    // Update transaction
    transaction.ocpiData.session.kwh = Utils.createDecimal(transaction.currentTotalConsumptionWh).div(1000).toNumber();
    transaction.ocpiData.session.last_updated = transaction.currentTimestamp;
    transaction.ocpiData.session.total_cost = 0; // Never calculate the cost of OCPI transaction
    transaction.ocpiData.session.currency = this.settings.currency;
    transaction.ocpiData.session.status = OCPISessionStatus.ACTIVE;
    transaction.ocpiData.session.charging_periods = await this.buildChargingPeriods(this.tenant, transaction);
    // Send OCPI information
    const session: Partial<OCPISession> = {
      kwh: transaction.ocpiData.session.kwh,
      last_updated: transaction.ocpiData.session.last_updated,
      currency: transaction.ocpiData.session.currency,
      total_cost: 0, // Never calculate the cost of OCPI transaction
      status: transaction.ocpiData.session.status,
      charging_periods: transaction.ocpiData.session.charging_periods
    };
    // Call IOP
    const response = await this.axiosInstance.patch(
      sessionsUrl,
      session, {
        headers: {
          'Authorization': `Token ${this.ocpiEndpoint.token}`,
          'Content-Type': 'application/json'
        },
      });
    await Logging.logInfo({
      ...LoggingHelper.getTransactionProperties(transaction),
      tenantID: this.tenant.id,
      action: ServerAction.OCPI_CPO_PUSH_SESSIONS,
      message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} OCPI Transaction has been patched successfully`,
      module: MODULE_NAME, method: 'updateSession',
      detailedMessages: { session, response: response.data }
    });
  }

  public async stopSession(transaction: Transaction): Promise<void> {
    if (!transaction.ocpiData?.session) {
      throw new BackendError({
        ...LoggingHelper.getTransactionProperties(transaction),
        action: ServerAction.OCPI_CPO_STOP_SESSION,
        message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} OCPI Transaction does not exists`,
        module: MODULE_NAME, method: 'stopSession',
      });
    }
    if (!transaction.stop) {
      throw new BackendError({
        ...LoggingHelper.getTransactionProperties(transaction),
        action: ServerAction.OCPI_CPO_STOP_SESSION,
        message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} Transaction has not yet been stopped`,
        module: MODULE_NAME, method: 'stopSession',
      });
    }
    // Get tokens endpoint url
    const tokensUrl = `${this.getEndpointUrl('sessions', ServerAction.OCPI_CPO_PUSH_SESSIONS)}/${this.getLocalCountryCode(ServerAction.OCPI_CPO_PUSH_SESSIONS)}/${this.getLocalPartyID(ServerAction.OCPI_CPO_PUSH_SESSIONS)}/${transaction.ocpiData.session.id}`;
    transaction.ocpiData.session.kwh = Utils.createDecimal(transaction.stop.totalConsumptionWh).div(1000).toNumber();
    transaction.ocpiData.session.total_cost = 0; // Never calculate the cost of OCPI transaction
    transaction.ocpiData.session.end_datetime = transaction.stop.timestamp;
    transaction.ocpiData.session.last_updated = transaction.stop.timestamp;
    transaction.ocpiData.session.status = OCPISessionStatus.COMPLETED;
    transaction.ocpiData.session.charging_periods = await this.buildChargingPeriods(this.tenant, transaction);
    // Call IOP
    const response = await this.axiosInstance.put(
      tokensUrl,
      transaction.ocpiData.session,
      {
        headers: {
          'Authorization': `Token ${this.ocpiEndpoint.token}`,
          'Content-Type': 'application/json'
        },
      });
    await Logging.logInfo({
      ...LoggingHelper.getTransactionProperties(transaction),
      tenantID: this.tenant.id,
      action: ServerAction.OCPI_CPO_STOP_SESSION,
      message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} OCPI Transaction has been stopped successfully`,
      module: MODULE_NAME, method: 'stopSession',
      detailedMessages: { session: transaction.ocpiData.session, response: response.data }
    });
  }

  public async pushCdr(transaction: Transaction): Promise<boolean> {
    if (!transaction.stop) {
      throw new BackendError({
        ...LoggingHelper.getTransactionProperties(transaction),
        action: ServerAction.OCPI_CPO_PUSH_CDRS,
        message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} Transaction has not yet been stopped`,
        module: MODULE_NAME, method: 'postCdr',
      });
    }
    if (!transaction.ocpiData?.session?.id) {
      throw new BackendError({
        ...LoggingHelper.getTransactionProperties(transaction),
        action: ServerAction.OCPI_CPO_PUSH_CDRS,
        message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} OCPI Session does not exists`,
        module: MODULE_NAME, method: 'postCdr',
      });
    }
    if (transaction.ocpiData.cdr?.id) {
      throw new BackendError({
        ...LoggingHelper.getTransactionProperties(transaction),
        action: ServerAction.OCPI_CPO_PUSH_CDRS,
        message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} OCPI CDR has already been sent for this Transaction`,
        module: MODULE_NAME, method: 'postCdr',
      });
    }
    // Get tokens endpoint url
    const cdrsUrl = this.getEndpointUrl('cdrs', ServerAction.OCPI_CPO_PUSH_CDRS);
    transaction.ocpiData.cdr = {
      id: transaction.ocpiData.session.id,
      start_date_time: transaction.timestamp,
      stop_date_time: transaction.stop.timestamp,
      total_parking_time: Utils.createDecimal(transaction.stop.totalInactivitySecs).plus(transaction.stop.extraInactivitySecs).div(3600).toNumber(), // In hours
      total_time: Utils.createDecimal(transaction.stop.totalDurationSecs).div(3600).toNumber(), // In hours
      total_energy: Utils.createDecimal(transaction.stop.totalConsumptionWh).div(1000).toNumber(), // In kW.h
      currency: this.settings.currency,
      auth_id: transaction.ocpiData.session.auth_id,
      auth_method: transaction.ocpiData.session.auth_method,
      location: transaction.ocpiData.session.location,
      authorization_id: transaction.ocpiData.session.authorization_id,
      total_cost: 0, // Never calculate the cost of OCPI transaction
      charging_periods: await this.buildChargingPeriods(this.tenant, transaction),
      last_updated: transaction.stop.timestamp
    };
    // Send CDR only if there is charging periods and consummed energy
    if (!Utils.isEmptyArray(transaction.ocpiData.cdr.charging_periods) &&
        transaction.ocpiData.cdr.total_energy > 0) {
      // Call IOP
      const response = await this.axiosInstance.post(
        cdrsUrl,
        transaction.ocpiData.cdr,
        {
          headers: {
            'Authorization': `Token ${this.ocpiEndpoint.token}`,
            'Content-Type': 'application/json'
          },
        });
      await Logging.logInfo({
        ...LoggingHelper.getTransactionProperties(transaction),
        tenantID: this.tenant.id,
        action: ServerAction.OCPI_CPO_PUSH_CDRS,
        message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} OCPI CDR has been sent successfully`,
        module: MODULE_NAME, method: 'postCdr',
        detailedMessages: { response: response.data, transaction }
      });
      return true;
    }
    await Logging.logWarning({
      ...LoggingHelper.getTransactionProperties(transaction),
      tenantID: this.tenant.id,
      action: ServerAction.OCPI_CPO_PUSH_CDRS,
      message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} OCPI CDR has no consumption and will be be ignored`,
      module: MODULE_NAME, method: 'postCdr',
      detailedMessages: { transaction }
    });
    return false;
  }

  public async patchChargingStationStatus(chargingStation: ChargingStation, status?: OCPIEvseStatus): Promise<void> {
    const results: any[] = [];
    for (const connector of chargingStation.connectors) {
      const result = await this.patchChargingStationConnectorStatus(chargingStation, connector, status);
      results.push(result.data);
    }
  }

  public async patchChargingStationConnectorStatus(chargingStation: ChargingStation,
      connector: Connector, status?: OCPIEvseStatus): Promise<AxiosResponse<any>> {
    if (!chargingStation.siteAreaID) {
      throw new BackendError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action: ServerAction.OCPI_CPO_UPDATE_STATUS,
        message: 'Charging Station must be associated to a site area',
        module: MODULE_NAME, method: 'patchChargingStationStatus',
      });
    }
    if (!chargingStation.issuer) {
      throw new BackendError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action: ServerAction.OCPI_CPO_UPDATE_STATUS,
        message: 'Only charging Station issued locally can be exposed to IOP',
        module: MODULE_NAME, method: 'patchChargingStationStatus',
      });
    }
    if (!chargingStation.public) {
      throw new BackendError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action: ServerAction.OCPI_CPO_UPDATE_STATUS,
        message: 'Private charging Station cannot be exposed to IOP',
        module: MODULE_NAME, method: 'patchChargingStationStatus',
      });
    }
    return this.patchEVSEStatus(
      {
        id: chargingStation.id,
        siteID: chargingStation.siteID,
        siteAreaID: chargingStation.siteAreaID,
        companyID: chargingStation.companyID,
      },
      chargingStation.siteID,
      RoamingUtils.buildEvseUID(chargingStation, connector.connectorId),
      status ?? OCPIUtils.convertStatusToOcpiStatus(connector.status)
    );
  }

  public async checkSessions(): Promise<OCPIResult> {
    // Result
    const result: OCPIResult = {
      success: 0,
      failure: 0,
      total: 0,
      logs: [],
      objectIDsInFailure: [],
    };
    // Perfs trace
    const startTime = new Date().getTime();
    const transactions = await TransactionStorage.getTransactions(this.tenant, {
      issuer: true,
      ocpiSessionChecked: false
    }, Constants.DB_PARAMS_MAX_LIMIT);
    if (!Utils.isEmptyArray(transactions.result)) {
      await Promise.map(transactions.result, async (transaction) => {
        result.total++;
        if (transaction.stop && transaction.stop.timestamp) {
          try {
            if (await this.checkSession(transaction)) {
              result.success++;
            } else {
              result.failure++;
              result.objectIDsInFailure.push(String(transaction.id));
            }
          } catch (error) {
            result.failure++;
            result.objectIDsInFailure.push(String(transaction.id));
            result.logs.push(
              `Failed to check OCPI Transaction ID '${transaction.ocpiData.session.id}': ${error.message as string}`
            );
          }
        }
      },
      { concurrency: Constants.OCPI_MAX_PARALLEL_REQUESTS });
    }
    const executionDurationSecs = (new Date().getTime() - startTime) / 1000;
    await Logging.logOcpiResult(this.tenant.id, ServerAction.OCPI_CPO_CHECK_SESSIONS,
      MODULE_NAME, 'checkSessions', result,
      `{{inSuccess}} Transaction(s) were successfully checked in ${executionDurationSecs}s`,
      `{{inError}} Transaction(s) failed to be checked in ${executionDurationSecs}s`,
      `{{inSuccess}} Transaction(s) were successfully checked and {{inError}} failed to be checked in ${executionDurationSecs}s`,
      'No Transaction has to be checked'
    );
    return result;
  }

  public async checkLocations(): Promise<OCPIResult> {
    // Result
    const result: OCPIResult = {
      success: 0,
      failure: 0,
      total: 0,
      logs: [],
      objectIDsInFailure: [],
    };
    // Perfs trace
    const startTime = new Date().getTime();
    // Define get option
    const options: OCPILocationOptions = {
      addChargeBoxAndOrgIDs: true,
      countryID: this.getLocalCountryCode(ServerAction.OCPI_CPO_CHECK_LOCATIONS),
      partyID: this.getLocalPartyID(ServerAction.OCPI_CPO_CHECK_LOCATIONS)
    };
    // Get all EVSEs from all locations
    const locations = await OCPIUtilsService.getAllCpoLocations(this.tenant, 0, 0, options, true, this.settings);
    if (!Utils.isEmptyArray(locations.result)) {
      await Promise.map(locations.result, async (location) => {
        result.total++;
        if (location) {
          try {
            if (await this.checkLocation(location)) {
              result.success++;
            } else {
              result.failure++;
              result.objectIDsInFailure.push(String(location.id));
            }
          } catch (error) {
            result.failure++;
            result.objectIDsInFailure.push(String(location.id));
            result.logs.push(
              `Failed to check the Location '${location.name}' with ID '${location.id}': ${error.message as string}`
            );
          }
        }
      },
      { concurrency: Constants.OCPI_MAX_PARALLEL_REQUESTS });
    }
    const executionDurationSecs = (new Date().getTime() - startTime) / 1000;
    await Logging.logOcpiResult(this.tenant.id, ServerAction.OCPI_CPO_CHECK_LOCATIONS,
      MODULE_NAME, 'checkLocations', result,
      `{{inSuccess}} Location(s) were successfully checked in ${executionDurationSecs}s`,
      `{{inError}} Location(s) failed to be checked in ${executionDurationSecs}s`,
      `{{inSuccess}} Location(s) were successfully checked and {{inError}} failed to be checked in ${executionDurationSecs}s`,
      'No Location has to be checked'
    );
    return result;
  }

  public async checkCdrs(): Promise<OCPIResult> {
    // Result
    const result: OCPIResult = {
      success: 0,
      failure: 0,
      total: 0,
      logs: [],
      objectIDsInFailure: [],
    };
    // Perfs trace
    const startTime = new Date().getTime();
    const transactions = await TransactionStorage.getTransactions(this.tenant, {
      issuer: true,
      ocpiCdrChecked: false
    }, Constants.DB_PARAMS_MAX_LIMIT);
    if (!Utils.isEmptyArray(transactions.result)) {
      await Promise.map(transactions.result, async (transaction) => {
        result.total++;
        try {
          if (await this.checkCdr(transaction)) {
            result.success++;
          } else {
            result.failure++;
            result.objectIDsInFailure.push(String(transaction.id));
          }
        } catch (error) {
          result.failure++;
          result.objectIDsInFailure.push(String(transaction.id));
          result.logs.push(
            `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} Failed to check CDR: ${error.message as string}`
          );
        }
      },
      { concurrency: Constants.OCPI_MAX_PARALLEL_REQUESTS });
    }
    const executionDurationSecs = (new Date().getTime() - startTime) / 1000;
    await Logging.logOcpiResult(this.tenant.id, ServerAction.OCPI_CPO_CHECK_CDRS,
      MODULE_NAME, 'checkCdrs', result,
      `{{inSuccess}} CDR(s) were successfully checked in ${executionDurationSecs}s`,
      `{{inError}} CDR(s) failed to be checked in ${executionDurationSecs}s`,
      `{{inSuccess}} CDR(s) were successfully checked and {{inError}} failed to be checked in ${executionDurationSecs}s`,
      'No CDR has to be checked'
    );
    return result;
  }

  public async pushChargingStationStatuses(partial = false): Promise<OCPIResult> {
    // Result
    const result: OCPIResult = {
      success: 0,
      failure: 0,
      total: 0,
      logs: [],
      objectIDsInFailure: [],
    };
    // Perfs trace
    const startTime = new Date().getTime();
    // Get timestamp before starting process - to be saved in DB at the end of the process
    const startDate = new Date();
    // Build last execution date
    let momentFrom: Moment;
    if (partial) {
      // Get last job success date
      if (this.ocpiEndpoint.lastCpoPushStatuses?.lastUpdatedOn) {
        // Last execution date
        momentFrom = moment(this.ocpiEndpoint.lastCpoPushStatuses.lastUpdatedOn).utc();
      } else {
        // Last hour by default
        momentFrom = moment().utc().subtract(1, 'hours').startOf('hour');
      }
    }
    // Define get option
    const options: OCPILocationOptions = {
      addChargeBoxAndOrgIDs: true,
      countryID: this.getLocalCountryCode(ServerAction.OCPI_CPO_UPDATE_STATUS),
      partyID: this.getLocalPartyID(ServerAction.OCPI_CPO_UPDATE_STATUS)
    };
    // Check if all EVSEs should be processed - in case of delta send - process only following EVSEs:
    //    - EVSEs (ChargingStations) in error from previous push
    //    - EVSEs (ChargingStations) with status notification from latest pushDate
    let chargeBoxIDsToProcess = [];
    if (partial) {
      // Get ChargingStation in Failure from previous run
      chargeBoxIDsToProcess.push(...this.getCpoPushChargeBoxIDsInFailure());
      // Get ChargingStation with new status notification
      chargeBoxIDsToProcess.push(...await this.getChargeBoxIDsWithNewStatusNotifications(momentFrom.toDate()));
      // Remove duplicates
      chargeBoxIDsToProcess = _.uniq(chargeBoxIDsToProcess);
    }
    // Get all locations
    const locations = await OCPIUtilsService.getAllCpoLocations(this.tenant, 0, 0, options, false, this.settings);
    if (!Utils.isEmptyArray(locations.result)) {
      let totalNumberOfEvses = 0;
      for (const location of locations.result) {
        // Get the Charging Station should be processed
        let currentSkip = 0;
        let evses: OCPIEvse[] = [];
        do {
          const startTimeLoop = new Date().getTime();
          // Limit to a subset of Charging Stations?
          if (partial) {
            if (!Utils.isEmptyArray(chargeBoxIDsToProcess)) {
              evses = await OCPIUtilsService.getCpoEvsesFromSite(this.tenant, location.id, options,
                { skip: currentSkip, limit: Constants.DB_RECORD_COUNT_DEFAULT },
                { chargingStationIDs: chargeBoxIDsToProcess }, this.settings);
            }
          // Get all Charging Stations
          } else {
            evses = await OCPIUtilsService.getCpoEvsesFromSite(this.tenant, location.id, options,
              { skip: currentSkip, limit: Constants.DB_RECORD_COUNT_DEFAULT }, {}, this.settings);
          }
          totalNumberOfEvses += evses.length;
          // Loop through EVSE
          if (!Utils.isEmptyArray(evses)) {
            await Promise.map(evses, async (evse) => {
              result.total++;
              // Process it if not empty
              if (location.id && evse?.uid) {
                try {
                  const chargingStationDetails : any = {
                    id: evse.chargingStationID,
                    siteID: evse.siteID,
                    siteAreaID: evse.siteAreaID,
                    companyID: evse.companyID,
                  };
                  await this.patchEVSEStatus(chargingStationDetails, location.id, evse.uid, evse.status);
                  result.success++;
                } catch (error) {
                  result.failure++;
                  result.objectIDsInFailure.push(evse.chargingStationID);
                  result.logs.push(
                    `Update status failed on Location '${location.name}' with ID '${location.id}', Charging Station ID '${evse.evse_id}': ${error.message as string}`
                  );
                }
                if (result.failure > 0) {
                  // Send notification to admins
                  NotificationHandler.sendOCPIPatchChargingStationsStatusesError(
                    this.tenant,
                    {
                      location: location.name,
                      evseDashboardURL: Utils.buildEvseURL(this.tenant.subdomain),
                    }
                  ).catch((error) => {
                    Logging.logPromiseError(error, this.tenant?.id);
                  });
                }
              }
            },
            { concurrency: Constants.OCPI_MAX_PARALLEL_REQUESTS });
            const executionDurationLoopSecs = (new Date().getTime() - startTimeLoop) / 1000;
            const executionDurationTotalLoopSecs = (new Date().getTime() - startTime) / 1000;
            await Logging.logDebug({
              tenantID: this.tenant.id,
              action: ServerAction.OCPI_CPO_UPDATE_STATUS,
              message: `${evses.length} EVSE Status(es) processed in ${executionDurationLoopSecs}s in Location '${location.name}' - Total of ${totalNumberOfEvses} EVSE(s) processed in ${executionDurationTotalLoopSecs}s`,
              module: MODULE_NAME, method: 'sendEVSEStatuses',
              detailedMessages: { evses }
            });
          }
          currentSkip += Constants.DB_RECORD_COUNT_DEFAULT;
        } while (!Utils.isEmptyArray(evses));
      }
    }
    // Save result in OCPI endpoint
    const lastCpoPushStatus: OCPILastCpoPushStatus = {
      lastUpdatedOn: startDate,
      partial,
      successNbr: result ? result.success : 0,
      failureNbr: result ? result.failure : 0,
      totalNbr: result ? result.total : 0,
      chargeBoxIDsInFailure: result ? _.uniq(result.objectIDsInFailure) : [],
    };
    await OCPIEndpointStorage.saveOcpiLastCpoPushStatuses(
      this.tenant, this.ocpiEndpoint.id, lastCpoPushStatus);
    // Log
    const executionDurationSecs = (new Date().getTime() - startTime) / 1000;
    await Logging.logOcpiResult(this.tenant.id, ServerAction.OCPI_CPO_UPDATE_STATUS,
      MODULE_NAME, 'sendEVSEStatuses', result,
      `{{inSuccess}} EVSE Status(es) were successfully patched in ${executionDurationSecs}s ${partial ? 'from ' + momentFrom.format() : ''}`,
      `{{inError}} EVSE Status(es) failed to be patched in ${executionDurationSecs}s ${partial ? 'from ' + momentFrom.format() : ''}`,
      `{{inSuccess}} EVSE Status(es) were successfully patched and {{inError}} failed to be patched in ${executionDurationSecs}s ${partial ? 'from ' + momentFrom.format() : ''}`,
      `No EVSE Status have been patched ${partial ? 'from ' + momentFrom.format() : ''}`
    );
    return result;
  }

  private async checkAndCreateEMSPUsersFromTokens(tokens: OCPIToken[], emspUsers: Map<string, User>) {
    if (!Utils.isEmptyArray(tokens)) {
      for (const token of tokens) {
        // Get eMSP user
        const email = OCPIUtils.buildEmspEmailFromEmspToken(
          token, this.ocpiEndpoint.countryCode, this.ocpiEndpoint.partyId);
        // Check from cache
        let emspUser = emspUsers.get(email);
        if (!emspUser) {
          // Check eMsp User
          emspUser = await OCPIUtils.checkAndCreateEMSPUserFromToken(
            this.tenant, this.ocpiEndpoint.countryCode, this.ocpiEndpoint.partyId, token);
          if (emspUser) {
            // Keep in cache
            emspUsers.set(email, emspUser);
          }
        }
      }
    }
  }

  private async getChargeBoxIDsWithNewStatusNotifications(lastCpoPushStatuses: Date): Promise<string[]> {
    // Get last status notifications
    const statusNotificationsResult = await OCPPStorage.getStatusNotifications(
      this.tenant, { dateFrom: lastCpoPushStatuses }, Constants.DB_PARAMS_MAX_LIMIT);
    // Loop through notifications
    if (statusNotificationsResult.count > 0) {
      return statusNotificationsResult.result.map((statusNotification) => statusNotification.chargeBoxID);
    }
    return [];
  }

  private getCpoPushChargeBoxIDsInFailure(): string[] {
    if (this.ocpiEndpoint.lastCpoPushStatuses?.chargeBoxIDsInFailure) {
      return this.ocpiEndpoint.lastCpoPushStatuses.chargeBoxIDsInFailure;
    }
    return [];
  }

  private async patchEVSEStatus(chargingStation: { id: string, siteID: string, siteAreaID: string, companyID: string },
      locationId: string, evseUID: string, newStatus: OCPIEvseStatus): Promise<AxiosResponse<any>> {
    // Check for input parameter
    if (!locationId || !evseUID || !newStatus) {
      throw new BackendError({
        ...LoggingHelper.getChargingStationProperties(chargingStation as ChargingStation),
        action: ServerAction.OCPI_CPO_UPDATE_STATUS,
        module: MODULE_NAME, method: 'patchEVSEStatus',
        message: 'Invalid parameters',
      });
    }
    // Get locations endpoint url
    const locationsUrl = this.getEndpointUrl('locations', ServerAction.OCPI_CPO_UPDATE_STATUS);
    // Read configuration to retrieve
    const countryCode = this.getLocalCountryCode(ServerAction.OCPI_CPO_UPDATE_STATUS);
    const partyID = this.getLocalPartyID(ServerAction.OCPI_CPO_UPDATE_STATUS);
    // Build url to EVSE
    const fullUrl = locationsUrl + `/${countryCode}/${partyID}/${locationId}/${evseUID}`;
    // Build payload
    const evseStatus = { 'status': newStatus };
    // Call IOP
    const response = await this.axiosInstance.patch(
      fullUrl,
      evseStatus,
      {
        headers: {
          'Authorization': `Token ${this.ocpiEndpoint.token}`,
          'Content-Type': 'application/json'
        },
      });
    await Logging.logInfo({
      ...LoggingHelper.getChargingStationProperties(chargingStation as ChargingStation),
      tenantID: this.tenant.id,
      action: ServerAction.OCPI_CPO_UPDATE_STATUS,
      message: `OCPI Charging Station ID '${evseUID}' has been patched successfully to '${newStatus}'`,
      module: MODULE_NAME, method: 'patchEVSEStatus',
      detailedMessages: { evseStatus, response: response.data }
    });
    return response;
  }

  private async checkCdr(transaction: Transaction): Promise<boolean> {
    if (!transaction.ocpiData?.cdr) {
      throw new BackendError({
        ...LoggingHelper.getTransactionProperties(transaction),
        action: ServerAction.OCPI_CPO_CHECK_CDRS,
        message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} OCPI CDR does not exists`,
        module: MODULE_NAME, method: 'checkCdr',
      });
    }
    // Mark it as done (checked at least once)
    transaction.ocpiData.cdrCheckedOn = new Date();
    await TransactionStorage.saveTransactionOcpiData(this.tenant, transaction.id, transaction.ocpiData);
    // Check CDR
    const cdrsUrl = this.getEndpointUrl('cdrs', ServerAction.OCPI_CPO_CHECK_CDRS);
    const response = await this.axiosInstance.get(
      `${cdrsUrl}/${transaction.ocpiData.cdr.id}`,
      {
        headers: {
          'Authorization': `Token ${this.ocpiEndpoint.token}`
        },
      });
    // Create if it does not exit
    if (response.data.status_code === 3001) {
      await Logging.logError({
        ...LoggingHelper.getTransactionProperties(transaction),
        tenantID: this.tenant.id,
        action: ServerAction.OCPI_CPO_CHECK_CDRS,
        message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} CDR does not exist in IOP`,
        module: MODULE_NAME, method: 'checkCdr',
        detailedMessages: { response: response.data }
      });
      await this.axiosInstance.post(
        cdrsUrl,
        transaction.ocpiData.cdr,
        {
          headers: {
            'Authorization': `Token ${this.ocpiEndpoint.token}`,
            'Content-Type': 'application/json'
          },
        });
      return false;
    } else if (OCPIUtilsService.isSuccessResponse(response.data)) {
      const cdr = response.data.data as OCPICdr;
      if (cdr) {
        // CDR checked
        await Logging.logInfo({
          ...LoggingHelper.getTransactionProperties(transaction),
          tenantID: this.tenant.id,
          action: ServerAction.OCPI_CPO_CHECK_CDRS,
          message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} CDR has been checked successfully`,
          module: MODULE_NAME, method: 'checkCdr',
          detailedMessages: { cdr }
        });
        return true;
      }
    }
    await Logging.logError({
      ...LoggingHelper.getTransactionProperties(transaction),
      tenantID: this.tenant.id,
      action: ServerAction.OCPI_CPO_CHECK_CDRS,
      message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} Failed to check CDR '${transaction.ocpiData.session.id}' at ${cdrsUrl}/${transaction.ocpiData.cdr.id}`,
      module: MODULE_NAME, method: 'checkCdr',
      detailedMessages: { response: response.data, cdr: transaction.ocpiData.cdr }
    });
    return false;
  }

  private async checkSession(transaction: Transaction): Promise<boolean> {
    if (!transaction.ocpiData?.session) {
      throw new BackendError({
        ...LoggingHelper.getTransactionProperties(transaction),
        action: ServerAction.OCPI_CPO_CHECK_SESSIONS,
        message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} OCPI Session does not exists`,
        module: MODULE_NAME, method: 'checkSession',
      });
    }
    // Mark it as done (checked at least once)
    transaction.ocpiData.sessionCheckedOn = new Date();
    await TransactionStorage.saveTransactionOcpiData(this.tenant, transaction.id, transaction.ocpiData);
    // Check Session
    const sessionsUrl = `${this.getEndpointUrl('sessions', ServerAction.OCPI_CPO_CHECK_SESSIONS)}/${this.getLocalCountryCode(ServerAction.OCPI_CPO_CHECK_SESSIONS)}/${this.getLocalPartyID(ServerAction.OCPI_CPO_CHECK_SESSIONS)}/${transaction.ocpiData.session.id}`;
    const response = await this.axiosInstance.get(
      sessionsUrl,
      {
        headers: {
          'Authorization': `Token ${this.ocpiEndpoint.token}`
        },
      });
    if (OCPIUtilsService.isSuccessResponse(response.data)) {
      const session = response.data.data as OCPISession;
      if (session) {
        await Logging.logInfo({
          ...LoggingHelper.getTransactionProperties(transaction),
          tenantID: this.tenant.id,
          action: ServerAction.OCPI_CPO_CHECK_SESSIONS,
          message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} Transaction has been checked successfully`,
          module: MODULE_NAME, method: 'checkSession',
          detailedMessages: { response: response.data, transaction }
        });
        return true;
      }
    }
    await Logging.logError({
      ...LoggingHelper.getTransactionProperties(transaction),
      tenantID: this.tenant.id,
      action: ServerAction.OCPI_CPO_CHECK_SESSIONS,
      message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} Failed to check Transaction at ${sessionsUrl}`,
      module: MODULE_NAME, method: 'checkSession',
      detailedMessages: { response: response.data, transaction }
    });
    return false;
  }

  private async checkLocation(location: OCPILocation): Promise<boolean> {
    // Get locations endpoint url
    const locationsUrl = this.getEndpointUrl('locations', ServerAction.OCPI_CPO_CHECK_LOCATIONS);
    // Read configuration to retrieve
    const countryCode = this.getLocalCountryCode(ServerAction.OCPI_CPO_CHECK_LOCATIONS);
    const partyID = this.getLocalPartyID(ServerAction.OCPI_CPO_CHECK_LOCATIONS);
    const locationUrl = locationsUrl + `/${countryCode}/${partyID}/${location.id}`;
    // Call IOP
    const response = await this.axiosInstance.get(
      locationUrl,
      {
        headers: {
          'Authorization': `Token ${this.ocpiEndpoint.token}`
        },
      });
    let result = true;
    const ocpiLocation = response?.data?.data as OCPILocation;
    if (ocpiLocation) {
      // Check Evses
      for (const evse of location.evses) {
        if (!ocpiLocation?.evses.find((ocpiEvse) => ocpiEvse.evse_id === evse.evse_id)) {
          result = false;
          break;
        }
      }
    }
    if (!result) {
      throw new BackendError({
        action: ServerAction.OCPI_CPO_CHECK_LOCATIONS,
        message: `Failed to check Location '${location.name}' with ID '${location.id}'`,
        module: MODULE_NAME, method: 'checkLocation',
        detailedMessages: { location, ocpiLocation }
      });
    }
    await Logging.logInfo({
      tenantID: this.tenant.id,
      action: ServerAction.OCPI_CPO_CHECK_LOCATIONS,
      message: `Location '${location.name}' with ID '${location.id}' checked successfully`,
      module: MODULE_NAME, method: 'checkLocation',
      detailedMessages: { location, ocpiLocation }
    });
    return result;
  }

  private async buildChargingPeriods(tenant: Tenant, transaction: Transaction): Promise<OCPIChargingPeriod[]> {
    if (!transaction || !transaction.timestamp) {
      return [];
    }
    const chargingPeriods: OCPIChargingPeriod[] = [];
    const consumptions = await ConsumptionStorage.getOptimizedTransactionConsumptions(
      tenant, { transactionId: transaction.id });
    if (consumptions) {
      // Build based on consumptions
      for (const consumption of consumptions.result) {
        const chargingPeriod = this.buildChargingPeriod(consumption);
        if (!Utils.isEmptyArray(chargingPeriod?.dimensions)) {
          chargingPeriods.push(chargingPeriod);
        }
      }
    } else {
      // Build first/last consumption (if no consumptions is gathered)
      const consumption: number = transaction.stop ? transaction.stop.totalConsumptionWh : transaction.currentTotalConsumptionWh;
      chargingPeriods.push({
        start_date_time: transaction.timestamp,
        dimensions: [{
          type: CdrDimensionType.ENERGY,
          volume: Utils.truncTo(Utils.createDecimal(consumption).div(1000).toNumber(), 3)
        }]
      });
      const inactivity: number = transaction.stop ? transaction.stop.totalInactivitySecs : transaction.currentTotalInactivitySecs;
      if (inactivity > 0) {
        const inactivityStart = transaction.stop ? transaction.stop.timestamp : transaction.currentTimestamp;
        chargingPeriods.push({
          start_date_time: moment(inactivityStart).subtract(inactivity, 'seconds').toDate(),
          dimensions: [{
            type: CdrDimensionType.PARKING_TIME,
            volume: Utils.truncTo(Utils.createDecimal(inactivity).div(3600).toNumber(), 3)
          }]
        });
      }
    }
    return chargingPeriods;
  }

  private convertChargingStationToOCPILocation(tenant: Tenant, site: Site, chargingStation: ChargingStation,
      connectorID: number, countryID: string, partyID: string): OCPILocation {
    const hasValidSiteGpsCoordinates = Utils.hasValidGpsCoordinates(site.address?.coordinates);
    const hasValidChargingStationGpsCoordinates = Utils.hasValidGpsCoordinates(chargingStation?.coordinates);
    const connectors: OCPIConnector[] = [];
    let status: ChargePointStatus;
    const connector = Utils.getConnectorFromID(chargingStation, connectorID);
    let chargePoint;
    if (connector) {
      connectors.push(OCPIUtilsService.convertConnector2OcpiConnector(tenant, chargingStation, connector, countryID, partyID, this.settings));
      status = connector.status;
      chargePoint = Utils.getChargePointFromID(chargingStation, connector.chargePointID);
    }
    const ocpiLocation: OCPILocation = {
      id: site.id,
      name: site.name,
      address: Utils.convertAddressToOneLine(site.address),
      city: site.address?.city,
      postal_code: site.address?.postalCode,
      country: countries.getAlpha3Code(site.address.country, CountriesList.countries[countryID].languages[0]),
      coordinates: {
        longitude: hasValidSiteGpsCoordinates ? site.address.coordinates[0].toString() : Constants.SFDP_LONGITUDE.toString(),
        latitude: hasValidSiteGpsCoordinates ? site.address.coordinates[1].toString() : Constants.SFDP_LATTITUDE.toString()
      },
      type: OCPILocationType.UNKNOWN,
      evses: [{
        uid: RoamingUtils.buildEvseUID(chargingStation, connectorID),
        evse_id: RoamingUtils.buildEvseID(countryID, partyID, chargingStation, connectorID),
        location_id: chargingStation.siteID,
        status: OCPIUtils.convertStatusToOcpiStatus(status),
        capabilities: [OCPICapability.REMOTE_START_STOP_CAPABLE, OCPICapability.RFID_READER],
        connectors: connectors,
        coordinates: {
          longitude: hasValidChargingStationGpsCoordinates ? chargingStation.coordinates[0].toString() : Constants.SFDP_LONGITUDE.toString(),
          latitude: hasValidChargingStationGpsCoordinates ? chargingStation.coordinates[1].toString() : Constants.SFDP_LATTITUDE.toString()
        },
        last_updated: chargingStation.lastSeen
      }],
      last_updated: site.lastChangedOn ? site.lastChangedOn : site.createdOn,
      opening_times: OCPIUtilsService.buildCpoOpeningTimes(tenant, site)
    };
    return ocpiLocation;
  }

  private buildChargingPeriod(consumption: Consumption): OCPIChargingPeriod {
    const chargingPeriod: OCPIChargingPeriod = {
      start_date_time: consumption.endedAt,
      dimensions: []
    };
    if (consumption.consumptionWh > 0) {
      chargingPeriod.dimensions.push({
        type: CdrDimensionType.ENERGY,
        volume: Utils.truncTo(Utils.createDecimal(consumption.consumptionWh).div(1000).toNumber(), 3)
      });
    } else {
      const duration = moment(consumption.endedAt).diff(consumption.startedAt, 'hours', true);
      if (duration > 0) {
        chargingPeriod.dimensions.push({
          type: CdrDimensionType.PARKING_TIME,
          volume: Utils.truncTo(duration, 3)
        });
      }
    }
    return chargingPeriod;
  }
}
