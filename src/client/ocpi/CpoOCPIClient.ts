import OCPIClient from './OCPIClient';
import Tenant from '../../types/Tenant';
import OCPIEndpoint from '../../types/ocpi/OCPIEndpoint';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import axios from 'axios';
import OCPIMapping from '../../server/ocpi/ocpi-services-impl/ocpi-2.1.1/OCPIMapping';
import _ from 'lodash';
import NotificationHandler from '../../notification/NotificationHandler';
import Utils from '../../utils/Utils';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import OCPIEndpointStorage from '../../storage/mongodb/OCPIEndpointStorage';
import OCPPStorage from '../../storage/mongodb/OCPPStorage';
import { OcpiSetting } from '../../types/Setting';
import ChargingStation, { Connector } from '../../types/ChargingStation';
import SiteAreaStorage from '../../storage/mongodb/SiteAreaStorage';
import moment from 'moment';
import OCPIUtils from '../../server/ocpi/OCPIUtils';
import OCPITokensService from '../../server/ocpi/ocpi-services-impl/ocpi-2.1.1/OCPITokensService';
import { OCPIRole } from '../../types/ocpi/OCPIRole';
import { OCPIToken } from '../../types/ocpi/OCPIToken';
import { OCPILocationReference } from '../../types/ocpi/OCPILocation';
import { OCPIAllowed, OCPIAuthorizationInfo } from '../../types/ocpi/OCPIAuthorizationInfo';
import { Action } from '../../types/Authorization';
import { OCPIEvseStatus } from '../../types/ocpi/OCPIEvse';
import Transaction from '../../types/Transaction';
import { OCPIAuthMethod, OCPISession, OCPISessionStatus } from '../../types/ocpi/OCPISession';
import Tag from '../../types/Tag';

export default class CpoOCPIClient extends OCPIClient {
  constructor(tenant: Tenant, settings: OcpiSetting, ocpiEndpoint: OCPIEndpoint) {
    super(tenant, settings, ocpiEndpoint, OCPIRole.CPO);

    if (ocpiEndpoint.role !== OCPIRole.CPO) {
      throw new Error(`CpoOcpiClient requires Ocpi Endpoint with role ${OCPIRole.CPO}`);
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
    let tokensUrl = this.getEndpointUrl('tokens');
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
        source: 'OCPI Client',
        module: 'OCPIClient',
        method: 'pullTokens'
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
        throw new Error(`Invalid response code ${response.status} from Pull tokens`);
      }
      if (!response.data.data) {
        throw new Error(`Invalid response from Pull tokens: ${JSON.stringify(response.data)}`);
      }

      Logging.logDebug({
        tenantID: this.tenant.id,
        action: Action.OCPI_PULL_TOKENS,
        message: `${response.data.data.length} Tokens retrieved from ${tokensUrl}`,
        source: 'OCPI Client',
        module: 'OCPIClient',
        method: 'pullTokens'
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

  async authorizeToken(token: OCPIToken, chargingStation: ChargingStation, connector?: Connector): Promise<string> {
    // Get tokens endpoint url
    const tokensUrl = `${this.getEndpointUrl('tokens')}/${token.uid}/authorize`;

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
        'evse_uids': [OCPIUtils.buildEvseUID(chargingStation, connector)]
      };

    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: Action.OCPI_AUTHORIZE_TOKEN,
      message: `Post authorize at ${tokensUrl}`,
      source: 'OCPI Client',
      module: 'OCPIClient',
      method: 'authorizeToken',
      detailedMessages: payload
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
      throw new Error(`Invalid response code ${response.status} from Post Authorize`);
    }
    if (!response.data.data) {
      throw new Error(`Invalid response from Post Authorize: ${JSON.stringify(response.data)}`);
    }

    Logging.logDebug({
      tenantID: this.tenant.id,
      action: Action.OCPI_AUTHORIZE_TOKEN,
      message: `Authorization response retrieved from ${tokensUrl}`,
      source: 'OCPI Client',
      module: 'OCPIClient',
      method: 'authorizeToken',
      detailedMessages: response.data.data
    });

    const authorizationInfo = response.data.data as OCPIAuthorizationInfo;

    if (authorizationInfo.allowed !== OCPIAllowed.ALLOWED) {
      throw new Error(`OCPI Authorization rejected with result : ${JSON.stringify(authorizationInfo)}`);
    }
    if (!authorizationInfo.authorization_id) {
      throw new Error(`OCPI Authorization allowed without 'authorization_id' : ${JSON.stringify(authorizationInfo)}`);
    }

    return authorizationInfo.authorization_id;
  }

  async startSession(token: OCPIToken, chargingStation: ChargingStation, transaction: Transaction, tag: Tag): Promise<OCPISession> {
    // Get tokens endpoint url
    const tokensUrl = `${this.getEndpointUrl('sessions')}/${this.getLocalCountryCode()}/${this.getLocalPartyID()}/${transaction.id}`;

    // Build payload
    const payload: OCPISession =
      {
        id: transaction.id.toString(),
        'start_datetime': transaction.timestamp,
        kwh: 0,
        'total_cost': transaction.price,
        'auth_method': OCPIAuthMethod.AUTH_REQUEST,
        'auth_id': tag.ocpiToken.auth_id,
        location: null,
        currency: transaction.priceUnit,
        status: OCPISessionStatus.PENDING,
        'last_updated': transaction.timestamp
      };

    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: Action.OCPI_AUTHORIZE_TOKEN,
      message: `Post authorize at ${tokensUrl}`,
      source: 'OCPI Client',
      module: 'OCPIClient',
      method: 'authorizeToken',
      detailedMessages: payload
    });

