import { OCPI15118EVCertificateRequest, OCPI15118EVCertificateResponse } from '../../types/ocpi/OCPICertificate';

import AxiosFactory from '../../utils/AxiosFactory';
import { AxiosInstance } from 'axios';
import CCPStorage from '../../storage/mongodb/CCPStorage';
import Configuration from '../../utils/Configuration';
import { ContractCertificatePoolType } from '../../types/contractcertificatepool/ContractCertificatePool';
import HubjectContractCertificatePoolClient from './HubjectContractCertificatePoolClient';
import Logging from '../../utils/Logging';
import { OCPIStatusCode } from '../../types/ocpi/OCPIStatusCode';
import { OCPP1511SchemaVersionList } from '../../types/ocpp/OCPPServer';
import { ServerAction } from '../../types/Server';

const MODULE_NAME = 'ContractCertificatePoolClient';

export default class ContractCertificatePoolClient {
  private static ccpClient: ContractCertificatePoolClient;
  private axiosInstance: AxiosInstance;
  private tenantID: string;
  private chargingStationID: string;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public static getInstance(): ContractCertificatePoolClient {
    if (!ContractCertificatePoolClient.ccpClient) {
      ContractCertificatePoolClient.ccpClient = new ContractCertificatePoolClient();
    }
    return ContractCertificatePoolClient.ccpClient;
  }

  public initialize(tenantID: string, chargingStationID: string): void {
    this.axiosInstance = AxiosFactory.getAxiosInstance(tenantID);
    this.tenantID = tenantID;
    this.chargingStationID = chargingStationID;
  }

  public async getContractCertificateExiResponse(schemaVersion: OCPP1511SchemaVersionList, exiRequest: string): Promise<string> {
    let exiResponse: string;
    let hubjectCCPClient: HubjectContractCertificatePoolClient;
    const contractCertificatePool = Configuration.getContractCertificatePools()?.pools[(await CCPStorage.getDefaultCCP()).ccpIndex ?? 0];
    switch (contractCertificatePool.type) {
      case ContractCertificatePoolType.GIREVE:
      case ContractCertificatePoolType.ELAAD:
      case ContractCertificatePoolType.VEDECOM:
        exiResponse = await this.getCommonAPIContractCertificateExiResponse(contractCertificatePool.type, schemaVersion, exiRequest);
        break;
      case ContractCertificatePoolType.HUBJECT:
        // FIXME: implement a ccp object factory instead
        hubjectCCPClient = HubjectContractCertificatePoolClient.getInstance();
        hubjectCCPClient.initialize(this.tenantID, this.chargingStationID);
        exiResponse = await hubjectCCPClient.getHubjectContractCertificateExiResponse(schemaVersion, exiRequest);
        break;
      default:
        throw Error(`Configured ${contractCertificatePool.type} contract certificate pool type not found`);
    }
    await Logging.logInfo({
      tenantID: this.tenantID,
      source: this.chargingStationID,
      action: ServerAction.GET_15118_EV_CERTIFICATE,
      message: `Fetching contract certificate from ${contractCertificatePool.type}`,
      module: MODULE_NAME, method: 'getContractCertificateExiResponse',
    });
    return exiResponse;
  }

  private async getCommonAPIContractCertificateExiResponse(ccpType: ContractCertificatePoolType, schemaVersion: OCPP1511SchemaVersionList, exiRequest: string): Promise<string> {
    const ocpi15118EVCertificateRequest: OCPI15118EVCertificateRequest = {
      '15118SchemaVersion': schemaVersion,
      exiRequest
    };
    // Get 15118 EV Certificate
    const axiosResponse = await this.axiosInstance.post<OCPI15118EVCertificateResponse>(Configuration.getContractCertificatePoolEndPoint(ccpType), ocpi15118EVCertificateRequest);
    const ocpi15118EVCertificateResponse = axiosResponse.data;
    if (ocpi15118EVCertificateResponse.status_code === OCPIStatusCode.CODE_1000_SUCCESS.status_code && ocpi15118EVCertificateResponse.data.status === 'Accepted') {
      return ocpi15118EVCertificateResponse.data.exiResponse;
    }
    throw Error(ccpType + ': Failed to get 15118 exiResponse');
  }
}
