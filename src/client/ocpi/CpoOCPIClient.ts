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
import ChargingStation from '../../types/ChargingStation';
import { ChargePointStatus } from '../../types/ocpp/OCPPServer';
import SiteAreaStorage from '../../storage/mongodb/SiteAreaStorage';
import moment from 'moment';
import OCPIUtils from '../../server/ocpi/OCPIUtils';
import OCPITokensService from '../../server/ocpi/ocpi-services-impl/ocpi-2.1.1/OCPITokensService';
import { OCPIRole } from '../../types/ocpi/OCPIRole';

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
        action: 'OcpiPullTokens',
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
        action: 'OcpiPullTokens',
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

  async patchChargingStationStatus(chargingStation: ChargingStation, status: ChargePointStatus) {
    if (!chargingStation.siteAreaID && !chargingStation.siteArea) {
      throw new Error('Charging Station must be associated to a site area');
    }
    if (!chargingStation.issuer) {
      throw new Error('Only charging Station issued locally can be exposed to IOP');
    }
    let siteID;
    if (!chargingStation.siteArea || !chargingStation.siteArea.siteID) {
      const siteArea = await SiteAreaStorage.getSiteArea(this.tenant.id, chargingStation.siteAreaID);
      siteID = siteArea ? siteArea.siteID : null;
    } else {
      siteID = chargingStation.siteArea.siteID;
    }
    await this.patchEVSEStatus(siteID, chargingStation.id, OCPIMapping.convertStatus2OCPIStatus(status));
  }

  /**
   * PATH EVSE Status
   */
  async patchEVSEStatus(locationId: string, evseId: string, newStatus: any) {
    // Check for input parameter
    if (!locationId || !evseId || !newStatus) {
      throw new Error('Invalid parameters');
    }

    // Get locations endpoint url
    const locationsUrl = this.getEndpointUrl('locations');

    // Read configuration to retrieve
    const countryCode = this.getLocalCountryCode();
    const partyID = this.getLocalPartyID();

    // Build url to EVSE
    const fullUrl = locationsUrl + `/${countryCode}/${partyID}/${locationId}/${evseId}`;

    // Build payload
    const payload = { 'status': newStatus };

    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: 'OcpiPatchLocations',
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
        action: 'OcpiEndpointSendEVSEStatuses',
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
        action: 'OcpiEndpointSendEVSEStatuses',
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