    // Call IOP
    // eslint-disable-next-line no-case-declarations
    const response = await axios.put(tokensUrl, payload,
      {
        headers: {
          Authorization: `Token ${this.ocpiEndpoint.token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

    if (response.status !== 200 || !response.data) {
      throw new Error(`Invalid response code ${response.status} from Put Session`);
    }
    if (!response.data.data) {
      throw new Error(`Invalid response from Put Session: ${JSON.stringify(response.data)}`);
    }

    Logging.logDebug({
      tenantID: this.tenant.id,
      action: Action.OCPI_PUSH_SESSIONS,
      message: `Authorization response retrieved from ${tokensUrl}`,
      source: 'OCPI Client',
      module: 'OCPIClient',
      method: 'authorizeToken',
      detailedMessages: response.data.data
    });

    return response.data.data as OCPISession;
  }

  async patchChargingStationStatus(chargingStation: ChargingStation, connector: Connector) {
    if (!chargingStation.siteAreaID && !chargingStation.siteArea) {
      throw new Error('Charging Station must be associated to a site area');
    }
    if (!chargingStation.issuer) {
      throw new Error('Only charging Station issued locally can be exposed to IOP');
    }
    if (chargingStation.private) {
      throw new Error('Private charging Station cannot be exposed to IOP');
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
      throw new Error('Invalid parameters');
    }

    // Get locations endpoint url
    const locationsUrl = this.getEndpointUrl('locations');

    // Read configuration to retrieve
    const countryCode = this.getLocalCountryCode();
    const partyID = this.getLocalPartyID();

    // Build url to EVSE
    const fullUrl = locationsUrl + `/${countryCode}/${partyID}/${locationId}/${evseUID}`;

    // Build payload
    const payload = { 'status': newStatus };

    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: Action.OCPI_PATCH_LOCATIONS,
      message: `Patch location at ${fullUrl}`,
      source: 'OCPI Client',
      module: 'OCPIClient',
      method: 'patchEVSEStatus',
      detailedMessages: payload
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
      throw new Error('Invalid response from PATCH');
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
      countryID: this.getLocalCountryCode(),
      partyID: this.getLocalPartyID()
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
        action: Action.OCPI_PATCH_LOCATIONS,
        message: `Patching of ${sendResult.logs.length} EVSE statuses has been done with errors (see details)`,
        detailedMessages: sendResult.logs,
        source: 'OCPI Client',
        module: 'OCPIClient',
        method: 'sendEVSEStatuses'
      });
    } else if (sendResult.success > 0) {
      // Log info
      Logging.logInfo({
        tenantID: this.tenant.id,
        action: Action.OCPI_PATCH_LOCATIONS,
        message: `Patching of ${sendResult.logs.length} EVSE statuses has been done successfully (see details)`,
        detailedMessages: sendResult.logs,
        source: 'OCPI Client',
        module: 'OCPIClient',
        method: 'sendEVSEStatuses'
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
