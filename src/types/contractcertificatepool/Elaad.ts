interface RootCertificateID {
  x509IssuerName: string;
  x509SerialNumber: number,
}

export interface ElaadGet15118EVCertificateRequest {
  PCID?: string;
  eMAID?: string;
  SessionID: string;
  Scheme?: string;
  ListOfRootCertificateIDs?: RootCertificateID[];
}

enum Status {
  Success = 'Success',
  Fail = 'Fail',
  NotFound = 'NotFound',
}

export interface ElaadGet15118EVCertificateResponse {
  Status: Status;
  EXIResponse?: string;
}
