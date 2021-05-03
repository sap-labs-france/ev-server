import { OCPI15118EVCertificateRequest, OCPI15118EVCertificateResponse } from '../../types/ocpi/OCPICertificate';

import AxiosFactory from '../../utils/AxiosFactory';
import { AxiosInstance } from 'axios';
import Configuration from '../../utils/Configuration';
import { ContractCertificatePoolType } from '../../types/configuration/ContractsCertificatePoolConfiguration';
import Logging from '../../utils/Logging';
import { OCPIStatusCode } from '../../types/ocpi/OCPIStatusCode';
import { ServerAction } from '../../types/Server';

const MODULE_NAME = 'ContractCertificatePoolClient';

export default class ContractCertificatePoolClient {
  private static ccpClient: ContractCertificatePoolClient;
  public ccpIndex = 0;
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

  public async getContractCertificateExiResponse(schemaVersion: string, exiRequest: string): Promise<string> {
    let exiResponse: string;
    const contractCertificatePool = Configuration.getContractCertificatePool()?.pools[this.ccpIndex];
    switch (contractCertificatePool.type) {
      case ContractCertificatePoolType.GIREVE:
      case ContractCertificatePoolType.ELAAD:
      case ContractCertificatePoolType.VEDECOM:
        exiResponse = await this.getCommonAPIContractCertificateExiResponse(contractCertificatePool.type, schemaVersion, exiRequest);
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

  private async getCommonAPIContractCertificateExiResponse(ccpType: ContractCertificatePoolType, schemaVersion: string, exiRequest: string): Promise<string> {
    const ocpi15118EVCertificateRequest: OCPI15118EVCertificateRequest = {
      '15118SchemaVersion': schemaVersion,
      exiRequest
    };
    // Get 15118 EV Certificate
    const result = await this.axiosInstance.post<OCPI15118EVCertificateResponse>(Configuration.getContractCertificatePoolEndPoint(ccpType), ocpi15118EVCertificateRequest);
    const ocpi15118EVCertificateResponse = result.data;
    if (ocpi15118EVCertificateResponse.status_code === OCPIStatusCode.CODE_1000_SUCCESS.status_code && ocpi15118EVCertificateResponse.data.status === 'Accepted') {
      return ocpi15118EVCertificateResponse.data.exiResponse;
    }
    throw Error(ccpType + ': Failed to get 15118 exiResponse');
  }
}
