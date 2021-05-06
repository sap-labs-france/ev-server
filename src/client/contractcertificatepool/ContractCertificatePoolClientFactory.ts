import ContractCertificatePoolClient from './ContractCertificatePoolClient';
import { ContractCertificatePoolType } from '../../types/contractcertificatepool/ContractCertificatePool';
import HubjectContractCertificatePoolClient from './HubjectContractCertificatePoolClient';

const MODULE_NAME = 'ContractCertificatePoolClientFactory';

export default class ContractCertificatePoolClientFactory {
  public static getCCPClient(tenantID: string, chargingStationID: string, ccpType: ContractCertificatePoolType): ContractCertificatePoolClient|HubjectContractCertificatePoolClient {
    switch (ccpType) {
      case ContractCertificatePoolType.GIREVE:
      case ContractCertificatePoolType.ELAAD:
      case ContractCertificatePoolType.VEDECOM:
        return ContractCertificatePoolClient.getInstance(tenantID, chargingStationID, ccpType);
      case ContractCertificatePoolType.HUBJECT:
        return HubjectContractCertificatePoolClient.getInstance(tenantID, chargingStationID, ccpType);
      default:
        return null;
    }
  }
}

