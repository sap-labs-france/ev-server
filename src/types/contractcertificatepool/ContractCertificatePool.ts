export enum ContractCertificatePoolType {
  GIREVE = 'Gireve',
  HUBJECT = 'Hubject',
  ELAAD = 'Elaad',
  VEDECOM = 'Vedecom',
}

export interface ContractCertificatePool {
  type: ContractCertificatePoolType;
  endpoint?: string;
}

