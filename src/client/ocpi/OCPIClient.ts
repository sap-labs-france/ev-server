import axios from 'axios';
import _ from 'lodash';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import OCPIMapping from '../../server/ocpi/ocpi-services-impl/ocpi-2.1.1/OCPIMapping';
import OCPPStorage from '../../storage/mongodb/OCPPStorage';
import Setting from '../../types/Setting';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import NotificationHandler from '../../notification/NotificationHandler';
import Utils from '../../utils/Utils';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import OCPIEndpoint from '../../types/OCPIEndpoint';
import OCPIEndpointStorage from '../../storage/mongodb/OCPIEndpointStorage';
import Tenant from '../../types/Tenant';
import OCPIUtils from '../../server/ocpi/OCPIUtils';

export default class OCPIClient {
  private ocpiEndpoint: OCPIEndpoint;
  private tenant: Tenant;

  constructor(tenant: Tenant, ocpiEndpoint: OCPIEndpoint) {
    this.tenant = tenant;
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
        pingResult.statusText = `Invalid response from GET ${this.ocpiEndpoint.baseUrl}`;
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
          this.ocpiEndpoint.version = ocpiVersion.version;
          this.ocpiEndpoint.versionUrl = ocpiVersion.url;
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
      this.ocpiEndpoint.availableEndpoints = OCPIMapping.convertEndpoints(services.data.data);

      // Post credentials and receive response
      const respPostCredentials = await this.postCredentials();
      const credential = respPostCredentials.data.data;

      // Store information
      // pragma this.ocpiEndpoint.setBaseUrl(credential.url);
      this.ocpiEndpoint.token = credential.token;
      this.ocpiEndpoint.countryCode = credential.country_code;
      this.ocpiEndpoint.partyId = credential.party_id;
      this.ocpiEndpoint.businessDetails = credential.business_details;

      // Save endpoint
      this.ocpiEndpoint.status = Constants.OCPI_REGISTERING_STATUS.OCPI_REGISTERED;
      await OCPIEndpointStorage.saveOcpiEndpoint(this.tenant.id, this.ocpiEndpoint);

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

    const respOcpiVersions = await axios.get(this.ocpiEndpoint.baseUrl, {
      headers: {
        'Authorization': `Token ${this.ocpiEndpoint.token}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    // Check response
    if (!respOcpiVersions.data || !respOcpiVersions.data.data) {
      throw new Error(`Invalid response from GET ${this.ocpiEndpoint.baseUrl}`);
    }

    return respOcpiVersions;
  }

  /**
   * GET /ocpi/emsp/{version}
   */
  async getServices() {
    // Log
    Logging.logInfo({
      tenantID: this.tenant.id,
      action: 'OcpiGetVersions',
      message: `Get OCPI versions at ${this.ocpiEndpoint.versionUrl}`,
      source: 'OCPI Client',
      module: 'OCPIClient',
      method: 'getServices'
    });

    const respOcpiServices = await axios.get(this.ocpiEndpoint.versionUrl, {
      headers: {
        'Authorization': `Token ${this.ocpiEndpoint.token}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    // Check response
    if (!respOcpiServices.data || !respOcpiServices.data.data) {
      throw new Error(`Invalid response from GET ${this.ocpiEndpoint.versionUrl}`);
    }

    return respOcpiServices;
  }

  /**
   * POST /ocpi/emsp/{version}/credentials
   */
  async postCredentials() {
    // Get credentials url
    const credentialsUrl = this.getEndpointUrl('credentials');

    if (!credentialsUrl) {
      throw new Error('Credentials url not available');
    }

    const cpoCredentials = await OCPIMapping.buildOCPICredentialObject(this.tenant.id, OCPIUtils.generateLocalToken(this.tenant.subdomain));

    // Log
    Logging.logInfo({
      tenantID: this.tenant.id,
      action: 'OcpiPostCredentials',
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
          Authorization: `Token ${this.ocpiEndpoint.token}`,
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
    const locationsUrl = this.getEndpointUrl('locations');

    if (!locationsUrl) {
      throw new Error('Locations endpoint URL undefined');
    }

    // Read configuration to retrieve
    const ocpiSetting: Setting = await SettingStorage.getSettingByIdentifier(
      this.tenant.id, Constants.COMPONENTS.OCPI);

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

    // Get ocpi service configuration
    const ocpiSetting = await SettingStorage.getSettingByIdentifier(this.tenant.id, Constants.COMPONENTS.OCPI);

    // Define get option
    const options = {
      'addChargeBoxID': true,
      countryID: '',
      partyID: ''
    };

    if (ocpiSetting && ocpiSetting.content) {
      const configuration = ocpiSetting.content.ocpi;
      options.countryID = configuration.countryCode;
      options.partyID = configuration.partyID;
    } else {
      // Log error if failure
      Logging.logError({
        tenantID: this.tenant.id,
        action: 'OcpiEndpointSendEVSEStatuses',
        message: 'OCPI Configuration not active',
        source: 'OCPI Client',
        module: 'OCPIClient',
        method: 'sendEVSEStatuses'
      });
      return;
    }

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
            if (sendResult.failure > 0) {
              // Send notification to admins
              NotificationHandler.sendOCPIPatchChargingStationsStatusesError(
                this.tenant.id,
                Constants.DEFAULT_LOCALE,
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

  private getEndpointUrl(service) {
    if (this.ocpiEndpoint.availableEndpoints) {
      return this.ocpiEndpoint.availableEndpoints[service];
    }
    return null;
  }

}
