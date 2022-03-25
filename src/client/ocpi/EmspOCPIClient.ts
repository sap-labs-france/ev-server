import BackendError from '../../exception/BackendError';
import ChargingStation from '../../types/ChargingStation';
import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import Logging from '../../utils/Logging';
import LoggingHelper from '../../utils/LoggingHelper';
import { OCPICdr } from '../../types/ocpi/OCPICdr';
import OCPIClient from './OCPIClient';
import { OCPICommandResponse } from '../../types/ocpi/OCPICommandResponse';
import { OCPICommandType } from '../../types/ocpi/OCPICommandType';
import OCPIEndpoint from '../../types/ocpi/OCPIEndpoint';
import OCPIEndpointStorage from '../../storage/mongodb/OCPIEndpointStorage';
import { OCPILocation } from '../../types/ocpi/OCPILocation';
import { OCPIResult } from '../../types/ocpi/OCPIResult';
import { OCPIRole } from '../../types/ocpi/OCPIRole';
import { OCPISession } from '../../types/ocpi/OCPISession';
import { OCPIStartSession } from '../../types/ocpi/OCPIStartSession';
import { OCPIStopSession } from '../../types/ocpi/OCPIStopSession';
import { OCPIToken } from '../../types/ocpi/OCPIToken';
import OCPIUtils from '../../server/ocpi/OCPIUtils';
import OCPIUtilsService from '../../server/ocpi/ocpi-services-impl/ocpi-2.1.1/OCPIUtilsService';
import { OcpiSetting } from '../../types/Setting';
import { Promise } from 'bluebird';
import { ServerAction } from '../../types/Server';
import SiteAreaStorage from '../../storage/mongodb/SiteAreaStorage';
import SiteStorage from '../../storage/mongodb/SiteStorage';
import TagStorage from '../../storage/mongodb/TagStorage';
import Tenant from '../../types/Tenant';
import TransactionStorage from '../../storage/mongodb/TransactionStorage';
import Utils from '../../utils/Utils';
import _ from 'lodash';
import moment from 'moment';

const MODULE_NAME = 'EmspOCPIClient';

export default class EmspOCPIClient extends OCPIClient {
  public constructor(tenant: Tenant, settings: OcpiSetting, ocpiEndpoint: OCPIEndpoint) {
    super(tenant, settings, ocpiEndpoint, OCPIRole.EMSP);
    if (ocpiEndpoint.role !== OCPIRole.EMSP) {
      throw new BackendError({
        message: `EmspOCPIClient requires OCPI Endpoint with role ${OCPIRole.EMSP}`,
        module: MODULE_NAME, method: 'constructor',
      });
    }
  }

  public async pushTokens(): Promise<OCPIResult> {
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
    const lastPatchJobOn = new Date();
    let currentSkip = 0;
    let tokens: DataResult<OCPIToken>;
    do {
      // Get all tokens
      tokens = await OCPIUtilsService.getEmspTokens(
        this.tenant, Constants.DB_RECORD_COUNT_DEFAULT, currentSkip);
      if (!Utils.isEmptyArray(tokens.result)) {
        await Promise.map(tokens.result, async (token: OCPIToken) => {
          result.total++;
          try {
            await this.pushToken(token);
            result.success++;
          } catch (error) {
            result.failure++;
            result.objectIDsInFailure.push(token.uid);
            result.logs.push(
              `Failed to update ID '${token.uid}': ${error.message as string}`
            );
          }
        },
        { concurrency: Constants.OCPI_MAX_PARALLEL_REQUESTS });
      }
      currentSkip += Constants.DB_RECORD_COUNT_DEFAULT;
    } while (!Utils.isEmptyArray(tokens.result));
    // Save result in ocpi endpoint
    this.ocpiEndpoint.lastPatchJobOn = lastPatchJobOn;
    // Set result
    if (result) {
      this.ocpiEndpoint.lastPatchJobResult = {
        'successNbr': result.success,
        'failureNbr': result.failure,
        'totalNbr': result.total,
        'tokenIDsInFailure': _.uniq(result.objectIDsInFailure),
      };
    } else {
      this.ocpiEndpoint.lastPatchJobResult = {
        'successNbr': 0,
        'failureNbr': 0,
        'totalNbr': 0,
        'tokenIDsInFailure': [],
      };
    }
    // Save
    await OCPIEndpointStorage.saveOcpiEndpoint(this.tenant, this.ocpiEndpoint);
    const executionDurationSecs = (new Date().getTime() - startTime) / 1000;
    await Logging.logOcpiResult(this.tenant.id, ServerAction.OCPI_EMSP_PUSH_TOKENS,
      MODULE_NAME, 'sendTokens', result,
      `{{inSuccess}} Token(s) were successfully pushed in ${executionDurationSecs}s`,
      `{{inError}} Token(s) failed to be pushed in ${executionDurationSecs}s`,
      `{{inSuccess}} Token(s) were successfully pushed and {{inError}} failed to be pushed in ${executionDurationSecs}s`,
      'No Tokens have been pushed'
    );
    return result;
  }

