import CreatedUpdatedProps from '../CreatedUpdatedProps';
import { OCPIRole } from './OCPIRole';
import { OcpiBusinessDetails } from '../Setting';

export default interface OCPIEndpoint extends CreatedUpdatedProps {
  id: string;
  role: OCPIRole;
  name: string;
  baseUrl: string;
  localToken: string;
  token: string;
  countryCode: string;
  partyId: string;
  backgroundPatchJob: boolean;
  status?: string;
  version?: string;
  businessDetails?: OcpiBusinessDetails;
  availableEndpoints?: OCPIAvailableEndpoints;
  versionUrl?: string;
  lastPatchJobOn?: Date;
  lastPatchJobResult?: {
    successNbr: number;
    failureNbr: number;
    totalNbr: number;
    chargeBoxIDsInFailure?: string[];
    chargeBoxIDsInSuccess?: string[];
    tokenIDsInFailure?: string[];
  };
}

export interface OCPIAvailableEndpoints {
  credentials: string;
  locations: string;
  tokens: string;
  commands: string;
  sessions: string;
  cdrs: string;
  tariffs: string;
}

export interface OCPIEndpointVersions {
  version: string;
  endpoints: OCPIEndpointVersion[];
}

export interface OCPIEndpointVersion {
  identifier: string;
  url: string;
}

export interface OCPIVersion {
  version: string;
  url: string;
}

export interface OCPIPingResult {
  statusCode: number;
  statusText: string;
}

export interface OCPIUnregisterResult {
  statusCode: number;
  statusText: string;
}

export interface OCPIRegisterResult {
  statusCode: number;
  statusText: string;
}
