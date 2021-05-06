import { ContractCertificatePool } from '../contractcertificatepool/ContractCertificatePool';
import { HubjectContractCertificatePool } from '../contractcertificatepool/Hubject';

export default interface ContractCertificatePoolsConfiguration {
  pools: ContractCertificatePool[]|HubjectContractCertificatePool[];
}