  public async pullLocations(partial = true): Promise<OCPIResult> {
    // Result
    const result: OCPIResult = {
      success: 0,
      failure: 0,
      total: 0,
      logs: []
    };
    // Perfs trace
    const startTime = new Date().getTime();
    // Get locations endpoint url
    let locationsUrl = this.getEndpointUrl('locations', ServerAction.OCPI_EMSP_PULL_LOCATIONS);
    if (partial) {
      // Take the last day
      const momentFrom = moment().utc().subtract(1, 'days').startOf('day');
      locationsUrl = `${locationsUrl}?date_from=${momentFrom.format()}&limit=50`;
    } else {
      // Take them all
      locationsUrl = `${locationsUrl}?limit=50`;
    }
    const company = await OCPIUtils.checkAndGetEMSPCompany(this.tenant, this.ocpiEndpoint);
    const sites = await SiteStorage.getSites(this.tenant,
      { companyIDs: [ company.id ] }, Constants.DB_PARAMS_MAX_LIMIT);
    let nextResult = true;
    do {
      // Call IOP
      const response = await this.axiosInstance.get(
        locationsUrl,
        {
          headers: {
            Authorization: `Token ${this.ocpiEndpoint.token}`
          },
        });
      const locations = response.data.data as OCPILocation[];
      if (!Utils.isEmptyArray(locations)) {
        // Cannot process locations in parallel (uniqueness is on site name) -> leads to dups
        for (const location of locations) {
          try {
            // Keep Evses a part from Location
            const evses = location.evses;
            delete location.evses;
            // Process Site
            const siteName = location.operator.name;
            const foundSite = sites.result.find((existingSite) => existingSite.name === siteName);
            const site = await OCPIUtils.processEMSPLocationSite(
              this.tenant, location, company, foundSite, siteName);
            // Get Site Area
            const foundSiteArea = await SiteAreaStorage.getSiteAreaByOcpiLocationUid(this.tenant, location.id);
            // Process Site Area
            const siteArea = await OCPIUtils.processEMSPLocationSiteArea(this.tenant, location, site, foundSiteArea);
            // Process Charging Station
            await OCPIUtils.processEMSPLocationChargingStations(
              this.tenant, location, site, siteArea, evses, ServerAction.OCPI_EMSP_PULL_LOCATIONS);
            // Push the Site then it can be retrieve in the next round
            if (!foundSite && site) {
              sites.result.push(site);
            }
            result.success++;
          } catch (error) {
            result.failure++;
            result.logs.push(
              `Failed to update Location '${location.name}': ${error.message as string}`
            );
          }
        }
      }
      const nextUrl = OCPIUtils.getNextUrl(response.headers.link);
      if (nextUrl && nextUrl.length > 0 && nextUrl !== locationsUrl) {
        locationsUrl = nextUrl;
      } else {
        nextResult = false;
      }
    } while (nextResult);
    const executionDurationSecs = (new Date().getTime() - startTime) / 1000;
    await Logging.logOcpiResult(this.tenant.id, ServerAction.OCPI_EMSP_PULL_LOCATIONS,
      MODULE_NAME, 'pullLocations', result,
      `{{inSuccess}} Location(s) were successfully pulled in ${executionDurationSecs}s`,
      `{{inError}} Location(s) failed to be pulled in ${executionDurationSecs}s`,
      `{{inSuccess}} Location(s) were successfully pulled and {{inError}} failed to be pulled in ${executionDurationSecs}s`,
      'No Locations have been pulled'
    );
    return result;
  }

