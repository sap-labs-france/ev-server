import { AxiosInstance, AxiosResponse } from 'axios';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';

import AxiosFactory from '../../utils/AxiosFactory';
import BackendError from '../../exception/BackendError';
import Configuration from '../../utils/Configuration';
import { HTTPError } from '../../types/HTTPError';
import Logging from '../../utils/Logging';
import OCPICredential from '../../types/ocpi/OCPICredential';
import OCPIEndpoint from '../../types/ocpi/OCPIEndpoint';
import OCPIEndpointStorage from '../../storage/mongodb/OCPIEndpointStorage';
import OCPIMapping from '../../server/ocpi/ocpi-services-impl/ocpi-2.1.1/OCPIMapping';
import { OCPIRegistrationStatus } from '../../types/ocpi/OCPIRegistrationStatus';
import { OCPIRole } from '../../types/ocpi/OCPIRole';
import OCPIUtils from '../../server/ocpi/OCPIUtils';
import { OcpiSetting } from '../../types/Setting';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';

const MODULE_NAME = 'OCPIClient';

export default abstract class OCPIClient {
  protected axiosInstance: AxiosInstance;
  protected ocpiEndpoint: OCPIEndpoint;
  protected tenant: Tenant;
  protected role: string;
  protected settings: OcpiSetting;

  protected constructor(tenant: Tenant, settings: OcpiSetting, ocpiEndpoint: OCPIEndpoint, role: string) {
    if (role !== OCPIRole.CPO && role !== OCPIRole.EMSP) {
      throw new BackendError({
        message: `Invalid OCPI role '${role}'`,
        module: MODULE_NAME, method: 'constructor',
      });
    }
    this.axiosInstance = AxiosFactory.getAxiosInstance(tenant.id);
    this.tenant = tenant;
    this.settings = settings;
    this.ocpiEndpoint = ocpiEndpoint;
    this.role = role.toLowerCase();
  }

