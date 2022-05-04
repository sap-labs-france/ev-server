import { AxiosInstance, AxiosRequestConfig } from 'axios';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';

import AxiosFactory from '../../utils/AxiosFactory';
import BackendError from '../../exception/BackendError';
import Cypher from '../../utils/Cypher';
import { HTTPError } from '../../types/HTTPError';
import OICPEndpoint from '../../types/oicp/OICPEndpoint';
import OICPEndpointStorage from '../../storage/mongodb/OICPEndpointStorage';
import { OICPOperatorID } from '../../types/oicp/OICPEvse';
import { OICPRegistrationStatus } from '../../types/oicp/OICPRegistrationStatus';
import { OICPRole } from '../../types/oicp/OICPRole';
import { OicpSetting } from '../../types/Setting';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import https from 'https';

const MODULE_NAME = 'OICPClient';

export default abstract class OICPClient {
  protected axiosInstance: AxiosInstance;
  protected oicpEndpoint: OICPEndpoint;
  protected tenant: Tenant;
  protected role: string;
  protected settings: OicpSetting;

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
    this.axiosInstance = AxiosFactory.getAxiosInstance(tenant, { axiosConfig: this.getAxiosConfig() }); // FIXME: 'Converting circular structure to JSON' Error
  }

  public getLocalCountryCode(action: ServerAction): string {
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

  public getLocalPartyID(action: ServerAction): string {
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

  public getOperatorID(action: ServerAction): OICPOperatorID {
    const countryCode = this.getLocalCountryCode(action);
    const partyID = this.getLocalPartyID(action);
    const operatorID = `${countryCode}*${partyID}`;
    return operatorID;
  }

  public async unregister(): Promise<any> {
    const unregisterResult: any = {};
    try {
      // Save endpoint
      this.oicpEndpoint.status = OICPRegistrationStatus.UNREGISTERED;
      await OICPEndpointStorage.saveOicpEndpoint(this.tenant, this.oicpEndpoint);
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

  public async register(): Promise<any> {
    const registerResult: any = {};
    try {
      // Save endpoint
      this.oicpEndpoint.status = OICPRegistrationStatus.REGISTERED;
      await OICPEndpointStorage.saveOicpEndpoint(this.tenant, this.oicpEndpoint);
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

  protected async getHttpsAgent(action: ServerAction): Promise<https.Agent> {
    const publicCert = await this.getClientCertificate(action);
    const privateKey = await this.getPrivateKey(action);
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false,
      cert: publicCert,
      key: privateKey,
      passphrase: ''
    });
    return httpsAgent;
  }

  private async getPrivateKey(action: ServerAction): Promise<string> {
    if (!this.settings[this.role]) {
      throw new BackendError({
        action, message: `OICP Settings are missing for role ${this.role}`,
        module: MODULE_NAME, method: 'getPrivateKey',
      });
    }
    if (!this.settings[this.role].key) {
      throw new BackendError({
        action, message: `OICP private Key setting is missing for role ${this.role}`,
        module: MODULE_NAME, method: 'getPrivateKey',
      });
    }
    return Cypher.decrypt(this.tenant, this.settings[this.role].key);
  }

  private async getClientCertificate(action: ServerAction): Promise<string> {
    if (!this.settings[this.role]) {
      throw new BackendError({
        action, message: `OICP Settings are missing for role ${this.role}`,
        module: MODULE_NAME, method: 'getClientCertificate',
      });
    }
    if (!this.settings[this.role].cert) {
      throw new BackendError({
        action, message: `OICP client certificate setting is missing for role ${this.role}`,
        module: MODULE_NAME, method: 'getClientCertificate',
      });
    }
    return Cypher.decrypt(this.tenant, this.settings[this.role].cert);
  }

  private getAxiosConfig(): AxiosRequestConfig {
    const axiosConfig: AxiosRequestConfig = {} as AxiosRequestConfig;
    // AxiosConfig.httpsAgent = await this.getHttpsAgent(action);
    axiosConfig.headers = {
      'Content-Type': 'application/json'
    };
    return axiosConfig;
  }

  public abstract ping();
}
