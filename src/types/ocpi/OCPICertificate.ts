import { OCPPGet15118EVCertificateRequest } from '../ocpp/OCPPServer';

export type OCPI15118EVCertificateRequest = OCPPGet15118EVCertificateRequest;

// FIXME: Reuse OCPIResponse
export interface OCPI15118EVCertificateResponse {
  data: {
    status: string;
    exiResponse: string;
    contractSignatureChain: Record<string, unknown>;
    saProvisioningCertificateChain: Record<string, unknown>;
  }
  status_code: number;
  status_message: string;
  timestamp: string;
}
