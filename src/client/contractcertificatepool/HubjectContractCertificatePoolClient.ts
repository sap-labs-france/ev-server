import { AuthRequest, AuthResponse, GetSignedContractDataRequest, GetSignedContractDataResponse, GrantType, HubjectContractCertificatePool } from '../../types/contractcertificatepool/Hubject';
import { AxiosInstance, AxiosResponse } from 'axios';

import AxiosFactory from '../../utils/AxiosFactory';
import BackendError from '../../exception/BackendError';
import Configuration from '../../utils/Configuration';
import Constants from '../../utils/Constants';
import { ContractCertificatePoolType } from '../../types/contractcertificatepool/ContractCertificatePool';
import Logging from '../../utils/Logging';
import { OCPP1511SchemaVersionList } from '../../types/ocpp/OCPPServer';
import { ServerAction } from '../../types/Server';

const MODULE_NAME = 'HubjectContractCertificatePoolClient';

export default class HubjectContractCertificatePoolClient {
  private static ccpClient: HubjectContractCertificatePoolClient;
  private bearerToken: string;
  private axiosInstance: AxiosInstance;
  private tenantID: string;
  private chargingStationID: string;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public static getInstance(): HubjectContractCertificatePoolClient {
    if (!HubjectContractCertificatePoolClient.ccpClient) {
      HubjectContractCertificatePoolClient.ccpClient = new HubjectContractCertificatePoolClient();
    }
    return HubjectContractCertificatePoolClient.ccpClient;
  }

  public initialize(tenantID: string, chargingStationID: string): void {
    this.axiosInstance = AxiosFactory.getAxiosInstance(tenantID);
    this.tenantID = tenantID;
    this.chargingStationID = chargingStationID;
  }

  public async getHubjectContractCertificateExiResponse(schemaVersion: OCPP1511SchemaVersionList, exiRequest: string): Promise<string> {
    // FIXME: make the authentication step conditional to the token expire
    await this.authenticateHubjectCCP();
    const hubject15118EVCertificateRequest: GetSignedContractDataRequest = {
      certificateInstallationReq: exiRequest,
      xsdMsgDefNamespace: schemaVersion
    };
    // Get 15118 EV Certificate
    let axiosResponse: AxiosResponse;
    try {
      axiosResponse = await this.axiosInstance.post<GetSignedContractDataResponse>(Configuration.getContractCertificatePoolEndPoint(ContractCertificatePoolType.HUBJECT),
        hubject15118EVCertificateRequest,
        {
          headers: this.buildAuthHeader(this.bearerToken)
        });
      await Logging.logInfo({
        tenantID: this.tenantID,
        source: this.chargingStationID,
        action: ServerAction.GET_15118_EV_CERTIFICATE,
        message: `Fetching contract certificate from ${ContractCertificatePoolType.HUBJECT}`,
        module: MODULE_NAME, method: 'getHubjectContractCertificateExiResponse',
      });
      return axiosResponse.data.CCPResponse.emaidContent.messageDef.certificateInstallationRes;
    } catch (error) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'getHubjectContractCertificateExiResponse',
        action: ServerAction.GET_15118_EV_CERTIFICATE,
        message: `Error while fetching contract certificate from ${ContractCertificatePoolType.HUBJECT} contract certificate pool service`,
        detailedMessages: { hubject15118EVCertificateRequest, axiosResponse, error: error.message, stack: error.stack }
      });
    }
  }

  private async authenticateHubjectCCP() {
    const hubjectContractCertificatePoolConfiguration = this.getHubjectContractCertificatePoolConfiguration();
    const hubject15118EVCertificateAuthRequest: AuthRequest = {
      client_id: hubjectContractCertificatePoolConfiguration.client_id,
      client_secret: hubjectContractCertificatePoolConfiguration.client_secret,
      audience: 'https://eu.plugncharge-qa.hubject.com',
      grant_type: GrantType.CLIENT_CREDENTIALS
    };
    let axiosResponse: AxiosResponse;
    try {
      axiosResponse = await this.axiosInstance.post<AuthResponse>(hubjectContractCertificatePoolConfiguration.auth_endpoint,
        hubject15118EVCertificateAuthRequest);
      this.bearerToken = axiosResponse.data.access_token;
    } catch (error) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'authenticateHubjectCCP',
        action: ServerAction.GET_15118_EV_CERTIFICATE,
        message: `Error while authenticating to ${ContractCertificatePoolType.HUBJECT} contract certificate pool service`,
        detailedMessages: { hubject15118EVCertificateAuthRequest, axiosResponse, error: error.message, stack: error.stack }
      });
    }
  }

  private getHubjectContractCertificatePoolConfiguration(): HubjectContractCertificatePool {
    for (const ccp of Configuration.getContractCertificatePools().pools) {
      if (ccp.type === ContractCertificatePoolType.HUBJECT) {
        return ccp as HubjectContractCertificatePool;
      }
    }
  }

  private buildAuthHeader(token: string): any {
    return {
      'Authorization': 'Bearer ' + token
    };
  }
}