  public async pullSessions(): Promise<OCPIResult> {
    // Result
    const result: OCPIResult = {
      success: 0,
      failure: 0,
      total: 0,
      logs: []
    };
    // Perfs trace
    const startTime = new Date().getTime();
    // Get sessions endpoint url
    let sessionsUrl = this.getEndpointUrl('sessions', ServerAction.OCPI_EMSP_PULL_SESSIONS);
    const momentFrom = moment().utc().subtract(2, 'days').startOf('day');
    sessionsUrl = `${sessionsUrl}?date_from=${momentFrom.format()}&limit=10`;
    let nextResult = true;
    do {
      // Call IOP
      const response = await this.axiosInstance.get(
        sessionsUrl,
        {
          headers: {
            Authorization: `Token ${this.ocpiEndpoint.token}`
          },
        });
      const sessions = response.data.data as OCPISession[];
      if (!Utils.isEmptyArray(sessions)) {
        await Promise.map(sessions, async (session: OCPISession) => {
          try {
            await OCPIUtilsService.processEmspTransaction(this.tenant, session, ServerAction.OCPI_EMSP_PULL_SESSIONS);
            result.success++;
          } catch (error) {
            result.failure++;
            result.logs.push(
              `Failed to update OCPI Session ID '${session.id}': ${error.message as string}`
            );
          }
        },
        { concurrency: 1 });
      }
      const nextUrl = OCPIUtils.getNextUrl(response.headers.link);
      if (nextUrl && nextUrl.length > 0 && nextUrl !== sessionsUrl) {
        sessionsUrl = nextUrl;
      } else {
        nextResult = false;
      }
    } while (nextResult);
    result.total = result.failure + result.success;
    const executionDurationSecs = (new Date().getTime() - startTime) / 1000;
    await Logging.logOcpiResult(this.tenant.id, ServerAction.OCPI_EMSP_PULL_SESSIONS,
      MODULE_NAME, 'pullSessions', result,
      `{{inSuccess}} Session(s) were successfully pulled in ${executionDurationSecs}s`,
      `{{inError}} Session(s) failed to be pulled in ${executionDurationSecs}s`,
      `{{inSuccess}} Session(s) were successfully pulled and {{inError}} failed to be pulled in ${executionDurationSecs}s`,
      'No Sessions have been pulled'
    );
    return result;
  }

