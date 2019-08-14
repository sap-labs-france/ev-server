import axios from 'axios';
import _ from 'lodash';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import OCPIEndpoint from '../../entity/OCPIEndpoint';
import OCPIMapping from '../../server/ocpi/ocpi-services-impl/ocpi-2.1.1/OCPIMapping';
import OCPPStorage from '../../storage/mongodb/OCPPStorage';
import Setting from '../../types/Setting';
import SettingStorage from '../../storage/mongodb/SettingStorage';

export default class OCPIClient {
  private ocpiEndpoint: OCPIEndpoint;

  constructor(ocpiEndpoint: any) {
    this.ocpiEndpoint = ocpiEndpoint;
  }

  // Ping eMSP
  async ping() {
    const pingResult: any = {};
    // Try to access base Url (GET .../versions)
    // Access versions API
    try {
      // Get versions
      const endpoints = await this.getVersions();

      // Check response
      if (!endpoints.data || !(endpoints.data.status_code === 1000) || !endpoints.data.data) {
        pingResult.statusCode = 412;
        pingResult.statusText = `Invalid response from GET ${this.ocpiEndpoint.getBaseUrl()}`;
      } else {
        pingResult.statusCode = endpoints.status;
        pingResult.statusText = endpoints.statusText;
      }
    } catch (error) {
      pingResult.message = error.message;
      pingResult.statusCode = (error.response) ? error.response.status : Constants.HTTP_GENERAL_ERROR;
    }

    // Return result
    return pingResult;
  }

  // Trigger Registration process for  eMSP
  async register() {
    const registerResult: any = {};

    try {
      // Get available version.
      const ocpiVersions = await this.getVersions();

      // Loop through versions and pick the same one
      let versionFound = false;
      for (const ocpiVersion of ocpiVersions.data.data) {
        if (ocpiVersion.version === '2.1.1') {
          versionFound = true;
          this.ocpiEndpoint.setVersion(ocpiVersion.version);
          this.ocpiEndpoint.setVersionUrl(ocpiVersion.url);
          break;
        }
      }

      // If not found trigger exception
      if (!versionFound) {
        throw new Error('OCPI Endpoint version 2.1.1 not found');
      }

      // Try to read services
      const services = await this.getServices();

      // Set available endpoints
      this.ocpiEndpoint.setAvailableEndpoints(OCPIMapping.convertEndpoints(services.data.data));

      // Post credentials and recieve response
      const respPostCredentials = await this.postCredentials();
      const credential = respPostCredentials.data.data;

      // Store information
      // pragma this.ocpiEndpoint.setBaseUrl(credential.url);
      this.ocpiEndpoint.setToken(credential.token);
      this.ocpiEndpoint.setCountryCode(credential.country_code);
      this.ocpiEndpoint.setPartyId(credential.party_id);
      this.ocpiEndpoint.setBusinessDetails(credential.business_details);

      // Save endpoint
      this.ocpiEndpoint.setStatus(Constants.OCPI_REGISTERING_STATUS.OCPI_REGISTERED);
      await this.ocpiEndpoint.save();

      // Send success
      registerResult.statusCode = 200;
      registerResult.statusText = 'OK';
    } catch (error) {
      registerResult.message = error.message;
      registerResult.statusCode = (error.response) ? error.response.status : Constants.HTTP_GENERAL_ERROR;
    }

    // Return result
    return registerResult;
  }

