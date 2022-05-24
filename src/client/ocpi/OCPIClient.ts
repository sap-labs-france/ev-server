import OCPIEndpoint, { OCPIEndpointVersions, OCPIPingResult, OCPIRegisterResult, OCPIUnregisterResult, OCPIVersion } from '../../types/ocpi/OCPIEndpoint';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';

import AxiosFactory from '../../utils/AxiosFactory';
import { AxiosInstance } from 'axios';
import BackendError from '../../exception/BackendError';
import Configuration from '../../utils/Configuration';
import { HTTPError } from '../../types/HTTPError';
import Logging from '../../utils/Logging';
import OCPICredential from '../../types/ocpi/OCPICredential';
import OCPIEndpointStorage from '../../storage/mongodb/OCPIEndpointStorage';
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
    this.axiosInstance = AxiosFactory.getAxiosInstance(tenant);
    this.tenant = tenant;
    this.settings = settings;
    this.ocpiEndpoint = ocpiEndpoint;
    this.role = role.toLowerCase();
  }

  public async ping(): Promise<OCPIPingResult> {
    const pingResult = {} as OCPIPingResult;
    // Try to access base Url (GET .../versions)
    // Access versions API
    try {
      // Get versions
      const response = await this.axiosInstance.get(this.ocpiEndpoint.baseUrl, {
        headers: {
          'Authorization': `Token ${this.ocpiEndpoint.token}`
        },
      });
      // Check response
      if (!response.data || !(response.data.status_code === 1000) || !response) {
        pingResult.statusCode = StatusCodes.PRECONDITION_FAILED;
        pingResult.statusText = `Invalid response from GET ${this.ocpiEndpoint.baseUrl}`;
      } else {
        pingResult.statusCode = response.status;
        pingResult.statusText = response.statusText;
      }
    } catch (error) {
      pingResult.statusText = error.message;
      pingResult.statusCode = (error.response) ? error.response.status : HTTPError.GENERAL_ERROR;
    }
    return pingResult;
  }

  public async unregister(): Promise<OCPIUnregisterResult> {
    const unregisterResult = {} as OCPIUnregisterResult;
    try {
      // Check versions
      const versionFound = await this.checkVersions();
      if (!versionFound) {
        throw new BackendError({
          action: ServerAction.OCPI_UNREGISTER,
          message: 'OCPI Endpoint version 2.1.1 not found',
          module: MODULE_NAME, method: 'constructor',
        });
      }
      // Delete credentials
      await this.deleteCredentials();
      // Save endpoint
      this.ocpiEndpoint.status = OCPIRegistrationStatus.UNREGISTERED;
      this.ocpiEndpoint.lastChangedOn = new Date();
      this.ocpiEndpoint.availableEndpoints = null;
      this.ocpiEndpoint.businessDetails = null;
      await OCPIEndpointStorage.saveOcpiEndpoint(this.tenant, this.ocpiEndpoint);
      // Send success
      unregisterResult.statusCode = StatusCodes.OK;
      unregisterResult.statusText = ReasonPhrases.OK;
    } catch (error) {
      unregisterResult.statusText = error.message;
      unregisterResult.statusCode = (error.response) ? error.response.status : HTTPError.GENERAL_ERROR;
    }
    return unregisterResult;
  }

  public async register(): Promise<OCPIRegisterResult> {
    const registerResult = {} as OCPIRegisterResult;
    try {
      // Check versions
      const versionFound = await this.checkVersions();
      if (!versionFound) {
        throw new BackendError({
          action: ServerAction.OCPI_REGISTER,
          message: 'OCPI Endpoint version 2.1.1 not found',
          module: MODULE_NAME, method: 'constructor',
        });
      }
      // Try to read services
      const endpointVersions = await this.getEndpointVersions();
      // Set available endpoints
      this.ocpiEndpoint.availableEndpoints = OCPIUtils.convertAvailableEndpoints(endpointVersions);
      // Post credentials and receive response
      const credentials = await this.postCredentials();
      // Store information
      this.ocpiEndpoint.token = credentials.token;
      this.ocpiEndpoint.countryCode = credentials.country_code;
      this.ocpiEndpoint.partyId = credentials.party_id;
      this.ocpiEndpoint.businessDetails = credentials.business_details;
      // Save endpoint
      this.ocpiEndpoint.status = OCPIRegistrationStatus.REGISTERED;
      await OCPIEndpointStorage.saveOcpiEndpoint(this.tenant, this.ocpiEndpoint);
      // Send success
      registerResult.statusCode = StatusCodes.OK;
      registerResult.statusText = ReasonPhrases.OK;
    } catch (error) {
      registerResult.statusCode = error.response ? error.response.status : HTTPError.GENERAL_ERROR;
      registerResult.statusText = error.message;
    }
    return registerResult;
  }

  public async updateCredentials(): Promise<OCPIRegisterResult> {
    const registerResult = {} as OCPIRegisterResult;
    try {
      // Check versions
      const versionFound = await this.checkVersions();
      if (!versionFound) {
        throw new BackendError({
          action: ServerAction.OCPI_REGISTER,
          message: 'OCPI Endpoint version 2.1.1 not found',
          module: MODULE_NAME, method: 'constructor',
        });
      }
      // Try to read services
      const endpointVersions = await this.getEndpointVersions();
      // Set available endpoints
      this.ocpiEndpoint.availableEndpoints = OCPIUtils.convertAvailableEndpoints(endpointVersions);
      this.ocpiEndpoint.localToken = OCPIUtils.generateLocalToken(this.tenant.subdomain);
      // Put credentials and receive response
      const credentials = await this.putCredentials();
      // Store information
      this.ocpiEndpoint.token = credentials.token;
      this.ocpiEndpoint.countryCode = credentials.country_code;
      this.ocpiEndpoint.partyId = credentials.party_id;
      this.ocpiEndpoint.businessDetails = credentials.business_details;
      // Save endpoint
      this.ocpiEndpoint.status = OCPIRegistrationStatus.REGISTERED;
      await OCPIEndpointStorage.saveOcpiEndpoint(this.tenant, this.ocpiEndpoint);
      // Send success
      registerResult.statusCode = StatusCodes.OK;
      registerResult.statusText = ReasonPhrases.OK;
    } catch (error) {
      registerResult.statusCode = error.response ? error.response.status : HTTPError.GENERAL_ERROR;
      registerResult.statusText = error.message;
    }
    return registerResult;
  }

  public async getVersions(): Promise<OCPIVersion[]> {
    await Logging.logInfo({
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
    return response.data?.data;
  }

  public getSettings(): OcpiSetting {
    return this.settings;
  }

  public async getEndpointVersions(): Promise<OCPIEndpointVersions> {
    await Logging.logInfo({
      tenantID: this.tenant.id,
      action: ServerAction.OCPI_GET_ENDPOINT_VERSIONS,
      message: `Get OCPI Services at ${this.ocpiEndpoint.versionUrl}`,
      module: MODULE_NAME, method: 'getServices'
    });
    const response = await this.axiosInstance.get(this.ocpiEndpoint.versionUrl, {
      headers: {
        'Authorization': `Token ${this.ocpiEndpoint.token}`
      },
    });
    return response.data?.data;
  }

  public getLocalCountryCode(action: ServerAction): string {
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

  public getLocalPartyID(action: ServerAction): string {
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
    if (this.ocpiEndpoint.availableEndpoints && this.ocpiEndpoint.availableEndpoints[service]) {
      return this.ocpiEndpoint.availableEndpoints[service];
    }
    throw new BackendError({
      action, message: `No endpoint URL defined for service '${service}'`,
      module: MODULE_NAME, method: 'getEndpointUrl',
    });
  }

  protected getLocalEndpointUrl(service: string): string {
    return `${Configuration.getOCPIEndpointConfig().baseUrl}/ocpi/${this.role}/${this.ocpiEndpoint.version}/${service}`;
  }

  private async checkVersions(): Promise<boolean> {
    // Get available version.
    const ocpiVersions = await this.getVersions();
    // Loop through versions and pick the same one
    let versionFound = false;
    for (const ocpiVersion of ocpiVersions) {
      if (ocpiVersion.version === '2.1.1') {
        versionFound = true;
        this.ocpiEndpoint.version = ocpiVersion.version;
        this.ocpiEndpoint.versionUrl = ocpiVersion.url;
        break;
      }
    }
    return versionFound;
  }

  private async deleteCredentials(): Promise<OCPICredential> {
    // Get credentials url
    const credentialsUrl = this.getEndpointUrl('credentials', ServerAction.OCPI_CREATE_CREDENTIALS);
    await Logging.logInfo({
      tenantID: this.tenant.id,
      action: ServerAction.OCPI_CREATE_CREDENTIALS,
      message: `Delete Credentials at ${credentialsUrl}`,
      module: MODULE_NAME, method: 'postCredentials'
    });
    // Call eMSP with CPO credentials
    const response = await this.axiosInstance.delete(credentialsUrl,
      {
        headers: {
          Authorization: `Token ${this.ocpiEndpoint.token}`,
          'Content-Type': 'application/json'
        },
      });
    return response.data?.data;
  }

  private async postCredentials(): Promise<OCPICredential> {
    // Get credentials url
    const credentialsUrl = this.getEndpointUrl('credentials', ServerAction.OCPI_CREATE_CREDENTIALS);
    const credentials = await OCPIUtils.buildOcpiCredentialObject(this.tenant, this.ocpiEndpoint.localToken, this.ocpiEndpoint.role);
    await Logging.logInfo({
      tenantID: this.tenant.id,
      action: ServerAction.OCPI_CREATE_CREDENTIALS,
      message: `Post Credentials at ${credentialsUrl}`,
      module: MODULE_NAME, method: 'postCredentials',
      detailedMessages: { credentials }
    });
    // Call eMSP with CPO credentials
    const response = await this.axiosInstance.post(credentialsUrl, credentials,
      {
        headers: {
          Authorization: `Token ${this.ocpiEndpoint.token}`,
          'Content-Type': 'application/json'
        },
      });
    return response.data?.data;
  }

  private async putCredentials(): Promise<OCPICredential> {
    // Get credentials url
    const credentialsUrl = this.getEndpointUrl('credentials', ServerAction.OCPI_UPDATE_CREDENTIALS);
    const credentials = await OCPIUtils.buildOcpiCredentialObject(this.tenant, this.ocpiEndpoint.localToken, this.ocpiEndpoint.role);
    await Logging.logInfo({
      tenantID: this.tenant.id,
      action: ServerAction.OCPI_UPDATE_CREDENTIALS,
      message: `Put Credentials at ${credentialsUrl}`,
      module: MODULE_NAME, method: 'putCredentials',
      detailedMessages: { credentials }
    });
    // Call eMSP with CPO credentials
    const response = await this.axiosInstance.put(credentialsUrl, credentials,
      {
        headers: {
          Authorization: `Token ${this.ocpiEndpoint.token}`,
          'Content-Type': 'application/json'
        },
      });
    return response.data?.data;
  }
}
