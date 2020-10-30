import AxiosFactory from '../../utils/AxiosFactory';
import { AxiosInstance } from 'axios';
import BackendError from '../../exception/BackendError';
import { HTTPError } from '../../types/HTTPError';
import OICPEndpoint from '../../types/oicp/OICPEndpoint';
import { OICPRole } from '../../types/oicp/OICPRole';
import { OicpSetting } from '../../types/Setting';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import { OICPJobResult } from '../../types/oicp/OICPJobResult';
import { OICPOperatorID } from '../../types/oicp/OICPEvse';
import Logging from '../../utils/Logging';

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
    this.axiosInstance = AxiosFactory.getAxiosInstance(tenant.id);
    this.tenant = tenant;
    this.settings = settings;
    this.oicpEndpoint = oicpEndpoint;
    this.role = role.toLowerCase();
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
    const countryCode = this.getLocalCountryCode(ServerAction.OICP_PUSH_EVSE_STATUSES);
    const partyID = this.getLocalPartyID(ServerAction.OICP_PUSH_EVSE_STATUSES);
    const operatorID = `${countryCode}*${partyID}`;
    return operatorID;
  }

  getPrivateKey(action: ServerAction): string {
    if (!this.settings[this.role]) {
      throw new BackendError({
        action, message: `OICP Settings are missing for role ${this.role}`,
        module: MODULE_NAME, method: 'getPrivateKey',
      });
    }
    if (!this.settings[this.role].privateKey) {
      throw new BackendError({
        action, message: `OICP private Key setting is missing for role ${this.role}`,
        module: MODULE_NAME, method: 'getPrivateKey',
      });
    }
    return this.settings[this.role].privateKey;
  }

  getClientCertificate(action: ServerAction): string {
    if (!this.settings[this.role]) {
      throw new BackendError({
        action, message: `OICP Settings are missing for role ${this.role}`,
        module: MODULE_NAME, method: 'getClientCertificate',
      });
    }
    if (!this.settings[this.role].clientCertificate) {
      throw new BackendError({
        action, message: `OICP client certificate setting is missing for role ${this.role}`,
        module: MODULE_NAME, method: 'getClientCertificate',
      });
    }
    return this.settings[this.role].clientCertificate;
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

  async abstract triggerJobs(): Promise<{
    evses?: OICPJobResult,
    evseStatuses?: OICPJobResult;
  }>;

  async abstract ping();
}
