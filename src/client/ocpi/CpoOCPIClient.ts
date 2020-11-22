import ChargingStation, { Connector } from '../../types/ChargingStation';
import { OCPIAllowed, OCPIAuthorizationInfo } from '../../types/ocpi/OCPIAuthorizationInfo';
import { OCPIAuthMethod, OCPISession, OCPISessionStatus } from '../../types/ocpi/OCPISession';
import { OCPILocation, OCPILocationReference } from '../../types/ocpi/OCPILocation';

import { AxiosResponse } from 'axios';
import BackendError from '../../exception/BackendError';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import NotificationHandler from '../../notification/NotificationHandler';
import { OCPICdr } from '../../types/ocpi/OCPICdr';
import OCPIClient from './OCPIClient';
import OCPIEndpoint from '../../types/ocpi/OCPIEndpoint';
import OCPIEndpointStorage from '../../storage/mongodb/OCPIEndpointStorage';
import { OCPIEvseStatus } from '../../types/ocpi/OCPIEvse';
import OCPIMapping from '../../server/ocpi/ocpi-services-impl/ocpi-2.1.1/OCPIMapping';
import { OCPIResult } from '../../types/ocpi/OCPIResult';
import { OCPIRole } from '../../types/ocpi/OCPIRole';
import { OCPIToken } from '../../types/ocpi/OCPIToken';
import OCPITokensService from '../../server/ocpi/ocpi-services-impl/ocpi-2.1.1/OCPITokensService';
import OCPIUtils from '../../server/ocpi/OCPIUtils';
import OCPPStorage from '../../storage/mongodb/OCPPStorage';
import { OcpiSetting } from '../../types/Setting';
import { ServerAction } from '../../types/Server';
import Site from '../../types/Site';
import SiteAreaStorage from '../../storage/mongodb/SiteAreaStorage';
import SiteStorage from '../../storage/mongodb/SiteStorage';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Transaction from '../../types/Transaction';
import TransactionStorage from '../../storage/mongodb/TransactionStorage';
import User from '../../types/User';
import UserStorage from '../../storage/mongodb/UserStorage';
import Utils from '../../utils/Utils';
import _ from 'lodash';
import moment from 'moment';

const MODULE_NAME = 'CpoOCPIClient';

export default class CpoOCPIClient extends OCPIClient {
  constructor(tenant: Tenant, settings: OcpiSetting, ocpiEndpoint: OCPIEndpoint) {
    super(tenant, settings, ocpiEndpoint, OCPIRole.CPO);
    if (ocpiEndpoint.role !== OCPIRole.CPO) {
      throw new BackendError({
        message: `CpoOcpiClient requires Ocpi Endpoint with role ${OCPIRole.CPO}`,
        module: MODULE_NAME, method: 'constructor',
      });
    }
  }

  public async pullTokens(partial = true): Promise<OCPIResult> {
    // Result
    const result: OCPIResult = {
      success: 0,
      failure: 0,
      total: 0,
      logs: []
    };
    // EMSP Users
    const emspUsers = new Map<string, User>();
    // Perfs trace
    const startTime = new Date().getTime();
    // Get tokens endpoint url
    let tokensUrl = this.getEndpointUrl('tokens', ServerAction.OCPI_PULL_TOKENS);
    if (partial) {
      const momentFrom = moment().utc().subtract(1, 'hours').startOf('hour');
      tokensUrl = `${tokensUrl}?date_from=${momentFrom.format()}&limit=100`;
    } else {
      tokensUrl = `${tokensUrl}?limit=100`;
    }
    let nextResult = true;
    let totalNumberOfToken = 0;
    do {
      const startTimeLoop = new Date().getTime();
      // Log
      Logging.logDebug({
        tenantID: this.tenant.id,
        action: ServerAction.OCPI_PULL_TOKENS,
        message: `Pull Tokens at ${tokensUrl}`,
        module: MODULE_NAME, method: 'pullTokens'
      });
      // Call IOP
      const response = await this.axiosInstance.get(tokensUrl, {
        headers: {
          Authorization: `Token ${this.ocpiEndpoint.token}`
        },
      });
      if (!response.data.data) {
        throw new BackendError({
          action: ServerAction.OCPI_PULL_TOKENS,
          message: 'Invalid response from Pull tokens',
          module: MODULE_NAME, method: 'pullTokens',
          detailedMessages: { data: response.data }
        });
      }
      const numberOfTags: number = response.data.data.length;
      totalNumberOfToken += numberOfTags;
      Logging.logDebug({
        tenantID: this.tenant.id,
        action: ServerAction.OCPI_PULL_TOKENS,
        message: `${numberOfTags.toString()} Tokens retrieved from ${tokensUrl}`,
        module: MODULE_NAME, method: 'pullTokens'
      });
      // Get all Tags at once from the DB
      const tagIDs: string[] = [];
      for (const token of response.data.data as OCPIToken[]) {
        tagIDs.push(token.uid);
      }
      const tags = (await UserStorage.getTags(this.tenant.id, { tagIDs: tagIDs }, Constants.DB_PARAMS_MAX_LIMIT)).result;
      for (const token of response.data.data as OCPIToken[]) {
        try {
          // Get eMSP user
          const email = OCPIUtils.buildEmspEmailFromOCPIToken(token, this.ocpiEndpoint.countryCode, this.ocpiEndpoint.partyId);
          // Check cache
          let emspUser = emspUsers.get(email);
          if (!emspUser) {
            // Get User from DB
            emspUser = await UserStorage.getUserByEmail(this.tenant.id, email);
            if (emspUser) {
              emspUsers.set(email, emspUser);
            }
          }
          // Get the Tag
          const emspTag = tags.find((tag) => tag.id === token.uid);
          await OCPITokensService.updateToken(this.tenant.id, this.ocpiEndpoint, token, emspTag, emspUser);
          result.success++;
        } catch (error) {
          result.failure++;
          result.logs.push(
            `Failed to update Issuer '${token.issuer}' - Token ID '${token.uid}': ${error.message}`
          );
        }
      }
      const nextUrl = OCPIUtils.getNextUrl(response.headers.link);
      if (nextUrl && nextUrl.length > 0 && nextUrl !== tokensUrl) {
        tokensUrl = nextUrl;
      } else {
        nextResult = false;
      }
      const executionDurationLoopSecs = (new Date().getTime() - startTimeLoop) / 1000;
      const executionDurationTotalLoopSecs = (new Date().getTime() - startTime) / 1000;
      Logging.logDebug({
        tenantID: this.tenant.id,
        action: ServerAction.OCPI_PULL_TOKENS,
        message: `${numberOfTags.toString()} token(s) processed in ${executionDurationLoopSecs}s - Total of ${totalNumberOfToken} token(s) processed in ${executionDurationTotalLoopSecs}s`,
        module: MODULE_NAME, method: 'pullTokens'
      });
    } while (nextResult);
    const executionDurationSecs = (new Date().getTime() - startTime) / 1000;
    Utils.logOcpiResult(this.tenant.id, ServerAction.OCPI_PULL_TOKENS,
      MODULE_NAME, 'pullTokens', result,
      `{{inSuccess}} token(s) were successfully pulled in ${executionDurationSecs}s`,
      `{{inError}} token(s) failed to be pulled in ${executionDurationSecs}s`,
      `{{inSuccess}} token(s) were successfully pulled and {{inError}} failed to be pulled in ${executionDurationSecs}s`,
      'No tokens have been pulled'
    );
    return result;
  }

