import { AxiosInstance, AxiosResponse } from 'axios';
import { OCPI15118EVCertificateRequest, OCPI15118EVCertificateResponse } from '../../types/ocpi/OCPICertificate';

import AxiosFactory from '../../utils/AxiosFactory';
import BackendError from '../../exception/BackendError';
import Configuration from '../../utils/Configuration';
import Constants from '../../utils/Constants';
import { ContractCertificatePoolType } from '../../types/contractcertificatepool/ContractCertificatePool';
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
  private type: ContractCertificatePoolType;

  private constructor(tenantID: string, chargingStationID: string, ccpType: ContractCertificatePoolType) {
    this.axiosInstance = AxiosFactory.getAxiosInstance(tenantID);
    this.tenantID = tenantID;
    this.chargingStationID = chargingStationID;
    this.type = ccpType;
  }

  public static getInstance(tenantID: string, chargingStationID: string, ccpType: ContractCertificatePoolType): ContractCertificatePoolClient {
    if (!ContractCertificatePoolClient.ccpClient) {
      ContractCertificatePoolClient.ccpClient = new ContractCertificatePoolClient(tenantID, chargingStationID, ccpType);
    }
    return ContractCertificatePoolClient.ccpClient;
  }

  public async getContractCertificateExiResponse(schemaVersion: OCPP1511SchemaVersionList, exiRequest: string): Promise<string> {
    let exiResponse: string;
    switch (this.type) {
      case ContractCertificatePoolType.GIREVE:
      case ContractCertificatePoolType.ELAAD:
      case ContractCertificatePoolType.VEDECOM:
        exiResponse = await this.getCommonAPIContractCertificateExiResponse(this.type, schemaVersion, exiRequest);
        break;
      default:
        throw Error(`${this.type} contract certificate pool type not found in configuration`);
    }
    await Logging.logDebug({
      tenantID: this.tenantID,
      source: this.chargingStationID,
      action: ServerAction.GET_15118_EV_CERTIFICATE,
      message: `Fetching contract certificate from ${this.type} contract certificate pool service`,
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
    let axiosResponse: AxiosResponse;
    try {
      axiosResponse = await this.axiosInstance.post<OCPI15118EVCertificateResponse>(Configuration.getContractCertificatePoolEndPoint(ccpType), ocpi15118EVCertificateRequest);
      const ocpi15118EVCertificateResponse = axiosResponse.data;
      if (ocpi15118EVCertificateResponse.status_code === OCPIStatusCode.CODE_1000_SUCCESS.status_code && ocpi15118EVCertificateResponse.data.status === 'Accepted') {
        return ocpi15118EVCertificateResponse.data.exiResponse;
      }
    } catch (error) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'getContractCertificateExiResponse',
        action: ServerAction.GET_15118_EV_CERTIFICATE,
        message: `Error while fetching contract certificate from ${this.type} contract certificate pool service`,
        detailedMessages: { ocpi15118EVCertificateRequest, axiosResponse, error: error.message, stack: error.stack }
      });
    }
    throw new BackendError({
      source: Constants.CENTRAL_SERVER,
      module: MODULE_NAME,
      method: 'getContractCertificateExiResponse',
      action: ServerAction.GET_15118_EV_CERTIFICATE,
      message: `Failed to fetch successfully contract certificate from ${this.type} contract certificate pool service`,
      detailedMessages: { ocpi15118EVCertificateRequest, axiosResponse }
    });
  }
}