  public async pullCdrs(): Promise<OCPIResult> {
    // Result
    const result: OCPIResult = {
      success: 0,
      failure: 0,
      total: 0,
      logs: []
    };
    // Perfs trace
    const startTime = new Date().getTime();
    // Get cdrs endpoint url
    let cdrsUrl = this.getEndpointUrl('cdrs', ServerAction.OCPI_EMSP_PULL_CDRS);
    const momentFrom = moment().utc().subtract(7, 'days').startOf('day');
    cdrsUrl = `${cdrsUrl}?date_from=${momentFrom.format()}&limit=10`;
    let nextResult = true;
    do {
      // Call IOP
      const response = await this.axiosInstance.get(
        cdrsUrl,
        {
          headers: {
            Authorization: `Token ${this.ocpiEndpoint.token}`
          },
        });
      const cdrs = response.data.data as OCPICdr[];
      if (!Utils.isEmptyArray(cdrs)) {
        await Promise.map(cdrs, async (cdr: OCPICdr) => {
          try {
            await OCPIUtilsService.processEmspCdr(this.tenant, cdr, ServerAction.OCPI_EMSP_PULL_CDRS);
            result.success++;
          } catch (error) {
            result.failure++;
            result.logs.push(
              `Failed to update CDR ID '${cdr.id}': ${error.message as string}`
            );
          }
        },
        { concurrency: Constants.OCPI_MAX_PARALLEL_REQUESTS });
      }
      const nextUrl = OCPIUtils.getNextUrl(response.headers.link);
      if (nextUrl && nextUrl.length > 0 && nextUrl !== cdrsUrl) {
        cdrsUrl = nextUrl;
      } else {
        nextResult = false;
      }
    } while (nextResult);
    result.total = result.failure + result.success;
    const executionDurationSecs = (new Date().getTime() - startTime) / 1000;
    await Logging.logOcpiResult(this.tenant.id, ServerAction.OCPI_EMSP_PULL_CDRS,
      MODULE_NAME, 'pullCdrs', result,
      `{{inSuccess}} CDR(s) were successfully pulled in ${executionDurationSecs}s`,
      `{{inError}} CDR(s) failed to be pulled in ${executionDurationSecs}s`,
      `{{inSuccess}} CDR(s) were successfully pulled and {{inError}} failed to be pulled in ${executionDurationSecs}s`,
      'No CDRs have been pulled'
    );
    return result;
  }

  public async pushToken(token: OCPIToken): Promise<boolean> {
    // Get tokens endpoint url
    const tokensUrl = this.getEndpointUrl('tokens', ServerAction.OCPI_EMSP_PUSH_TOKENS);
    // Read configuration to retrieve
    const countryCode = this.getLocalCountryCode(ServerAction.OCPI_EMSP_PUSH_TOKENS);
    const partyID = this.getLocalPartyID(ServerAction.OCPI_EMSP_PUSH_TOKENS);
    // Build url to IOP
    const fullUrl = tokensUrl + `/${countryCode}/${partyID}/${token.uid}`;
    // Call IOP
    await this.axiosInstance.put(
      fullUrl,
      token,
      {
        headers: {
          Authorization: `Token ${this.ocpiEndpoint.token}`,
          'Content-Type': 'application/json'
        },
      });
    return true;
  }

