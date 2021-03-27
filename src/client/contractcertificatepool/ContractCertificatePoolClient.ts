import AxiosFactory from '../../utils/AxiosFactory';
import { AxiosInstance } from 'axios';
import Configuration from '../../utils/Configuration';
import { ContractCertificatePoolType } from '../../types/configuration/ContractsCertificatePoolConfiguration';
import { OCPI15118EVCertificateResponse } from '../../types/ocpi/OCPICertificate';
import { OCPIStatusCode } from '../../types/ocpi/OCPIStatusCode';
import { OCPPGet15118EVCertificateRequest } from '../../types/ocpp/OCPPServer';
import Tenant from '../../types/Tenant';

const MODULE_NAME = 'ContractCertificatePoolClient';

export default class ContractCertificatePoolClient {
  private axiosInstance: AxiosInstance;

  constructor(tenant: Tenant) {
    this.axiosInstance = AxiosFactory.getAxiosInstance(tenant.id);
  }

  public async getContractCertificateExiResponse(ev15118Certificate: OCPPGet15118EVCertificateRequest): Promise<string> {
    let exiResponse: string;
    for (const contractCertificatePool of Configuration.getContractCertificatePool().pools) {
      switch (contractCertificatePool.type) {
        case ContractCertificatePoolType.GIREVE:
          exiResponse = await this.getGireveContractCertificateExiResponse(ev15118Certificate);
          break;
        default:
          throw Error(`Defined ${contractCertificatePool.type} contract certificate pool type not found`);
      }
      if (exiResponse) {
        break;
      }
    }
    return exiResponse;
  }

  private async getGireveContractCertificateExiResponse(ev15118Certificate: OCPPGet15118EVCertificateRequest): Promise<string> {
    // Get 15118 EV Certificate
    const result = await this.axiosInstance.post<OCPI15118EVCertificateResponse>(Configuration.getContractCertificatePoolEndPoint(ContractCertificatePoolType.GIREVE), ev15118Certificate);
    const ocpi15118EVCertificateResponse = result.data;
    if (ocpi15118EVCertificateResponse.status_code === OCPIStatusCode.CODE_1000_SUCCESS.status_code && ocpi15118EVCertificateResponse.data.status === 'Accepted') {
      return ocpi15118EVCertificateResponse.data.exiResponse;
    }
    throw Error(ContractCertificatePoolType.GIREVE + ': Failed to get 15118 exiResponse');
  }
}