  /**
   * GET /ocpi/emsp/versions
   */
  async getVersions() {

    const respOcpiVersions = await axios.get(this.ocpiEndpoint.getBaseUrl(), {
      headers: {
        'Authorization': `Token ${this.ocpiEndpoint.getToken()}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    // Check response
    if (!respOcpiVersions.data || !respOcpiVersions.data.data) {
      throw new Error(`Invalid response from GET ${this.ocpiEndpoint.getBaseUrl()}`);
    }

    return respOcpiVersions;
  }

  /**
   * GET /ocpi/emsp/{version}
   */
  async getServices() {
    // Log
    Logging.logInfo({
      tenantID: this.ocpiEndpoint.getTenantID(),
      action: 'OCPIGetVersions',
      message: `Get OCPI versions at ${this.ocpiEndpoint.getVersionUrl()}`,
      source: 'OCPI Client',
      module: 'OCPIClient',
      method: 'getServices'
    });

    const respOcpiServices = await axios.get(this.ocpiEndpoint.getVersionUrl(), {
      headers: {
        'Authorization': `Token ${this.ocpiEndpoint.getToken()}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    // Check response
    if (!respOcpiServices.data || !respOcpiServices.data.data) {
      throw new Error(`Invalid response from GET ${this.ocpiEndpoint.getVersionUrl()}`);
    }

    return respOcpiServices;
  }

  /**
   * POST /ocpi/emsp/{version}/credentials
   */
  async postCredentials() {
    // Get credentials url
    const credentialsUrl = this.ocpiEndpoint.getEndpointUrl('credentials');

    if (!credentialsUrl) {
      throw new Error('Credentials url not available');
    }

    // Build CPO credential object
    const tenant = await this.ocpiEndpoint.getTenant();
    const cpoCredentials = await OCPIMapping.buildOCPICredentialObject(tenant, await this.ocpiEndpoint.generateLocalToken());

    // Log
    Logging.logInfo({
      tenantID: tenant.id,
      action: 'OCPIPostCredentials',
      message: `Post credentials at ${credentialsUrl}`,
      source: 'OCPI Client',
      module: 'OCPIClient',
      method: 'postCredentials',
      detailedMessages: cpoCredentials
    });

    // Call eMSP with CPO credentials
    const respOcpiCredentials = await axios.post(credentialsUrl, cpoCredentials,
      {
        headers: {
          Authorization: `Token ${this.ocpiEndpoint.getToken()}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

    // Check response
    if (!respOcpiCredentials.data || !respOcpiCredentials.data.data) {
      throw new Error('Invalid response from POST');
    }

    return respOcpiCredentials;
  }

  /**
   * PATH EVSE Status
   */
  async patchEVSEStatus(locationId: any, evseId: any, newStatus: any) {
    // Check for input parameter
    if (!locationId || !evseId || !newStatus) {
      throw new Error('Invalid parameters');
    }

    // Get locations endpoint url
    const locationsUrl = this.ocpiEndpoint.getEndpointUrl('locations');

    if (!locationsUrl) {
      throw new Error('Locations endpoint URL undefined');
    }

    // Read configuration to retrieve
    const ocpiSetting: Setting = await SettingStorage.getSettingByIdentifier(
      this.ocpiEndpoint.getTenantID(), Constants.COMPONENTS.OCPI);

    if (!ocpiSetting || !ocpiSetting.content) {
      throw new Error('OCPI Settings not found');
    }

    const ocpiContent = ocpiSetting.content.ocpi;
    if (!ocpiContent.countryCode || !ocpiContent.partyID) {
      throw new Error('OCPI Country Code and/or Party ID undefined');
    }

    const countryCode = ocpiContent.countryCode;
    const partyID = ocpiContent.partyID;

    // Build url to EVSE
    const fullUrl = locationsUrl + `/${countryCode}/${partyID}/${locationId}/${evseId}`;

    // Build payload
    const payload = { 'status': newStatus };

    // Log
    Logging.logDebug({
      tenantID: this.ocpiEndpoint.getTenantID(),
      action: 'OCPIPatchLocations',
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
          Authorization: `Token ${this.ocpiEndpoint.getToken()}`,
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

    // Read configuration to retrieve
    const tenant = await this.ocpiEndpoint.getTenant();
    // Get ocpi service configuration
    const ocpiSetting = await SettingStorage.getSettingByIdentifier(this.ocpiEndpoint.getTenantID(), Constants.COMPONENTS.OCPI);
    // Define eMI3
    tenant['_eMI3'] = {};

    if (ocpiSetting && ocpiSetting.content) {
      const configuration = ocpiSetting.content.ocpi;
      tenant['_eMI3'].country_id = configuration.countryCode;
      tenant['_eMI3'].party_id = configuration.partyID;
    } else {
      // Log error if failure
      Logging.logError({
        tenantID: tenant.id,
        action: 'OCPISendEVSEStatuses',
        message: 'OCPI Configuration not active',
        source: 'OCPI Client',
        module: 'OCPIClient',
        method: 'sendEVSEStatuses'
      });
      return;
    }

    // Define get option
    const options = { 'addChargeBoxID': true };

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
      chargeBoxIDsToProcess.push(...await this.getChargeBoxIDsWithNewStatusNotifications(tenant));

      // Remove duplicates
      chargeBoxIDsToProcess = _.uniq(chargeBoxIDsToProcess);
    }

    // Get all EVSES from all locations
    const locationsResult = await OCPIMapping.getAllLocations(tenant, 0, 0, options);

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
          if (evse && location.id && evse.id) {
            try {
              await this.patchEVSEStatus(location.id, evse.uid, evse.status);
              sendResult.success++;
              sendResult.chargeBoxIDsInSuccess.push(evse.chargeBoxId);
              sendResult.logs.push(
                `Updated successfully status for locationID:${location.id} - evseID:${evse.id}`
              );
            } catch (error) {
              sendResult.failure++;
              sendResult.chargeBoxIDsInFailure.push(evse.chargeBoxId);
              sendResult.logs.push(
                `Failure updating status for locationID:${location.id} - evseID:${evse.id}:${error.message}`
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
        tenantID: tenant.id,
        action: 'OCPISendEVSEStatuses',
        message: `Patching of ${sendResult.logs.length} EVSE statuses has been done with errors (see details)`,
        detailedMessages: sendResult.logs,
        source: 'OCPI Client',
        module: 'OCPIClient',
        method: 'sendEVSEStatuses'
      });
    } else if (sendResult.success > 0) {
      // Log info
      Logging.logInfo({
        tenantID: tenant.id,
        action: 'OCPISendEVSEStatuses',
        message: `Patching of ${sendResult.logs.length} EVSE statuses has been done successfully (see details)`,
        detailedMessages: sendResult.logs,
        source: 'OCPI Client',
        module: 'OCPIClient',
        method: 'sendEVSEStatuses'
      });
    }

    // Save result in ocpi endpoint
    this.ocpiEndpoint.setLastPatchJobOn(startDate);

    // Set result
    if (sendResult) {
      this.ocpiEndpoint.setLastPatchJobResult(sendResult.success, sendResult.failure, sendResult.total,
        _.uniq(sendResult.chargeBoxIDsInFailure), _.uniq(sendResult.chargeBoxIDsInSuccess));
    } else {
      this.ocpiEndpoint.setLastPatchJobResult(0, 0, 0);
    }

    // Save
    await this.ocpiEndpoint.save();

    // Return result
    return sendResult;
  }

  // Get ChargeBoxIDs in failure from previous job
  getChargeBoxIDsInFailure() {
    if (this.ocpiEndpoint.getLastPatchJobResult() && this.ocpiEndpoint.getLastPatchJobResult().chargeBoxIDsInFailure) {
      return this.ocpiEndpoint.getLastPatchJobResult().chargeBoxIDsInFailure;
    }
    return [];
  }

  // Get ChargeBoxIds with new status notifications
  async getChargeBoxIDsWithNewStatusNotifications(tenant) {
    // Get last job
    const lastPatchJobOn = this.ocpiEndpoint.getLastPatchJobOn() ? this.ocpiEndpoint.getLastPatchJobOn() : new Date();

    // Build params
    const params = { 'dateFrom': lastPatchJobOn };

    // Get last status notifications
    const statusNotificationsResult = await OCPPStorage.getStatusNotifications(tenant.id, params, Constants.DB_PARAMS_MAX_LIMIT);

    // Loop through notifications
    if (statusNotificationsResult.count > 0) {
      return statusNotificationsResult.result.map((statusNotification) => statusNotification.chargeBoxID);
    }
    return [];
  }

}
