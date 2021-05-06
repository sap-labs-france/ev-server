import { ContractCertificatePool } from './ContractCertificatePool';
import { OCPP1511SchemaVersionList } from '../ocpp/OCPPServer';

export interface HubjectContractCertificatePool extends ContractCertificatePool {
  auth_endpoint: string;
  client_id: string;
  client_secret: string;
}

export enum GrantType {
  CLIENT_CREDENTIALS = 'client_credentials',
}

export interface AuthRequest {
  client_id: string;
  client_secret: string;
  audience: string;
  grant_type: GrantType;
}

enum Scope {
  CCP_SERVICE = 'ccpservice'
}

enum TokenType {
  BEARER = 'Bearer'
}

export interface AuthResponse {
  access_token: string;
  scope: Scope;
  expires_in: number;
  token_type: TokenType;
}

export interface GetSignedContractDataRequest {
  certificateInstallationReq: string;
  xsdMsgDefNamespace: OCPP1511SchemaVersionList;
}

export interface GetSignedContractDataResponse {
  certificateInstallationRes: string;
}

