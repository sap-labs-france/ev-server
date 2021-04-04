import { OCPI15118EVCertificateRequest, OCPI15118EVCertificateResponse } from '../../types/ocpi/OCPICertificate';

import AxiosFactory from '../../utils/AxiosFactory';
import { AxiosInstance } from 'axios';
import Configuration from '../../utils/Configuration';
import { ContractCertificatePoolType } from '../../types/configuration/ContractsCertificatePoolConfiguration';
import { OCPIStatusCode } from '../../types/ocpi/OCPIStatusCode';
import Tenant from '../../types/Tenant';
import global from '../../types/GlobalType';
import { soap } from 'strong-soap';

const MODULE_NAME = 'ContractCertificatePoolClient';

export default class ContractCertificatePoolClient {
  private axiosInstance: AxiosInstance;

  constructor(tenant: Tenant) {
    this.axiosInstance = AxiosFactory.getAxiosInstance(tenant.id);
  }

  public async getContractCertificateExiResponse(schemaVersion: string, exiRequest: string): Promise<string> {
    let exiResponse: string;
    for (const contractCertificatePool of Configuration.getContractCertificatePool().pools) {
      switch (contractCertificatePool.type) {
        case ContractCertificatePoolType.GIREVE:
          exiResponse = await this.getGireveContractCertificateExiResponse(schemaVersion, exiRequest);
          break;
        case ContractCertificatePoolType.ELAAD:
          // exiResponse = await this.getElaadContractCertificateExiResponse(schemaVersion, exiRequest);
          break;
        default:
          throw Error(`Configured ${contractCertificatePool.type} contract certificate pool type not found`);
      }
      if (exiResponse) {
        break;
      }
    }
    return exiResponse;
  }

  private async getGireveContractCertificateExiResponse(schemaVersion: string, exiRequest: string): Promise<string> {
    const ocpi15118EVCertificateRequest: OCPI15118EVCertificateRequest = {
      '15118SchemaVersion': schemaVersion,
      exiRequest
    };
    // Get 15118 EV Certificate
    const result = await this.axiosInstance.post<OCPI15118EVCertificateResponse>(Configuration.getContractCertificatePoolEndPoint(ContractCertificatePoolType.GIREVE),
      ocpi15118EVCertificateRequest);
    const ocpi15118EVCertificateResponse = result.data;
    if (ocpi15118EVCertificateResponse.status_code === OCPIStatusCode.CODE_1000_SUCCESS.status_code && ocpi15118EVCertificateResponse.data.status === 'Accepted') {
      return ocpi15118EVCertificateResponse.data.exiResponse;
    }
    throw Error(ContractCertificatePoolType.GIREVE + ': Failed to get 15118 exiResponse');
  }

  private async getElaadContractCertificateExiResponse(schemaVersion: string, exiRequest: string): Promise<void> {
    // Create SOAP client
    soap.createClient(`${global.appRoot}/assets/server/ccp/plugfest_draft.wsdl`, {}, (error, client) => {});
  }
}
