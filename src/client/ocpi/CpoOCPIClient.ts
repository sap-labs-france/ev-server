import axios from 'axios';
import _ from 'lodash';
import moment from 'moment';
import BackendError from '../../exception/BackendError';
import NotificationHandler from '../../notification/NotificationHandler';
import OCPIMapping from '../../server/ocpi/ocpi-services-impl/ocpi-2.1.1/OCPIMapping';
import OCPITokensService from '../../server/ocpi/ocpi-services-impl/ocpi-2.1.1/OCPITokensService';
import OCPIUtils from '../../server/ocpi/OCPIUtils';
import OCPIEndpointStorage from '../../storage/mongodb/OCPIEndpointStorage';
import OCPPStorage from '../../storage/mongodb/OCPPStorage';
import SiteAreaStorage from '../../storage/mongodb/SiteAreaStorage';
import SiteStorage from '../../storage/mongodb/SiteStorage';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import { Action } from '../../types/Authorization';
import ChargingStation, { Connector } from '../../types/ChargingStation';
import { OCPIAllowed, OCPIAuthorizationInfo } from '../../types/ocpi/OCPIAuthorizationInfo';
import { CdrDimensionType } from '../../types/ocpi/OCPIChargingPeriod';
import OCPIEndpoint from '../../types/ocpi/OCPIEndpoint';
import { OCPIEvseStatus } from '../../types/ocpi/OCPIEvse';
import { OCPILocation, OCPILocationReference } from '../../types/ocpi/OCPILocation';
import { OCPIRole } from '../../types/ocpi/OCPIRole';
import { OCPIAuthMethod, OCPISession, OCPISessionStatus } from '../../types/ocpi/OCPISession';
import { OCPIToken } from '../../types/ocpi/OCPIToken';
import { OcpiSetting } from '../../types/Setting';
import Site from '../../types/Site';
import Tenant from '../../types/Tenant';
import Transaction from '../../types/Transaction';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import OCPIClient from './OCPIClient';

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

  /**
   * Pull Tokens
   */
  async pullTokens(partial = true) {
    // Result
    const sendResult = {
      success: 0,
      failure: 0,
      total: 0,
      logs: []
    };
    // Get tokens endpoint url
    let tokensUrl = this.getEndpointUrl('tokens', Action.OCPI_PULL_TOKENS);
    if (partial) {
      const momentFrom = moment().utc().subtract(1, 'days').startOf('day');
      tokensUrl = `${tokensUrl}?date_from=${momentFrom.format()}&limit=25`;
    } else {
      tokensUrl = `${tokensUrl}?limit=25`;
    }
    let nextResult = true;
    while (nextResult) {
      // Log
      Logging.logDebug({
        tenantID: this.tenant.id,
        action: Action.OCPI_PULL_TOKENS,
        message: `Pull Tokens at ${tokensUrl}`,
        module: MODULE_NAME, method: 'pullTokens'
      });
      // Call IOP
      const response = await axios.get(tokensUrl,
        {
          headers: {
            Authorization: `Token ${this.ocpiEndpoint.token}`
          },
          timeout: 10000
        });
      // Check response
      if (response.status !== 200 || !response.data) {
        throw new BackendError({
          action: Action.OCPI_PULL_TOKENS,
          message: `Invalid response code ${response.status} from Pull tokens`,
          module: MODULE_NAME, method: 'pullTokens',
        });
      }
      if (!response.data.data) {
        throw new BackendError({
          action: Action.OCPI_PULL_TOKENS,
          message: 'Invalid response from Pull tokens',
          module: MODULE_NAME, method: 'pullTokens',
          detailedMessages: { data: response.data }
        });
      }
      Logging.logDebug({
        tenantID: this.tenant.id,
        action: Action.OCPI_PULL_TOKENS,
        message: `${response.data.data.length} Tokens retrieved from ${tokensUrl}`,
        module: MODULE_NAME, method: 'pullTokens'
      });
      for (const token of response.data.data) {
        try {
          await OCPITokensService.updateToken(this.tenant.id, this.ocpiEndpoint, token);
          sendResult.success++;
          sendResult.logs.push(
            `Token ${token.uid} successfully updated`
          );
        } catch (error) {
          sendResult.failure++;
          sendResult.logs.push(
            `Failure updating token:${token.uid}:${error.message}`
          );
        }
      }
      const nextUrl = OCPIUtils.getNextUrl(response.headers.link);
      if (nextUrl && nextUrl.length > 0 && nextUrl !== tokensUrl) {
        tokensUrl = nextUrl;
      } else {
        nextResult = false;
      }
    }
    return sendResult;
  }

  async authorizeToken(token: OCPIToken, chargingStation: ChargingStation): Promise<string> {
    if (chargingStation.remoteAuthorizations && chargingStation.remoteAuthorizations.length > 0) {
      for (const remoteAuthorization of chargingStation.remoteAuthorizations) {
        if (remoteAuthorization.tagId === token.uid && OCPIUtils.isAuthorizationValid(remoteAuthorization.timestamp)) {
          Logging.logDebug({
            tenantID: this.tenant.id,
            action: Action.OCPI_AUTHORIZE_TOKEN,
            message: `Valid Remote Authorization found for tag ${token.uid}`,
            module: MODULE_NAME, method: 'authorizeToken',
            detailedMessages: { response: remoteAuthorization }
          });
          return remoteAuthorization.id;
        }
      }
    }
    // Get tokens endpoint url
    const tokensUrl = `${this.getEndpointUrl('tokens', Action.OCPI_AUTHORIZE_TOKEN)}/${token.uid}/authorize`;
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
        'location_id': siteID,
        'evse_uids': [OCPIUtils.buildEvseUID(chargingStation)]
      };
    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: Action.OCPI_AUTHORIZE_TOKEN,
      message: `Post authorize at ${tokensUrl}`,
      module: MODULE_NAME, method: 'authorizeToken',
      detailedMessages: { payload }
    });
    // Call IOP
    // eslint-disable-next-line no-case-declarations
    const response = await axios.post(tokensUrl, payload,
      {
        headers: {
          Authorization: `Token ${this.ocpiEndpoint.token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
    if (response.status !== 200 || !response.data) {
      throw new BackendError({
        action: Action.OCPI_AUTHORIZE_TOKEN,
        message: `Post authorize failed with status ${response.status}`,
        module: MODULE_NAME, method: 'authorizeToken',
        detailedMessages: { payload: response.data }
      });
    }
    if (!response.data.data) {
      throw new BackendError({
        action: Action.OCPI_AUTHORIZE_TOKEN,
        message: 'Invalid response from Post Authorize',
        module: MODULE_NAME, method: 'authorizeToken',
        detailedMessages: { data: response.data }
      });
    }
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: Action.OCPI_AUTHORIZE_TOKEN,
      message: `Authorization response retrieved from ${tokensUrl}`,
      module: MODULE_NAME, method: 'authorizeToken',
      detailedMessages: { response: response.data }
    });
    const authorizationInfo = response.data.data as OCPIAuthorizationInfo;
    if (authorizationInfo.allowed !== OCPIAllowed.ALLOWED) {
      throw new BackendError({
        action: Action.OCPI_AUTHORIZE_TOKEN,
        message: 'Authorization rejected',
        module: MODULE_NAME, method: 'authorizeToken',
        detailedMessages: { authorizationInfo }
      });
    }
    if (!authorizationInfo.authorization_id) {
      throw new BackendError({
        action: Action.OCPI_AUTHORIZE_TOKEN,
        message: 'Authorization allowed without \'authorization_id\'',
        module: MODULE_NAME, method: 'authorizeToken',
        detailedMessages: { authorizationInfo }
      });
    }
    return authorizationInfo.authorization_id;
  }

  async startSession(ocpiToken: OCPIToken, chargingStation: ChargingStation, transaction: Transaction, authorizationId: string) {
    // Get tokens endpoint url
    const sessionsUrl = `${this.getEndpointUrl('sessions', Action.OCPI_PUSH_SESSIONS)}/${this.getLocalCountryCode(Action.OCPI_PUSH_SESSIONS)}/${this.getLocalPartyID(Action.OCPI_PUSH_SESSIONS)}/${authorizationId}`;
    let siteID;
    if (!chargingStation.siteArea || !chargingStation.siteArea.siteID) {
      const siteArea = await SiteAreaStorage.getSiteArea(this.tenant.id, chargingStation.siteAreaID);
      siteID = siteArea ? siteArea.siteID : null;
    } else {
      siteID = chargingStation.siteArea.siteID;
    }
    const site: Site = await SiteStorage.getSite(this.tenant.id, siteID);
    const ocpiLocation: OCPILocation = OCPIMapping.convertChargingStationToOCPILocation(
      site, chargingStation, transaction.connectorId, this.getLocalCountryCode(Action.OCPI_PUSH_SESSIONS), this.getLocalPartyID(Action.OCPI_PUSH_SESSIONS));
    // Build payload
    const ocpiSession: OCPISession =
      {
        'id': authorizationId,
        'start_datetime': transaction.timestamp,
        'kwh': 0,
        'total_cost': transaction.currentCumulatedPrice,
        'auth_method': OCPIAuthMethod.AUTH_REQUEST,
        'auth_id': ocpiToken.auth_id,
        'location': ocpiLocation,
        'currency': transaction.priceUnit,
        'status': OCPISessionStatus.PENDING,
        'authorization_id': authorizationId,
        'last_updated': transaction.timestamp
      };
    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: Action.OCPI_PUSH_SESSIONS,
      message: `Start session at ${sessionsUrl}`,
      module: MODULE_NAME, method: 'startSession',
      detailedMessages: { payload: ocpiSession }
    });
    // Call IOP
    // eslint-disable-next-line no-case-declarations
    const response = await axios.put(sessionsUrl, ocpiSession,
      {
        headers: {
          'Authorization': `Token ${this.ocpiEndpoint.token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
    if (response.status !== 200 || !response.data) {
      throw new BackendError({
        action: Action.OCPI_PUSH_SESSIONS,
        message: `Start session failed with status ${response.status}`,
        module: MODULE_NAME, method: 'startSession',
        detailedMessages: { payload: response.data }
      });
    }
    transaction.ocpiSession = ocpiSession;
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: Action.OCPI_PUSH_SESSIONS,
      message: `Start session response received from ${sessionsUrl}`,
      module: MODULE_NAME, method: 'startSession',
      detailedMessages: { response: response.data }
    });
  }

  async updateSession(transaction: Transaction) {
    if (!transaction.ocpiSession) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: Action.OCPI_PUSH_SESSIONS,
        message: 'OCPI Session not started',
        module: MODULE_NAME, method: 'updateSession',
      });
    }
    // Get tokens endpoint url
    const sessionsUrl = `${this.getEndpointUrl('sessions', Action.OCPI_PUSH_SESSIONS)}/${this.getLocalCountryCode(Action.OCPI_PUSH_SESSIONS)}/${this.getLocalPartyID(Action.OCPI_PUSH_SESSIONS)}/${transaction.ocpiSession.id}`;
    transaction.ocpiSession.kwh = transaction.currentTotalConsumption / 1000;
    transaction.ocpiSession.last_updated = transaction.lastUpdate;
    transaction.ocpiSession.total_cost = transaction.currentCumulatedPrice;
    transaction.ocpiSession.currency = transaction.priceUnit;
    transaction.ocpiSession.status = OCPISessionStatus.ACTIVE;

    const patchBody: Partial<OCPISession> = {
      kwh: transaction.ocpiSession.kwh,
      last_updated: transaction.ocpiSession.last_updated,
      total_cost: transaction.ocpiSession.total_cost,
      currency: transaction.ocpiSession.currency,
      status: transaction.ocpiSession.status
    };
    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: Action.OCPI_PUSH_SESSIONS,
      message: `Patch session at ${sessionsUrl}`,
      module: MODULE_NAME, method: 'updateSession',
      detailedMessages: { payload: patchBody }
    });
    // Call IOP
    // eslint-disable-next-line no-case-declarations
    const response = await axios.patch(sessionsUrl, patchBody,
      {
        headers: {
          'Authorization': `Token ${this.ocpiEndpoint.token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
    if (response.status !== 200 || !response.data) {
      throw new BackendError({
        action: Action.OCPI_PUSH_SESSIONS,
        message: `Patch Session failed with status ${response.status}`,
        module: MODULE_NAME, method: 'updateSession',
        detailedMessages: { payload: response.data }
      });
    }
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: Action.OCPI_PUSH_SESSIONS,
      message: `Patch session response received from ${sessionsUrl}`,
      module: MODULE_NAME, method: 'updateSession',
      detailedMessages: { response: response.data }
    });
  }

  async stopSession(transaction: Transaction) {
    if (!transaction.ocpiSession) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: Action.OCPI_PUSH_SESSIONS,
        message: 'OCPI Session not started',
        module: MODULE_NAME, method: 'stopSession',
      });
    }
    if (!transaction.stop) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: Action.OCPI_PUSH_SESSIONS,
        message: 'Transaction not stopped',
        module: MODULE_NAME, method: 'stopSession',
      });
    }
    // Get tokens endpoint url
    const tokensUrl = `${this.getEndpointUrl('sessions', Action.OCPI_PUSH_SESSIONS)}/${this.getLocalCountryCode(Action.OCPI_PUSH_SESSIONS)}/${this.getLocalPartyID(Action.OCPI_PUSH_SESSIONS)}/${transaction.ocpiSession.id}`;
    transaction.ocpiSession.kwh = transaction.stop.totalConsumption / 1000;
    transaction.ocpiSession.total_cost = transaction.stop.roundedPrice;
    transaction.ocpiSession.end_datetime = transaction.stop.timestamp;
    transaction.ocpiSession.last_updated = transaction.stop.timestamp;
    transaction.ocpiSession.status = OCPISessionStatus.COMPLETED;
    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: Action.OCPI_PUSH_SESSIONS,
      message: `Stop session at ${tokensUrl}`,
      module: MODULE_NAME, method: 'stopSession',
      detailedMessages: { payload: transaction.ocpiSession }
    });
    // Call IOP
    // eslint-disable-next-line no-case-declarations
    const response = await axios.put(tokensUrl, transaction.ocpiSession,
      {
        headers: {
          'Authorization': `Token ${this.ocpiEndpoint.token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
    if (response.status !== 200 || !response.data) {
      throw new BackendError({
        action: Action.OCPI_PUSH_SESSIONS,
        message: `Stop Session failed with status ${response.status}`,
        module: MODULE_NAME, method: 'stopSession',
        detailedMessages: { payload: response.data }
      });
    }
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: Action.OCPI_PUSH_SESSIONS,
      message: `Push session response retrieved from ${tokensUrl}`,
      module: MODULE_NAME, method: 'stopSession',
      detailedMessages: { response: response.data }
    });
  }

  async postCdr(transaction: Transaction) {
    if (!transaction.ocpiSession) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: Action.OCPI_PUSH_CDRS,
        message: 'Session not started',
        module: MODULE_NAME, method: 'postCdr',
      });
    }
    if (!transaction.stop) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: Action.OCPI_PUSH_CDRS,
        message: 'Transaction not stopped',
        module: MODULE_NAME, method: 'postCdr',
      });
    }
    // Get tokens endpoint url
    const cdrsUrl = `${this.getEndpointUrl('cdrs', Action.OCPI_PUSH_CDRS)}`;
    transaction.ocpiCdr = {
      id: transaction.ocpiSession.id,
      start_date_time: transaction.timestamp,
      stop_date_time: transaction.stop.timestamp,
      total_parking_time: transaction.stop.totalInactivitySecs,
      total_time: transaction.stop.totalDurationSecs,
      total_energy: transaction.stop.totalConsumption / 1000,
      total_cost: transaction.stop.roundedPrice,
      currency: transaction.priceUnit,
      auth_id: transaction.ocpiSession.auth_id,
      authorization_id: transaction.ocpiSession.authorization_id,
      auth_method: transaction.ocpiSession.auth_method,
      location: transaction.ocpiSession.location,
      charging_periods: [
        {
          start_date_time: transaction.timestamp,
          dimensions: [
            {
              type: CdrDimensionType.ENERGY,
              volume: transaction.stop.totalConsumption / 1000
            }
          ]
        }
      ],
      last_updated: transaction.stop.timestamp
    };
    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: Action.OCPI_PUSH_CDRS,
      message: `Post cdr at ${cdrsUrl}`,
      module: MODULE_NAME, method: 'stopSession',
      detailedMessages: { payload: transaction.ocpiCdr }
    });
    // Call IOP
    // eslint-disable-next-line no-case-declarations
    const response = await axios.post(cdrsUrl, transaction.ocpiCdr,
      {
        headers: {
          Authorization: `Token ${this.ocpiEndpoint.token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
    if (response.status !== 200 || !response.data) {
      throw new BackendError({
        action: Action.OCPI_PUSH_CDRS,
        message: `Post cdr failed with status ${response.status}`,
        module: MODULE_NAME, method: 'postCdr',
        detailedMessages: { payload: response.data }
      });
    }
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: Action.OCPI_PUSH_CDRS,
      message: `Push cdr response retrieved from ${cdrsUrl}`,
      module: MODULE_NAME, method: 'postCdr',
      detailedMessages: { response: response.data }
    });
  }

  async patchChargingStationStatus(chargingStation: ChargingStation, connector: Connector) {
    if (!chargingStation.siteAreaID && !chargingStation.siteArea) {
      throw new BackendError({
        source: chargingStation.id,
        action: Action.OCPI_PATCH_STATUS,
        message: 'Charging Station must be associated to a site area',
        module: MODULE_NAME, method: 'patchChargingStationStatus',
      });
    }
    if (!chargingStation.issuer) {
      throw new BackendError({
        source: chargingStation.id,
        action: Action.OCPI_PATCH_STATUS,
        message: 'Only charging Station issued locally can be exposed to IOP',
        module: MODULE_NAME, method: 'patchChargingStationStatus',
      });
    }
    if (chargingStation.private) {
      throw new BackendError({
        source: chargingStation.id,
        action: Action.OCPI_PATCH_STATUS,
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
    await this.patchEVSEStatus(siteID, OCPIUtils.buildEvseUID(chargingStation, connector), OCPIMapping.convertStatus2OCPIStatus(connector.status));
  }

  /**
   * PATH EVSE Status
   */
  async patchEVSEStatus(locationId: string, evseUID: string, newStatus: OCPIEvseStatus) {
    // Check for input parameter
    if (!locationId || !evseUID || !newStatus) {
      throw new BackendError({
        action: Action.OCPI_PATCH_STATUS,
        message: 'Invalid parameters',
        module: MODULE_NAME, method: 'patchEVSEStatus',
      });
    }
    // Get locations endpoint url
    const locationsUrl = this.getEndpointUrl('locations', Action.OCPI_PATCH_STATUS);
    // Read configuration to retrieve
    const countryCode = this.getLocalCountryCode(Action.OCPI_PATCH_STATUS);
    const partyID = this.getLocalPartyID(Action.OCPI_PATCH_STATUS);
    // Build url to EVSE
    const fullUrl = locationsUrl + `/${countryCode}/${partyID}/${locationId}/${evseUID}`;
    // Build payload
    const payload = { 'status': newStatus };
    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: Action.OCPI_PATCH_STATUS,
      message: `Patch evse status at ${fullUrl}`,
      module: MODULE_NAME, method: 'patchEVSEStatus',
      detailedMessages: { payload }
    });
    // Call IOP
    const response = await axios.patch(fullUrl, payload,
      {
        headers: {
          Authorization: `Token ${this.ocpiEndpoint.token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
    // Check response
    if (!response.data) {
      throw new BackendError({
        action: Action.OCPI_PATCH_STATUS,
        message: `Patch EVSE Status failed with status ${response.status}`,
        module: MODULE_NAME, method: 'patchEVSEStatus',
      });
    }
  }

  /**
   * Send all EVSEs
   */
  async sendEVSEStatuses(processAllEVSEs = true) {
    // Result
    const sendResult = {
      success: 0,
      failure: 0,
      total: 0,
      logs: [],
      chargeBoxIDsInFailure: [],
      chargeBoxIDsInSuccess: []
    };
    // Define get option
    const options = {
      'addChargeBoxID': true,
      countryID: this.getLocalCountryCode(Action.OCPI_PATCH_STATUS),
      partyID: this.getLocalPartyID(Action.OCPI_PATCH_STATUS)
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
    // Get all EVSES from all locations
    const locationsResult = await OCPIMapping.getAllLocations(this.tenant, 0, 0, options);
    // Loop through locations
    for (const location of locationsResult.locations) {
      if (location && location.evses) {
        // Loop through EVSE
        for (const evse of location.evses) {
          // Total amount of EVSEs
          sendResult.total++;
          // Check if EVSE should be processed
          if (!processAllEVSEs && !chargeBoxIDsToProcess.includes(evse.chargeBoxId)) {
            continue;
          }
          // Process it if not empty
          if (evse && location.id && evse.uid) {
            try {
              await this.patchEVSEStatus(location.id, evse.uid, evse.status);
              sendResult.success++;
              sendResult.chargeBoxIDsInSuccess.push(evse.chargeBoxId);
              sendResult.logs.push(
                `Updated successfully status for locationID:${location.id} - evseID:${evse.evse_id}`
              );
            } catch (error) {
              sendResult.failure++;
              sendResult.chargeBoxIDsInFailure.push(evse.chargeBoxId);
              sendResult.logs.push(
                `Failure updating status for locationID:${location.id} - evseID:${evse.evse_id}:${error.message}`
              );
            }
            if (sendResult.failure > 0) {
              // Send notification to admins
              NotificationHandler.sendOCPIPatchChargingStationsStatusesError(
                this.tenant.id,
                {
                  'location': location.name,
                  'evseDashboardURL': Utils.buildEvseURL((await TenantStorage.getTenant(this.tenant.id)).subdomain),
                }
              );
            }
          }
        }
      }
    }
    // Log error if any
    if (sendResult.failure > 0) {
      // Log error if failure
      Logging.logError({
        tenantID: this.tenant.id,
        action: Action.OCPI_PATCH_STATUS,
        message: `Patching of ${sendResult.logs.length} EVSE statuses has been done with errors (see details)`,
        detailedMessages: { logs: sendResult.logs },
        module: MODULE_NAME, method: 'sendEVSEStatuses'
      });
    } else if (sendResult.success > 0) {
      // Log info
      Logging.logInfo({
        tenantID: this.tenant.id,
        action: Action.OCPI_PATCH_STATUS,
        message: `Patching of ${sendResult.logs.length} EVSE statuses has been done successfully (see details)`,
        detailedMessages: { logs: sendResult.logs },
        module: MODULE_NAME, method: 'sendEVSEStatuses'
      });
    }
    // Save result in ocpi endpoint
    this.ocpiEndpoint.lastPatchJobOn = startDate;
    // Set result
    if (sendResult) {
      this.ocpiEndpoint.lastPatchJobResult = {
        'successNbr': sendResult.success,
        'failureNbr': sendResult.failure,
        'totalNbr': sendResult.total,
        'chargeBoxIDsInFailure': _.uniq(sendResult.chargeBoxIDsInFailure),
        'chargeBoxIDsInSuccess': _.uniq(sendResult.chargeBoxIDsInSuccess)
      };
    } else {
      this.ocpiEndpoint.lastPatchJobResult = {
        'successNbr': 0,
        'failureNbr': 0,
        'totalNbr': 0,
        'chargeBoxIDsInFailure': [],
        'chargeBoxIDsInSuccess': []
      };
    }
    // Save
    await OCPIEndpointStorage.saveOcpiEndpoint(this.tenant.id, this.ocpiEndpoint);
    // Return result
    return sendResult;
  }

  // Get ChargeBoxIDs in failure from previous job
  getChargeBoxIDsInFailure() {
    if (this.ocpiEndpoint.lastPatchJobResult && this.ocpiEndpoint.lastPatchJobResult.chargeBoxIDsInFailure) {
      return this.ocpiEndpoint.lastPatchJobResult.chargeBoxIDsInFailure;
    }
    return [];
  }

  // Get ChargeBoxIds with new status notifications
  async getChargeBoxIDsWithNewStatusNotifications() {
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

  async triggerJobs(): Promise<any> {
    return {
      tokens: await this.pullTokens(false),
      locations: await this.sendEVSEStatuses()
    };
  }
}