  async ping(): Promise<any> {
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
      pingResult.statusCode = (error.response) ? error.response.status : HTTPError.GENERAL_ERROR;
    }
    // Return result
    return pingResult;
  }

  async unregister(): Promise<any> {
    const unregisterResult: any = {};
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
        throw new BackendError({
          action: ServerAction.OCPI_PUSH_TOKENS,
          message: 'OCPI Endpoint version 2.1.1 not found',
          module: MODULE_NAME, method: 'constructor',
        });
      }
      // Delete credentials
      await this.deleteCredentials();
      // Save endpoint
      this.ocpiEndpoint.status = OCPIRegistrationStatus.UNREGISTERED;
      await OCPIEndpointStorage.saveOcpiEndpoint(this.tenant.id, this.ocpiEndpoint);
      // Send success
      unregisterResult.statusCode = StatusCodes.OK;
      unregisterResult.statusText = ReasonPhrases.OK;
    } catch (error) {
      unregisterResult.message = error.message;
      unregisterResult.statusCode = (error.response) ? error.response.status : HTTPError.GENERAL_ERROR;
    }
    // Return result
    return unregisterResult;
  }

  async register(): Promise<any> {
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
        throw new BackendError({
          action: ServerAction.OCPI_REGISTER,
          message: 'OCPI Endpoint version 2.1.1 not found',
          module: MODULE_NAME, method: 'register',
        });
      }
      // Try to read services
      const services = await this.getServices();
      // Set available endpoints
      this.ocpiEndpoint.availableEndpoints = OCPIMapping.convertEndpoints(services.data.data);
      this.ocpiEndpoint.localToken = OCPIUtils.generateLocalToken(this.tenant.subdomain);
      // Post credentials and receive response
      const respPostCredentials = await this.postCredentials();
      const credential = respPostCredentials.data;
      // Store information
      // pragma this.ocpiEndpoint.setBaseUrl(credential.url);
      this.ocpiEndpoint.token = credential.token;
      this.ocpiEndpoint.countryCode = credential.country_code;
      this.ocpiEndpoint.partyId = credential.party_id;
      this.ocpiEndpoint.businessDetails = credential.business_details;
      // Save endpoint
      this.ocpiEndpoint.status = OCPIRegistrationStatus.REGISTERED;
      await OCPIEndpointStorage.saveOcpiEndpoint(this.tenant.id, this.ocpiEndpoint);
      // Send success
      registerResult.statusCode = StatusCodes.OK;
      registerResult.statusText = ReasonPhrases.OK;
    } catch (error) {
      registerResult.message = error.message;
      registerResult.statusCode = (error.response) ? error.response.status : HTTPError.GENERAL_ERROR;
    }
    // Return result
    return registerResult;
  }

  async getVersions(): Promise<any> {
    Logging.logInfo({
      tenantID: this.tenant.id,
      action: ServerAction.OCPI_GET_VERSIONS,
      message: `Get OCPI Versions at ${this.ocpiEndpoint.baseUrl}`,
      module: MODULE_NAME, method: 'getServices'
    });
    const response = await this.axiosInstance.get(this.ocpiEndpoint.baseUrl, {
      headers: {
        'Authorization': `Token ${this.ocpiEndpoint.token}`
      },
    });
    return response;
  }

  /**
   * GET /ocpi/{role}/{version}
   */
  async getServices(): Promise<any> {
    // Log
    Logging.logInfo({
      tenantID: this.tenant.id,
      action: ServerAction.OCPI_GET_VERSIONS,
      message: `Get OCPI Services at ${this.ocpiEndpoint.versionUrl}`,
      module: MODULE_NAME, method: 'getServices'
    });
    const response = await this.axiosInstance.get(this.ocpiEndpoint.versionUrl, {
      headers: {
        'Authorization': `Token ${this.ocpiEndpoint.token}`
      },
    });
    return response;
  }

  async deleteCredentials(): Promise<AxiosResponse<OCPICredential>> {
    // Get credentials url
    const credentialsUrl = this.getEndpointUrl('credentials', ServerAction.OCPI_POST_CREDENTIALS);
    // Log
    Logging.logInfo({
      tenantID: this.tenant.id,
      action: ServerAction.OCPI_POST_CREDENTIALS,
      message: `Delete Credentials at ${credentialsUrl}`,
      module: MODULE_NAME, method: 'postCredentials'
    });
    // Call eMSP with CPO credentials
    const response = await this.axiosInstance.delete<OCPICredential>(credentialsUrl,
      {
        headers: {
          Authorization: `Token ${this.ocpiEndpoint.token}`,
          'Content-Type': 'application/json'
        },
      });
    return response;
  }

  /**
   * POST /ocpi/{role}/{version}/credentials
   */
  async postCredentials(): Promise<AxiosResponse<OCPICredential>> {
    // Get credentials url
    const credentialsUrl = this.getEndpointUrl('credentials', ServerAction.OCPI_POST_CREDENTIALS);
    const credentials = await OCPIMapping.buildOCPICredentialObject(this.tenant.id, this.ocpiEndpoint.localToken, this.ocpiEndpoint.role);
    // Log
    Logging.logInfo({
      tenantID: this.tenant.id,
      action: ServerAction.OCPI_POST_CREDENTIALS,
      message: `Post Credentials at ${credentialsUrl}`,
      module: MODULE_NAME, method: 'postCredentials',
      detailedMessages: { credentials }
    });
    // Call eMSP with CPO credentials
    const response = await this.axiosInstance.post<OCPICredential>(credentialsUrl, credentials,
      {
        headers: {
          Authorization: `Token ${this.ocpiEndpoint.token}`,
          'Content-Type': 'application/json'
        },
      });
    return response;
  }

  getLocalCountryCode(action: ServerAction): string {
    if (!this.settings[this.role]) {
      throw new BackendError({
        action, message: `OCPI Settings are missing for role ${this.role}`,
        module: MODULE_NAME, method: 'getLocalCountryCode',
      });
    }
    if (!this.settings[this.role].countryCode) {
      throw new BackendError({
        action, message: `OCPI Country Code setting is missing for role ${this.role}`,
        module: MODULE_NAME, method: 'getLocalCountryCode',
      });
    }
    return this.settings[this.role].countryCode;
  }

  getLocalPartyID(action: ServerAction): string {
    if (!this.settings[this.role]) {
      throw new BackendError({
        action, message: `OCPI Settings are missing for role ${this.role}`,
        module: MODULE_NAME, method: 'getLocalPartyID',
      });
    }
    if (!this.settings[this.role].partyID) {
      throw new BackendError({
        action, message: `OCPI Party ID setting is missing for role ${this.role}`,
        module: MODULE_NAME, method: 'getLocalPartyID',
      });
    }
    return this.settings[this.role].partyID;
  }

  protected getEndpointUrl(service: string, action: ServerAction): string {
    if (this.ocpiEndpoint.availableEndpoints) {
      return this.ocpiEndpoint.availableEndpoints[service];
    }
    throw new BackendError({
      action, message: `No endpoint URL defined for service ${service}`,
      module: MODULE_NAME, method: 'getEndpointUrl',
    });
  }

  protected getLocalEndpointUrl(service: string): string {
    return `${Configuration.getOCPIEndpointConfig().baseUrl}/ocpi/${this.role}/${this.ocpiEndpoint.version}/${service}`;
  }
}
