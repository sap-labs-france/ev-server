export enum ContractCertificatePoolType {
  GIREVE = 'Gireve',
  HUBJECT = 'Hubject',
  ELAAD = 'Elaad',
}

interface ContractCertificatePool {
  type: ContractCertificatePoolType;
  endpoint?: string;
}

export default interface ContractCertificatePoolConfiguration {
  pools: ContractCertificatePool[];
}
