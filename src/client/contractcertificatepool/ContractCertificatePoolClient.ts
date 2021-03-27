import { OCPP15118EVCertificateStatus, OCPPGet15118EVCertificateRequest, OCPPGet15118EVCertificateResponse } from '../../types/ocpp/OCPPServer';

import AxiosFactory from '../../utils/AxiosFactory';
import { AxiosInstance } from 'axios';
import Configuration from '../../utils/Configuration';
import { ContractCertificatePoolType } from '../../types/configuration/ContractsCertificatePoolConfiguration';
import { OCPI15118EVCertificateResponse } from '../../types/ocpi/OCPICertificate';
import { OCPIStatusCode } from '../../types/ocpi/OCPIStatusCode';
import Tenant from '../../types/Tenant';

const MODULE_NAME = 'ContractCertificatePoolClient';

export default class ContractCertificatePoolClient {
  private axiosInstance: AxiosInstance;

  constructor(tenant: Tenant) {
    this.axiosInstance = AxiosFactory.getAxiosInstance(tenant.id);
  }

  public async getContractCertificateResponse(ev15118Certificate: OCPPGet15118EVCertificateRequest): Promise<OCPPGet15118EVCertificateResponse> {
    let response: OCPPGet15118EVCertificateResponse;
    for (const contractCertificatePool of Configuration.getContractCertificatePool().pools) {
      switch (contractCertificatePool.type) {
        case ContractCertificatePoolType.GIREVE:
          response = await this.getGireveContractCertificateResponse(ev15118Certificate);
          break;
        default:
          throw Error(`Defined ${contractCertificatePool.type} contract certificate pool type not found`);
      }
      if (response) {
        break;
      }
    }
    return response;
  }

  private async getGireveContractCertificateResponse(ev15118Certificate: OCPPGet15118EVCertificateRequest): Promise<OCPPGet15118EVCertificateResponse> {
    // Get 15118 EV Certificate
    const result = await this.axiosInstance.post<OCPI15118EVCertificateResponse>(Configuration.getContractCertificatePoolEndPoint(ContractCertificatePoolType.GIREVE), ev15118Certificate);
    const ocpi15118EVCertificateResponse = result.data;
    if (ocpi15118EVCertificateResponse.status_code === OCPIStatusCode.CODE_1000_SUCCESS.status_code && ocpi15118EVCertificateResponse.data.status === 'Accepted') {
      return {
        status: OCPP15118EVCertificateStatus.ACCEPTED,
        exiResponse: ocpi15118EVCertificateResponse.data.exiResponse
      };
    }
    throw Error(ContractCertificatePoolType.GIREVE + ': Failed to get EV 15118 certificate');
  }
}
