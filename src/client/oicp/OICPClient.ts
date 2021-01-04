import { AxiosInstance, AxiosRequestConfig } from 'axios';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';

import AxiosFactory from '../../utils/AxiosFactoryOICP';
import BackendError from '../../exception/BackendError';
import Configuration from '../../utils/Configuration';
import { HTTPError } from '../../types/HTTPError';
import Logging from '../../utils/Logging';
import OICPEndpoint from '../../types/oicp/OICPEndpoint';
import OICPEndpointStorage from '../../storage/mongodb/OICPEndpointStorage';
import { OICPOperatorID } from '../../types/oicp/OICPEvse';
import { OICPRegistrationStatus } from '../../types/oicp/OICPRegistrationStatus';
import { OICPResult } from '../../types/oicp/OICPResult';
import { OICPRole } from '../../types/oicp/OICPRole';
import OICPServiceConfiguration from '../../types/configuration/OICPServiceConfiguration';
import { OicpSetting } from '../../types/Setting';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import fs from 'fs';
import https from 'https';

const MODULE_NAME = 'OICPClient';

export default abstract class OICPClient {
  protected axiosInstance: AxiosInstance;
  protected oicpEndpoint: OICPEndpoint;
  protected tenant: Tenant;
  protected role: string;
  protected settings: OicpSetting;
  private oicpConfig: OICPServiceConfiguration;

  protected constructor(tenant: Tenant, settings: OicpSetting, oicpEndpoint: OICPEndpoint, role: string) {
    if (role !== OICPRole.CPO && role !== OICPRole.EMSP) {
      throw new BackendError({
        message: `Invalid OICP role '${role}'`,
        module: MODULE_NAME, method: 'constructor',
      });
    }
    this.tenant = tenant;
    this.settings = settings;
    this.oicpEndpoint = oicpEndpoint;
    this.role = role.toLowerCase();
    this.oicpConfig = Configuration.getOICPServiceConfig();
    this.axiosInstance = AxiosFactory.getAxiosInstance(tenant.id, { axiosConfig: this.getAxiosConfig(ServerAction.OICP_CREATE_AXIOS_INSTANCE) });
  }

  getLocalCountryCode(action: ServerAction): string {
    if (!this.settings[this.role]) {
      throw new BackendError({
        action, message: `OICP Settings are missing for role ${this.role}`,
        module: MODULE_NAME, method: 'getLocalCountryCode',
      });
    }
    if (!this.settings[this.role].countryCode) {
      throw new BackendError({
        action, message: `OICP Country Code setting is missing for role ${this.role}`,
        module: MODULE_NAME, method: 'getLocalCountryCode',
      });
    }
    return this.settings[this.role].countryCode;
  }

  getLocalPartyID(action: ServerAction): string {
    if (!this.settings[this.role]) {
      throw new BackendError({
        action, message: `OICP Settings are missing for role ${this.role}`,
        module: MODULE_NAME, method: 'getLocalPartyID',
      });
    }
    if (!this.settings[this.role].partyID) {
      throw new BackendError({
        action, message: `OICP Party ID setting is missing for role ${this.role}`,
        module: MODULE_NAME, method: 'getLocalPartyID',
      });
    }
    return this.settings[this.role].partyID;
  }

  getOperatorID(action: ServerAction): OICPOperatorID {
    const countryCode = this.getLocalCountryCode(action);
    const partyID = this.getLocalPartyID(action);
    const operatorID = `${countryCode}*${partyID}`;
    return operatorID;
  }

  async unregister(): Promise<any> {
    const unregisterResult: any = {};
    try {
      // Save endpoint
      this.oicpEndpoint.status = OICPRegistrationStatus.UNREGISTERED;
      await OICPEndpointStorage.saveOicpEndpoint(this.tenant.id, this.oicpEndpoint);
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
      // Save endpoint
      this.oicpEndpoint.status = OICPRegistrationStatus.REGISTERED;
      await OICPEndpointStorage.saveOicpEndpoint(this.tenant.id, this.oicpEndpoint);
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

  protected getEndpointUrl(service: string, action: ServerAction): string {
    if (this.oicpEndpoint.availableEndpoints) {
      const baseURL = this.oicpEndpoint.baseUrl;
      const path = this.oicpEndpoint.availableEndpoints[service].replace('{operatorID}', this.getOperatorID(action));
      const fullURL = baseURL.concat(path);
      return fullURL;
    }
    throw new BackendError({
      action, message: `No endpoint URL defined for service ${service}`,
      module: MODULE_NAME, method: 'getLocalPartyID',
    });
  }

  private getPrivateKey(action: ServerAction): Buffer {
    if (!this.settings[this.role]) {
      throw new BackendError({
        action, message: `OICP Settings are missing for role ${this.role}`,
        module: MODULE_NAME, method: 'getPrivateKey',
      });
    }
    const key = fs.readFileSync(this.oicpConfig['ssl-key']);
    if (!key) {
      throw new BackendError({
        action, message: `OICP private Key setting is missing for role ${this.role}`,
        module: MODULE_NAME, method: 'getPrivateKey',
      });
    }
    return key;
  }

  private getClientCertificate(action: ServerAction): Buffer {
    if (!this.settings[this.role]) {
      throw new BackendError({
        action, message: `OICP Settings are missing for role ${this.role}`,
        module: MODULE_NAME, method: 'getClientCertificate',
      });
    }
    const cert = fs.readFileSync(this.oicpConfig['ssl-cert']);
    if (!cert) {
      throw new BackendError({
        action, message: `OICP client certificate setting is missing for role ${this.role}`,
        module: MODULE_NAME, method: 'getClientCertificate',
      });
    }
    return cert;
  }

  private getAxiosConfig(action: ServerAction): AxiosRequestConfig {
    const axiosConfig: AxiosRequestConfig = {} as AxiosRequestConfig;
    axiosConfig.httpsAgent = this.getHttpsAgent(action);
    axiosConfig.headers = {
      'Content-Type': 'application/json'
    };
    return axiosConfig;
  }

  private getHttpsAgent(action: ServerAction): https.Agent {
    const publicCert = this.getClientCertificate(action);
    const privateKey = this.getPrivateKey(action);

    const httpsAgent = new https.Agent({
      rejectUnauthorized: false,
      cert: publicCert,
      key: privateKey,
      passphrase: ''
    });
    return httpsAgent;
  }

  abstract triggerJobs(): Promise<{
    evses?: OICPResult,
    evseStatuses?: OICPResult;
  }>;

  abstract ping();
}