  public async authorizeToken(token: OCPIToken, chargingStation: ChargingStation): Promise<string> {
    if (chargingStation.remoteAuthorizations && chargingStation.remoteAuthorizations.length > 0) {
      for (const remoteAuthorization of chargingStation.remoteAuthorizations) {
        if (remoteAuthorization.tagId === token.uid && OCPIUtils.isAuthorizationValid(remoteAuthorization.timestamp)) {
          Logging.logDebug({
            source: chargingStation.id,
            tenantID: this.tenant.id,
            action: ServerAction.OCPI_AUTHORIZE_TOKEN,
            message: `Valid Remote Authorization found for Tag ID '${token.uid}'`,
            module: MODULE_NAME, method: 'authorizeToken',
            detailedMessages: { response: remoteAuthorization }
          });
          return remoteAuthorization.id;
        }
      }
    }
    // Get tokens endpoint url
    const tokensUrl = `${this.getEndpointUrl('tokens', ServerAction.OCPI_AUTHORIZE_TOKEN)}/${token.uid}/authorize`;
    let siteID;
    if (!chargingStation.siteArea || !chargingStation.siteArea.siteID) {
      const siteArea = await SiteAreaStorage.getSiteArea(this.tenant.id, chargingStation.siteAreaID);
      siteID = siteArea ? siteArea.siteID : null;
    } else {
      siteID = chargingStation.siteArea.siteID;
    }
    // Build payload
    const payload: OCPILocationReference =
    {
      location_id: siteID,
      evse_uids: [OCPIUtils.buildEvseUID(chargingStation)]
    };
    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      source: chargingStation.id,
      action: ServerAction.OCPI_AUTHORIZE_TOKEN,
      message: `Post authorize at ${tokensUrl}`,
      module: MODULE_NAME, method: 'authorizeToken',
      detailedMessages: { payload }
    });
    // Call IOP
    const response = await this.axiosInstance.post(tokensUrl, payload,
      {
        headers: {
          'Authorization': `Token ${this.ocpiEndpoint.token}`,
          'Content-Type': 'application/json'
        },
      });
    if (!response.data.data) {
      throw new BackendError({
        action: ServerAction.OCPI_AUTHORIZE_TOKEN,
        message: 'Invalid response from Post Authorize',
        module: MODULE_NAME, method: 'authorizeToken',
        detailedMessages: { data: response.data }
      });
    }
    const authorizationInfo = response.data.data as OCPIAuthorizationInfo;
    if (authorizationInfo.allowed !== OCPIAllowed.ALLOWED) {
      throw new BackendError({
        action: ServerAction.OCPI_AUTHORIZE_TOKEN,
        message: 'Authorization rejected',
        module: MODULE_NAME, method: 'authorizeToken',
        detailedMessages: { authorizationInfo }
      });
    }
    if (!authorizationInfo.authorization_id) {
      throw new BackendError({
        action: ServerAction.OCPI_AUTHORIZE_TOKEN,
        message: 'Authorization allowed without \'authorization_id\'',
        module: MODULE_NAME, method: 'authorizeToken',
        detailedMessages: { authorizationInfo }
      });
    }
    Logging.logInfo({
      tenantID: this.tenant.id,
      source: chargingStation.id,
      action: ServerAction.OCPI_AUTHORIZE_TOKEN,
      message: `OCPI Authorization ID '${authorizationInfo.authorization_id}' has been issued successfully`,
      module: MODULE_NAME, method: 'authorizeToken',
      detailedMessages: { response: response.data }
    });
    return authorizationInfo.authorization_id;
  }

  public async startSession(ocpiToken: OCPIToken, chargingStation: ChargingStation, transaction: Transaction, authorizationId: string): Promise<void> {
    // Get tokens endpoint url
    const sessionsUrl = `${this.getEndpointUrl('sessions', ServerAction.OCPI_PUSH_SESSIONS)}/${this.getLocalCountryCode(ServerAction.OCPI_PUSH_SESSIONS)}/${this.getLocalPartyID(ServerAction.OCPI_PUSH_SESSIONS)}/${authorizationId}`;
    let siteID;
    if (!chargingStation.siteArea || !chargingStation.siteArea.siteID) {
      const siteArea = await SiteAreaStorage.getSiteArea(this.tenant.id, chargingStation.siteAreaID);
      siteID = siteArea ? siteArea.siteID : null;
    } else {
      siteID = chargingStation.siteArea.siteID;
    }
    const site: Site = await SiteStorage.getSite(this.tenant.id, siteID);
    const ocpiLocation: OCPILocation = OCPIMapping.convertChargingStationToOCPILocation(this.tenant, site, chargingStation,
      transaction.connectorId, this.getLocalCountryCode(ServerAction.OCPI_PUSH_SESSIONS), this.getLocalPartyID(ServerAction.OCPI_PUSH_SESSIONS));
    // Build payload
    const ocpiSession: OCPISession =
    {
      id: authorizationId,
      start_datetime: transaction.timestamp,
      kwh: 0,
      auth_method: OCPIAuthMethod.AUTH_REQUEST,
      auth_id: ocpiToken.auth_id,
      location: ocpiLocation,
      currency: this.settings.currency,
      status: OCPISessionStatus.PENDING,
      authorization_id: authorizationId,
      total_cost: transaction.currentCumulatedPrice > 0 ? transaction.currentCumulatedPrice : 0,
      last_updated: transaction.timestamp
    };
    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      source: chargingStation.id,
      action: ServerAction.OCPI_PUSH_SESSIONS,
      message: `Start OCPI Session ID '${ocpiSession.id}' (ID '${transaction.id}') at ${sessionsUrl}`,
      module: MODULE_NAME, method: 'startSession',
      detailedMessages: { payload: ocpiSession }
    });
    // Call IOP
    const response = await this.axiosInstance.put(sessionsUrl, ocpiSession,
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
    Logging.logInfo({
      tenantID: this.tenant.id,
      source: chargingStation.id,
      action: ServerAction.OCPI_PUSH_SESSIONS,
      message: `OCPI Session ID '${ocpiSession.id}' (ID '${transaction.id}') has been started successfully`,
      module: MODULE_NAME, method: 'startSession',
      detailedMessages: { response: response.data }
    });
  }

  public async updateSession(transaction: Transaction): Promise<void> {
    if (!transaction.ocpiData || !transaction.ocpiData.session) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: ServerAction.OCPI_PUSH_SESSIONS,
        message: 'OCPI Session not started',
        module: MODULE_NAME, method: 'updateSession',
      });
    }
    // Get tokens endpoint url
    const sessionsUrl = `${this.getEndpointUrl('sessions', ServerAction.OCPI_PUSH_SESSIONS)}/${this.getLocalCountryCode(ServerAction.OCPI_PUSH_SESSIONS)}/${this.getLocalPartyID(ServerAction.OCPI_PUSH_SESSIONS)}/${transaction.ocpiData.session.id}`;
    // Update transaction
    transaction.ocpiData.session.kwh = transaction.currentTotalConsumptionWh / 1000;
    transaction.ocpiData.session.last_updated = transaction.currentTimestamp;
    transaction.ocpiData.session.total_cost = transaction.currentCumulatedPrice > 0 ? transaction.currentCumulatedPrice : 0;
    transaction.ocpiData.session.currency = this.settings.currency;
    transaction.ocpiData.session.status = OCPISessionStatus.ACTIVE;
    transaction.ocpiData.session.charging_periods = await OCPIMapping.buildChargingPeriods(this.tenant.id, transaction);
    // Send OCPI information
    const patchBody: Partial<OCPISession> = {
      kwh: transaction.ocpiData.session.kwh,
      last_updated: transaction.ocpiData.session.last_updated,
      currency: transaction.ocpiData.session.currency,
      total_cost: transaction.ocpiData.session.total_cost > 0 ? transaction.ocpiData.session.total_cost : 0,
      status: transaction.ocpiData.session.status,
      charging_periods: transaction.ocpiData.session.charging_periods
    };
    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      source: transaction.chargeBoxID,
      action: ServerAction.OCPI_PUSH_SESSIONS,
      message: `Patch session at ${sessionsUrl}`,
      module: MODULE_NAME, method: 'updateSession',
      detailedMessages: { payload: patchBody }
    });
    // Call IOP
    const response = await this.axiosInstance.patch(sessionsUrl, patchBody, {
      headers: {
        'Authorization': `Token ${this.ocpiEndpoint.token}`,
        'Content-Type': 'application/json'
      },
    });
    Logging.logInfo({
      tenantID: this.tenant.id,
      source: transaction.chargeBoxID,
      action: ServerAction.OCPI_PUSH_SESSIONS,
      message: `OCPI Session ID '${transaction.ocpiData.session.id}' (ID '${transaction.id}') Updated successfully`,
      module: MODULE_NAME, method: 'updateSession',
      detailedMessages: { response: response.data }
    });
  }

  public async stopSession(transaction: Transaction): Promise<void> {
    if (!transaction.ocpiData) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: ServerAction.OCPI_PUSH_SESSIONS,
        message: `OCPI data does not exists on Session ID '${transaction.id}'`,
        module: MODULE_NAME, method: 'stopSession',
      });
    }
    if (!transaction.ocpiData.session) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: ServerAction.OCPI_PUSH_SESSIONS,
        message: `OCPI Session data does not exists on Session ID '${transaction.id}'`,
        module: MODULE_NAME, method: 'stopSession',
      });
    }
    if (!transaction.stop) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: ServerAction.OCPI_PUSH_SESSIONS,
        message: `OCPI Session ID '${transaction.ocpiData.session.id}' (ID '${transaction.id}') not yet stopped`,
        module: MODULE_NAME, method: 'stopSession',
      });
    }
    // Get tokens endpoint url
    const tokensUrl = `${this.getEndpointUrl('sessions', ServerAction.OCPI_PUSH_SESSIONS)}/${this.getLocalCountryCode(ServerAction.OCPI_PUSH_SESSIONS)}/${this.getLocalPartyID(ServerAction.OCPI_PUSH_SESSIONS)}/${transaction.ocpiData.session.id}`;
    transaction.ocpiData.session.kwh = transaction.stop.totalConsumptionWh / 1000;
    transaction.ocpiData.session.total_cost = transaction.stop.roundedPrice > 0 ? transaction.stop.roundedPrice : 0;
    transaction.ocpiData.session.end_datetime = transaction.stop.timestamp;
    transaction.ocpiData.session.last_updated = transaction.stop.timestamp;
    transaction.ocpiData.session.status = OCPISessionStatus.COMPLETED;
    transaction.ocpiData.session.charging_periods = await OCPIMapping.buildChargingPeriods(this.tenant.id, transaction);
    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      source: transaction.chargeBoxID,
      action: ServerAction.OCPI_PUSH_SESSIONS,
      message: `Stop OCPI Session ID '${transaction.ocpiData.session.id}' (ID '${transaction.id}') at ${tokensUrl}`,
      module: MODULE_NAME, method: 'stopSession',
      detailedMessages: { payload: transaction.ocpiData.session }
    });
    // Call IOP
    const response = await this.axiosInstance.put(tokensUrl, transaction.ocpiData.session,
      {
        headers: {
          'Authorization': `Token ${this.ocpiEndpoint.token}`,
          'Content-Type': 'application/json'
        },
      });
    Logging.logInfo({
      tenantID: this.tenant.id,
      source: transaction.chargeBoxID,
      action: ServerAction.OCPI_PUSH_SESSIONS,
      message: `OCPI Session ID '${transaction.ocpiData.session.id}' (ID '${transaction.id}') has been stopped successfully`,
      module: MODULE_NAME, method: 'stopSession',
      detailedMessages: { response: response.data }
    });
  }

  public async postCdr(transaction: Transaction): Promise<void> {
    if (!transaction.ocpiData) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: ServerAction.OCPI_PUSH_CDRS,
        message: `OCPI data does not exists on Session ID '${transaction.id}'`,
        module: MODULE_NAME, method: 'postCdr',
      });
    }
    if (!transaction.ocpiData.session) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: ServerAction.OCPI_PUSH_CDRS,
        message: `OCPI Session data does not exists on Session ID '${transaction.id}'`,
        module: MODULE_NAME, method: 'postCdr',
      });
    }
    if (!transaction.stop) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: ServerAction.OCPI_PUSH_CDRS,
        message: `OCPI Session ID '${transaction.ocpiData.session.id}' (ID '${transaction.id}') not stopped`,
        module: MODULE_NAME, method: 'postCdr',
      });
    }
    // Get tokens endpoint url
    const cdrsUrl = this.getEndpointUrl('cdrs', ServerAction.OCPI_PUSH_CDRS);
    transaction.ocpiData.cdr = {
      id: transaction.ocpiData.session.id,
      start_date_time: transaction.timestamp,
      stop_date_time: transaction.stop.timestamp,
      total_parking_time: (transaction.stop.totalInactivitySecs + transaction.stop.extraInactivitySecs) / 3600, // In hours
      total_time: transaction.stop.totalDurationSecs / 3600, // In hours
      total_energy: transaction.stop.totalConsumptionWh / 1000, // In kW.h
      currency: this.settings.currency,
      auth_id: transaction.ocpiData.session.auth_id,
      authorization_id: transaction.ocpiData.session.authorization_id,
      auth_method: transaction.ocpiData.session.auth_method,
      location: transaction.ocpiData.session.location,
      total_cost: transaction.stop.roundedPrice > 0 ? transaction.stop.roundedPrice : 0,
      charging_periods: await OCPIMapping.buildChargingPeriods(this.tenant.id, transaction),
      last_updated: transaction.stop.timestamp
    };
    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      source: transaction.chargeBoxID,
      action: ServerAction.OCPI_PUSH_CDRS,
      message: `Post CDR of OCPI Session ID '${transaction.ocpiData.session.id}' (ID '${transaction.id}') at ${cdrsUrl}`,
      module: MODULE_NAME, method: 'stopSession',
      detailedMessages: { cdr: transaction.ocpiData.cdr }
    });
    // Call IOP
    const response = await this.axiosInstance.post(cdrsUrl, transaction.ocpiData.cdr,
      {
        headers: {
          'Authorization': `Token ${this.ocpiEndpoint.token}`,
          'Content-Type': 'application/json'
        },
      });
    Logging.logInfo({
      tenantID: this.tenant.id,
      source: transaction.chargeBoxID,
      action: ServerAction.OCPI_PUSH_CDRS,
      message: `Post CDR of OCPI Session ID '${transaction.ocpiData.session.id}' (ID '${transaction.id}') has been done successfully`,
      module: MODULE_NAME, method: 'postCdr',
      detailedMessages: { response: response.data, cdr: transaction.ocpiData.cdr }
    });
  }

  public async removeChargingStation(chargingStation: ChargingStation): Promise<void> {
    if (!chargingStation.siteAreaID && !chargingStation.siteArea) {
      throw new BackendError({
        source: chargingStation.id,
        action: ServerAction.OCPI_PATCH_STATUS,
        message: 'Charging Station must be associated to a site area',
        module: MODULE_NAME, method: 'removeChargingStation',
      });
    }
    if (!chargingStation.issuer) {
      throw new BackendError({
        source: chargingStation.id,
        action: ServerAction.OCPI_PATCH_STATUS,
        message: 'Only charging Station issued locally can be exposed to IOP',
        module: MODULE_NAME, method: 'removeChargingStation',
      });
    }
    let siteID;
    if (!chargingStation.siteArea || !chargingStation.siteArea.siteID) {
      const siteArea = await SiteAreaStorage.getSiteArea(this.tenant.id, chargingStation.siteAreaID);
      siteID = siteArea ? siteArea.siteID : null;
    } else {
      siteID = chargingStation.siteArea.siteID;
    }
    const results: any[] = [];
    for (const connector of chargingStation.connectors) {
      const result = await this.patchEVSEStatus(chargingStation.id, siteID, OCPIUtils.buildEvseUID(chargingStation, connector), OCPIEvseStatus.REMOVED);
      results.push(result.data);
    }
    Logging.logInfo({
      tenantID: this.tenant.id,
      source: chargingStation.id,
      action: ServerAction.OCPI_PUSH_CDRS,
      message: 'Charging Station has been removed successfully',
      module: MODULE_NAME, method: 'removeChargingStation',
      detailedMessages: { responses: results }
    });
  }

  public async patchChargingStationStatus(chargingStation: ChargingStation, connector: Connector): Promise<void> {
    if (!chargingStation.siteAreaID && !chargingStation.siteArea) {
      throw new BackendError({
        source: chargingStation.id,
        action: ServerAction.OCPI_PATCH_STATUS,
        message: 'Charging Station must be associated to a site area',
        module: MODULE_NAME, method: 'patchChargingStationStatus',
      });
    }
    if (!chargingStation.issuer) {
      throw new BackendError({
        source: chargingStation.id,
        action: ServerAction.OCPI_PATCH_STATUS,
        message: 'Only charging Station issued locally can be exposed to IOP',
        module: MODULE_NAME, method: 'patchChargingStationStatus',
      });
    }
    if (!chargingStation.public) {
      throw new BackendError({
        source: chargingStation.id,
        action: ServerAction.OCPI_PATCH_STATUS,
        message: 'Private charging Station cannot be exposed to IOP',
        module: MODULE_NAME, method: 'patchChargingStationStatus',
      });
    }
    let siteID;
    if (!chargingStation.siteArea || !chargingStation.siteArea.siteID) {
      const siteArea = await SiteAreaStorage.getSiteArea(this.tenant.id, chargingStation.siteAreaID);
      siteID = siteArea ? siteArea.siteID : null;
    } else {
      siteID = chargingStation.siteArea.siteID;
    }
    await this.patchEVSEStatus(chargingStation.id, siteID, OCPIUtils.buildEvseUID(chargingStation, connector), OCPIMapping.convertStatus2OCPIStatus(connector.status));
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
    const transactions = await TransactionStorage.getTransactions(this.tenant.id, {
      issuer: true,
      ocpiSessionChecked: false
    }, Constants.DB_PARAMS_MAX_LIMIT);
    for (const transaction of transactions.result) {
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
            `Failed to check OCPI Session ID '${transaction.ocpiData.session.id}' (ID '${transaction.id}'): ${error.message}`
          );
        }
      }
      result.total++;
    }
    const executionDurationSecs = (new Date().getTime() - startTime) / 1000;
    Utils.logOcpiResult(this.tenant.id, ServerAction.OCPI_CHECK_SESSIONS,
      MODULE_NAME, 'checkSessions', result,
      `{{inSuccess}} Session(s) were successfully checked in ${executionDurationSecs}s`,
      `{{inError}} Session(s) failed to be checked in ${executionDurationSecs}s`,
      `{{inSuccess}} Session(s) were successfully checked and {{inError}} failed to be checked in ${executionDurationSecs}s`,
      'No Sessions have been checked'
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
    const options = {
      addChargeBoxID: true,
      countryID: this.getLocalCountryCode(ServerAction.OCPI_CHECK_LOCATIONS),
      partyID: this.getLocalPartyID(ServerAction.OCPI_CHECK_LOCATIONS)
    };
    // Get all EVSEs from all locations
    const locations = await OCPIMapping.getAllLocations(this.tenant, 0, 0, options);
    // Loop through locations
    for (const location of locations.result) {
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
            `Failed to check Location ID '${location.id}': ${error.message}`
          );
        }
      }
      result.total++;
    }
    const executionDurationSecs = (new Date().getTime() - startTime) / 1000;
    Utils.logOcpiResult(this.tenant.id, ServerAction.OCPI_CHECK_LOCATIONS,
      MODULE_NAME, 'checkLocations', result,
      `{{inSuccess}} Location(s) were successfully checked in ${executionDurationSecs}s`,
      `{{inError}} Location(s) failed to be checked in ${executionDurationSecs}s`,
      `{{inSuccess}} Location(s) were successfully checked and {{inError}} failed to be checked in ${executionDurationSecs}s`,
      'No Locations have been checked'
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
    const transactions = await TransactionStorage.getTransactions(this.tenant.id, {
      issuer: true,
      ocpiCdrChecked: false
    }, Constants.DB_PARAMS_MAX_LIMIT);
    for (const transaction of transactions.result) {
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
          `Failed to check CDR of OCPI Transaction ID '${transaction.ocpiData.session.id}' (ID '${transaction.id}'): ${error.message}`
        );
      }
      result.total++;
    }
    const executionDurationSecs = (new Date().getTime() - startTime) / 1000;
    Utils.logOcpiResult(this.tenant.id, ServerAction.OCPI_CHECK_CDRS,
      MODULE_NAME, 'checkCdrs', result,
      `{{inSuccess}} CDR(s) were successfully checked in ${executionDurationSecs}s`,
      `{{inError}} CDR(s) failed to be checked in ${executionDurationSecs}s`,
      `{{inSuccess}} CDR(s) were successfully checked and {{inError}} failed to be checked in ${executionDurationSecs}s`,
      'No CDRs have been checked'
    );
    return result;
  }

  /**
   * Send all EVSEs
   */
  public async sendEVSEStatuses(processAllEVSEs = true): Promise<OCPIResult> {
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
    const options = {
      addChargeBoxID: true,
      countryID: this.getLocalCountryCode(ServerAction.OCPI_PATCH_STATUS),
      partyID: this.getLocalPartyID(ServerAction.OCPI_PATCH_STATUS)
    };
    // Get timestamp before starting process - to be saved in DB at the end of the process
    const startDate = new Date();
    // Check if all EVSEs should be processed - in case of delta send - process only following EVSEs:
    //    - EVSEs (ChargingStations) in error from previous push
    //    - EVSEs (ChargingStations) with status notification from latest pushDate
    let chargeBoxIDsToProcess = [];
    if (!processAllEVSEs) {
      // Get ChargingStation in Failure from previous run
      chargeBoxIDsToProcess.push(...this.getChargeBoxIDsInFailure());
      // Get ChargingStation with new status notification
      chargeBoxIDsToProcess.push(...await this.getChargeBoxIDsWithNewStatusNotifications());
      // Remove duplicates
      chargeBoxIDsToProcess = _.uniq(chargeBoxIDsToProcess);
    }
    // Get all EVSEs from all locations
    const locations = await OCPIMapping.getAllLocations(this.tenant, 0, 0, options);
    // Loop through locations
    for (const location of locations.result) {
      if (location && location.evses) {
        // Loop through EVSE
        for (const evse of location.evses) {
          // Total amount of EVSEs
          result.total++;
          // Check if Charging Station should be processed
          if (!processAllEVSEs && !chargeBoxIDsToProcess.includes(evse.chargeBoxId)) {
            continue;
          }
          // Process it if not empty
          if (evse && location.id && evse.uid) {
            try {
              await this.patchEVSEStatus(evse.chargeBoxId, location.id, evse.uid, evse.status);
              result.success++;
            } catch (error) {
              result.failure++;
              result.objectIDsInFailure.push(evse.chargeBoxId);
              result.logs.push(
                `Failed to update the status of Location ID '${location.id}', Charging Station ID '${evse.evse_id}': ${error.message}`
              );
            }
            if (result.failure > 0) {
              // Send notification to admins
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              NotificationHandler.sendOCPIPatchChargingStationsStatusesError(
                this.tenant.id,
                {
                  location: location.name,
                  evseDashboardURL: Utils.buildEvseURL((await TenantStorage.getTenant(this.tenant.id)).subdomain),
                }
              );
            }
          }
        }
      }
    }
    // Save result in ocpi endpoint
    this.ocpiEndpoint.lastPatchJobOn = startDate;
    // Set result
    if (result) {
      this.ocpiEndpoint.lastPatchJobResult = {
        successNbr: result.success,
        failureNbr: result.failure,
        totalNbr: result.total,
        chargeBoxIDsInFailure: _.uniq(result.objectIDsInFailure),
        chargeBoxIDsInSuccess: _.uniq(result.objectIDsInFailure)
      };
    } else {
      this.ocpiEndpoint.lastPatchJobResult = {
        successNbr: 0,
        failureNbr: 0,
        totalNbr: 0,
        chargeBoxIDsInFailure: [],
        chargeBoxIDsInSuccess: []
      };
    }
    // Save
    const executionDurationSecs = (new Date().getTime() - startTime) / 1000;
    await OCPIEndpointStorage.saveOcpiEndpoint(this.tenant.id, this.ocpiEndpoint);
    Utils.logOcpiResult(this.tenant.id, ServerAction.OCPI_PATCH_STATUS,
      MODULE_NAME, 'sendEVSEStatuses', result,
      `{{inSuccess}} EVSE Status(es) were successfully patched in ${executionDurationSecs}s`,
      `{{inError}} EVSE Status(es) failed to be patched in ${executionDurationSecs}s`,
      `{{inSuccess}} EVSE Status(es) were successfully patched and {{inError}} failed to be patched in ${executionDurationSecs}s`,
      'No EVSE Status have been patched'
    );
    // Return result
    return result;
  }

  // Get ChargeBoxIds with new status notifications
  private async getChargeBoxIDsWithNewStatusNotifications(): Promise<string[]> {
    // Get last job
    const lastPatchJobOn = this.ocpiEndpoint.lastPatchJobOn ? this.ocpiEndpoint.lastPatchJobOn : new Date();
    // Build params
    const params = { 'dateFrom': lastPatchJobOn };
    // Get last status notifications
    const statusNotificationsResult = await OCPPStorage.getStatusNotifications(this.tenant.id, params, Constants.DB_PARAMS_MAX_LIMIT);
    // Loop through notifications
    if (statusNotificationsResult.count > 0) {
      return statusNotificationsResult.result.map((statusNotification) => statusNotification.chargeBoxID);
    }
    return [];
  }

  // Get ChargeBoxIDs in failure from previous job
  private getChargeBoxIDsInFailure(): string[] {
    if (this.ocpiEndpoint.lastPatchJobResult?.chargeBoxIDsInFailure) {
      return this.ocpiEndpoint.lastPatchJobResult.chargeBoxIDsInFailure;
    }
    return [];
  }

  private async patchEVSEStatus(chargingStationID: string, locationId: string, evseUID: string, newStatus: OCPIEvseStatus): Promise<AxiosResponse<any>> {
    // Check for input parameter
    if (!locationId || !evseUID || !newStatus) {
      throw new BackendError({
        action: ServerAction.OCPI_PATCH_STATUS,
        message: 'Invalid parameters',
        module: MODULE_NAME, method: 'patchEVSEStatus',
      });
    }
    // Get locations endpoint url
    const locationsUrl = this.getEndpointUrl('locations', ServerAction.OCPI_PATCH_STATUS);
    // Read configuration to retrieve
    const countryCode = this.getLocalCountryCode(ServerAction.OCPI_PATCH_STATUS);
    const partyID = this.getLocalPartyID(ServerAction.OCPI_PATCH_STATUS);
    // Build url to EVSE
    const fullUrl = locationsUrl + `/${countryCode}/${partyID}/${locationId}/${evseUID}`;
    // Build payload
    const payload = { 'status': newStatus };
    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      source: chargingStationID,
      action: ServerAction.OCPI_PATCH_STATUS,
      message: `Patch OCPI Charging Station ID '${evseUID}' status to '${newStatus}' at ${fullUrl}`,
      module: MODULE_NAME, method: 'patchEVSEStatus',
      detailedMessages: { payload }
    });
    // Call IOP
    const result = await this.axiosInstance.patch(fullUrl, payload,
      {
        headers: {
          'Authorization': `Token ${this.ocpiEndpoint.token}`,
          'Content-Type': 'application/json'
        },
      });
    // Log
    Logging.logInfo({
      tenantID: this.tenant.id,
      source: chargingStationID,
      action: ServerAction.OCPI_PATCH_STATUS,
      message: `OCPI Charging Station ID '${evseUID}' has been patched successfully to '${newStatus}'`,
      module: MODULE_NAME, method: 'patchEVSEStatus',
      detailedMessages: { payload }
    });
    return result;
  }

  private async checkCdr(transaction: Transaction): Promise<boolean> {
    if (!transaction.ocpiData) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: ServerAction.OCPI_CHECK_CDRS,
        message: `OCPI data does not exists on Session ID '${transaction.id}'`,
        module: MODULE_NAME, method: 'checkCdr',
      });
    }
    if (!transaction.ocpiData.cdr) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: ServerAction.OCPI_CHECK_CDRS,
        message: `OCPI Session data does not exists on Session ID '${transaction.id}'`,
        module: MODULE_NAME, method: 'checkCdr',
      });
    }
    const cdrsUrl = this.getEndpointUrl('cdrs', ServerAction.OCPI_CHECK_CDRS);
    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      source: transaction.chargeBoxID,
      action: ServerAction.OCPI_CHECK_CDRS,
      message: `Check CDR of OCPI Session ID '${transaction.ocpiData.session.id}' (ID '${transaction.id}') at ${cdrsUrl}/${transaction.ocpiData.cdr.id}`,
      module: MODULE_NAME, method: 'checkCdr'
    });
    // Check CDR
    const response = await this.axiosInstance.get(`${cdrsUrl}/${transaction.ocpiData.cdr.id}`,
      {
        headers: {
          'Authorization': `Token ${this.ocpiEndpoint.token}`
        },
      });
    Logging.logDebug({
      tenantID: this.tenant.id,
      source: transaction.chargeBoxID,
      action: ServerAction.OCPI_CHECK_CDRS,
      message: `CDR of OCPI Session ID '${transaction.ocpiData.session.id}' (ID '${transaction.id}') checked successfully`,
      module: MODULE_NAME, method: 'checkCdr',
      detailedMessages: { response: response.data }
    });
    if (response.data.status_code === 3001) {
      await this.axiosInstance.post(cdrsUrl, transaction.ocpiData.cdr,
        {
          headers: {
            'Authorization': `Token ${this.ocpiEndpoint.token}`,
            'Content-Type': 'application/json'
          },
        });
      return false;
    }
    const cdr = response.data.data as OCPICdr;
    if (cdr) {
      transaction.ocpiData.cdrCheckedOn = new Date();
      await TransactionStorage.saveTransaction(this.tenant.id, transaction);
      return true;
    }
    throw new BackendError({
      action: ServerAction.OCPI_CHECK_CDRS,
      source: transaction.chargeBoxID,
      message: `Failed to check CDR of OCPI Session ID '${transaction.ocpiData.session.id}' (ID '${transaction.id}') at ${cdrsUrl}/${transaction.ocpiData.cdr.id}`,
      module: MODULE_NAME, method: 'checkCdr',
      detailedMessages: { data: response.data }
    });
  }

  private async checkSession(transaction: Transaction): Promise<boolean> {
    if (!transaction.ocpiData) {
      throw new BackendError({
        action: ServerAction.OCPI_CHECK_SESSIONS,
        source: transaction.chargeBoxID,
        message: `OCPI data does not exists on Session ID '${transaction.id}'`,
        module: MODULE_NAME, method: 'checkSession',
      });
    }
    if (!transaction.ocpiData.session) {
      throw new BackendError({
        action: ServerAction.OCPI_CHECK_SESSIONS,
        source: transaction.chargeBoxID,
        message: `OCPI Session data does not exists on Session ID '${transaction.id}'`,
        module: MODULE_NAME, method: 'checkSession',
      });
    }
    const sessionsUrl = `${this.getEndpointUrl('sessions', ServerAction.OCPI_CHECK_SESSIONS)}/${this.getLocalCountryCode(ServerAction.OCPI_CHECK_SESSIONS)}/${this.getLocalPartyID(ServerAction.OCPI_CHECK_SESSIONS)}/${transaction.ocpiData.session.id}`;
    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      source: transaction.chargeBoxID,
      action: ServerAction.OCPI_CHECK_SESSIONS,
      message: `Check OCPI Session ID '${transaction.ocpiData.session.id}' (ID '${transaction.id}') at ${sessionsUrl}`,
      module: MODULE_NAME, method: 'checkSession'
    });
    // Check
    const response = await this.axiosInstance.get(sessionsUrl,
      {
        headers: {
          'Authorization': `Token ${this.ocpiEndpoint.token}`
        },
      });
    Logging.logDebug({
      tenantID: this.tenant.id,
      source: transaction.chargeBoxID,
      action: ServerAction.OCPI_CHECK_SESSIONS,
      message: `OCPI Session ID '${transaction.ocpiData.session.id}' (ID '${transaction.id}') checked successfully`,
      module: MODULE_NAME, method: 'checkSession',
      detailedMessages: { response: response.data }
    });
    const session = response.data.data as OCPISession;
    if (session) {
      transaction.ocpiData.sessionCheckedOn = new Date();
      await TransactionStorage.saveTransaction(this.tenant.id, transaction);
      return true;
    }
    throw new BackendError({
      action: ServerAction.OCPI_CHECK_CDRS,
      source: transaction.chargeBoxID,
      message: `Failed to check OCPI Session ID '${transaction.ocpiData.session.id}' (ID '${transaction.id}') at ${sessionsUrl}`,
      module: MODULE_NAME, method: 'checkSession',
      detailedMessages: { data: response.data }
    });
  }

  private async checkLocation(location: OCPILocation): Promise<boolean> {
    // Get locations endpoint url
    const locationsUrl = this.getEndpointUrl('locations', ServerAction.OCPI_CHECK_LOCATIONS);
    // Read configuration to retrieve
    const countryCode = this.getLocalCountryCode(ServerAction.OCPI_CHECK_LOCATIONS);
    const partyID = this.getLocalPartyID(ServerAction.OCPI_CHECK_LOCATIONS);
    const locationUrl = locationsUrl + `/${countryCode}/${partyID}/${location.id}`;
    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: ServerAction.OCPI_CHECK_LOCATIONS,
      message: `Check Location ID '${location.id}' at ${locationUrl}`,
      module: MODULE_NAME, method: 'checkLocation'
    });
    // Call IOP
    const response = await this.axiosInstance.get(locationUrl,
      {
        headers: {
          'Authorization': `Token ${this.ocpiEndpoint.token}`
        },
      });
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: ServerAction.OCPI_CHECK_LOCATIONS,
      message: `Location ID '${location.id}' checked successfully`,
      module: MODULE_NAME, method: 'checkLocation',
      detailedMessages: { response: response.data }
    });
    const checkedLocation = response.data.data as OCPILocation;
    if (checkedLocation) {
      return true;
    }
    throw new BackendError({
      action: ServerAction.OCPI_CHECK_LOCATIONS,
      message: `Failed to check Location ID '${location.id}'`,
      module: MODULE_NAME, method: 'checkLocation',
      detailedMessages: { data: response.data }
    });
  }
}