  public async remoteStartSession(chargingStation: ChargingStation, connectorID: number, tagID: string): Promise<OCPICommandResponse> {
    // Get command endpoint url
    const commandUrl = this.getEndpointUrl('commands', ServerAction.OCPI_EMSP_START_SESSION) + '/' + OCPICommandType.START_SESSION;
    const callbackUrl = this.getLocalEndpointUrl('commands') + '/' + OCPICommandType.START_SESSION;
    const tag = await TagStorage.getTag(this.tenant, tagID, { withUser: true });
    if (!tag || !tag.issuer || !tag.active) {
      throw new BackendError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action: ServerAction.OCPI_EMSP_START_SESSION,
        message: `${Utils.buildConnectorInfo(connectorID)} OCPI Remote Start Session is not available for Tag ID '${tagID}'`,
        module: MODULE_NAME, method: 'remoteStartSession',
        detailedMessages: { tag: tag }
      });
    }
    if (!tag.user || !tag.user.issuer) {
      throw new BackendError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action: ServerAction.OCPI_EMSP_START_SESSION,
        message: `${Utils.buildConnectorInfo(connectorID)} OCPI Remote Start Session is not available for user with Tag ID '${tagID}'`,
        module: MODULE_NAME, method: 'remoteStartSession',
        detailedMessages: { user: tag.user }
      });
    }
    if (Utils.isEmptyArray(chargingStation.ocpiData?.evses)) {
      throw new BackendError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action: ServerAction.OCPI_EMSP_START_SESSION,
        message: `${Utils.buildConnectorInfo(connectorID)} Charging Station has no OCPI EVSE data`,
        module: MODULE_NAME, method: 'remoteStartSession',
        detailedMessages: { user: tag.user }
      });
    }
    const evse = chargingStation.ocpiData.evses[0];
    const token = OCPIUtils.buildOCPITokenFromTag(this.tenant, tag);
    const authorizationId = Utils.generateUUID();
    const remoteStart: OCPIStartSession = {
      response_url: callbackUrl + '/' + authorizationId,
      token: token,
      evse_uid: evse.uid,
      location_id: evse.location_id,
      authorization_id: authorizationId
    };
    // Call IOP
    const response = await this.axiosInstance.post(
      commandUrl,
      remoteStart,
      {
        headers: {
          'Authorization': `Token ${this.ocpiEndpoint.token}`,
          'Content-Type': 'application/json'
        },
      });
    await Logging.logDebug({
      tenantID: this.tenant.id,
      ...LoggingHelper.getChargingStationProperties(chargingStation),
      action: ServerAction.OCPI_EMSP_START_SESSION,
      message: `${Utils.buildConnectorInfo(connectorID)} OCPI Remote Start session response status '${response.status}'`,
      module: MODULE_NAME, method: 'remoteStartSession',
      detailedMessages: { remoteStart, response: response.data }
    });
    return response.data.data as OCPICommandResponse;
  }

  public async remoteStopSession(transactionID: number): Promise<OCPICommandResponse> {
    // Get command endpoint url
    const commandUrl = this.getEndpointUrl('commands', ServerAction.OCPI_EMSP_START_SESSION) + '/' + OCPICommandType.STOP_SESSION;
    const callbackUrl = this.getLocalEndpointUrl('commands') + '/' + OCPICommandType.STOP_SESSION;
    // Get transaction
    const transaction = await TransactionStorage.getTransaction(this.tenant, transactionID);
    if (!transaction) {
      throw new BackendError({
        action: ServerAction.OCPI_EMSP_START_SESSION,
        message: `Transaction ID '${transactionID}' does not exist`,
        module: MODULE_NAME, method: 'remoteStopSession'
      });
    }
    if (!transaction.issuer) {
      throw new BackendError({
        ...LoggingHelper.getTransactionProperties(transaction),
        action: ServerAction.OCPI_EMSP_START_SESSION,
        message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} Transaction belongs to an external organization`,
        module: MODULE_NAME, method: 'remoteStopSession',
        detailedMessages: { transaction }
      });
    }
    if (!transaction.ocpiData?.session) {
      throw new BackendError({
        ...LoggingHelper.getTransactionProperties(transaction),
        action: ServerAction.OCPI_EMSP_START_SESSION,
        message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} No OCPI Session data`,
        module: MODULE_NAME, method: 'remoteStopSession',
        detailedMessages: { transaction }
      });
    }
    const payload: OCPIStopSession = {
      response_url: callbackUrl + '/' + transaction.ocpiData.session.id,
      session_id: transaction.ocpiData.session.id
    };
    // Call IOP
    const response = await this.axiosInstance.post(
      commandUrl,
      payload,
      {
        headers: {
          'Authorization': `Token ${this.ocpiEndpoint.token}`,
          'Content-Type': 'application/json'
        },
      });
    await Logging.logDebug({
      ...LoggingHelper.getTransactionProperties(transaction),
      tenantID: this.tenant.id,
      action: ServerAction.OCPI_EMSP_STOP_SESSION,
      message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} OCPI Remote Stop response status '${response.status}'`,
      module: MODULE_NAME, method: 'remoteStopSession',
      detailedMessages: { transaction, response: response.data }
    });
    return response.data.data as OCPICommandResponse;
  }
}
