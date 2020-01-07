import OCPIClient from './OCPIClient';
import Tenant from '../../types/Tenant';
import OCPIEndpoint from '../../types/ocpi/OCPIEndpoint';
import Constants from '../../utils/Constants';
import { OcpiSetting } from '../../types/Setting';
import Logging from '../../utils/Logging';
import axios from 'axios';
import _ from 'lodash';
import OCPIMapping from '../../server/ocpi/ocpi-services-impl/ocpi-2.1.1/OCPIMapping';
import OCPIEndpointStorage from '../../storage/mongodb/OCPIEndpointStorage';
import { OCPIToken } from '../../types/ocpi/OCPIToken';
import { OCPILocation } from '../../types/ocpi/OCPILocation';
import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import { OCPIEvseStatus } from '../../types/ocpi/OCPIEvse';

export default class EmspOCPIClient extends OCPIClient {
  constructor(tenant: Tenant, settings: OcpiSetting, ocpiEndpoint: OCPIEndpoint) {
    super(tenant, settings, ocpiEndpoint, Constants.OCPI_ROLE.EMSP);

    if (ocpiEndpoint.role !== Constants.OCPI_ROLE.EMSP) {
      throw new Error(`EmspOCPIClient requires Ocpi Endpoint with role ${Constants.OCPI_ROLE.EMSP}`);
    }
  }

  async sendTokens() {
    // Result
    const sendResult = {
      success: 0,
      failure: 0,
      total: 0,
      logs: [],
      tokenIDsInFailure: [],
      tokenIDsInSuccess: []
    };

    // Get timestamp before starting process - to be saved in DB at the end of the process
    const startDate = new Date();

    // Get all tokens
    const tokensResult = await OCPIMapping.getAllTokens(this.tenant, 0, 0);

    for (const token of tokensResult.result) {
      sendResult.total++;
      try {
        await this.pushToken(token);
        sendResult.success++;
        sendResult.tokenIDsInSuccess.push(token.uid);
        sendResult.logs.push(
          `Token ${token.uid} successfully updated`
        );
      } catch (error) {
        sendResult.failure++;
        sendResult.tokenIDsInFailure.push(token.uid);
        sendResult.logs.push(
          `Failure updating token:${token.uid}:${error.message}`
        );
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
        'tokenIDsInFailure': _.uniq(sendResult.tokenIDsInFailure),
        'tokenIDsInSuccess': _.uniq(sendResult.tokenIDsInSuccess)
      };
    } else {
      this.ocpiEndpoint.lastPatchJobResult = {
        'successNbr': 0,
        'failureNbr': 0,
        'totalNbr': 0,
        'tokenIDsInFailure': [],
        'tokenIDsInSuccess': []
      };
    }

    // Save
    await OCPIEndpointStorage.saveOcpiEndpoint(this.tenant.id, this.ocpiEndpoint);

    // Return result
    return sendResult;
  }

  async pullLocations() {
    // Get locations endpoint url
    const locationsUrl = this.getEndpointUrl('locations');

    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: 'OcpiGetLocations',
      message: `Retrieve locations at ${locationsUrl}`,
      source: 'OCPI Client',
      module: 'OCPIClient',
      method: 'patchEVSEStatus'
    });

    // Call IOP
    const response = await axios.get(locationsUrl,
      {
        headers: {
          Authorization: `Token ${this.ocpiEndpoint.token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

    // Check response
    if (response.status !== 200 || !response.data) {
      throw new Error(`Invalid response code ${response.status} from Get locations`);
    }
    if (!response.data.data) {
      throw new Error(`Invalid response from Get locations: ${JSON.stringify(response.data)}`);
    }

    for (const location of response.data.data) {
      await this.processLocation(location);
    }
  }

  async processLocation(location: OCPILocation) {
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: 'OcpiGetLocations',
      message: `Found location ${location.name} with id ${location.id}`,
      source: 'OCPI Client',
      module: 'OCPIClient',
      method: 'processLocation',
      detailedMessage: location
    });
    if (location.evses && location.evses.length > 0) {
      for (const evse of location.evses) {
        if (!evse.evse_id) {
          Logging.logDebug({
            tenantID: this.tenant.id,
            action: 'OcpiGetLocations',
            message: `Missing evse id of location ${location.name}`,
            source: 'OCPI Client',
            module: 'OCPIClient',
            method: 'processLocation',
            detailedMessage: location
          });
        } else if (evse.status === OCPIEvseStatus.REMOVED) {
          Logging.logDebug({
            tenantID: this.tenant.id,
            action: 'OcpiGetLocations',
            message: `Delete removed evse ${evse.evse_id} of location ${location.name}`,
            source: 'OCPI Client',
            module: 'OCPIClient',
            method: 'processLocation',
            detailedMessage: location
          });
          await ChargingStationStorage.deleteChargingStation(this.tenant.id, evse.evse_id);
        } else {
          Logging.logDebug({
            tenantID: this.tenant.id,
            action: 'OcpiGetLocations',
            message: `Update evse ${evse.evse_id} of location ${location.name}`,
            source: 'OCPI Client',
            module: 'OCPIClient',
            method: 'processLocation',
            detailedMessage: location
          });
          const chargingStation = OCPIMapping.convertEvseToChargingStation(evse, location);
          await ChargingStationStorage.saveChargingStation(this.tenant.id, chargingStation);
        }
      }
    }
  }

  async pushToken(token: OCPIToken) {
    // Get tokens endpoint url
    const tokensUrl = this.getEndpointUrl('tokens');

    // Read configuration to retrieve
    const countryCode = this.getLocalCountryCode();
    const partyID = this.getLocalPartyID();

    // Build url to IOP
    const fullUrl = tokensUrl + `/${countryCode}/${partyID}/${token.uid}`;

    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: 'OcpiPushTokens',
      message: `Put token at ${fullUrl}`,
      source: 'OCPI Client',
      module: 'OCPIClient',
      method: 'pushToken',
      detailedMessages: token
    });

    // Call IOP
    const response = await axios.put(fullUrl, token,
      {
        headers: {
          Authorization: `Token ${this.ocpiEndpoint.token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

    // Check response
    if (!response.data) {
      throw new Error(`Invalid response from put token ${JSON.stringify(response)}`);
    }
  }

  async pullSessions() {

  }

  async pullCdrs() {

  }

  async remoteStartSession() {

  }

  async remoteStopSession() {

  }
}
