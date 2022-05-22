import CreatedUpdatedProps from '../CreatedUpdatedProps';
import { OCPIRegistrationStatus } from './OCPIRegistrationStatus';
import { OCPIRole } from './OCPIRole';
import { OcpiBusinessDetails } from '../Setting';

export default interface OCPIEndpoint extends CreatedUpdatedProps, OCPILastCpoPushStatus, OCPILastCpoPullToken, OCPILastEmspPullLocation, OCPILastEmspPushToken {
  id: string;
  role: OCPIRole;
  name: string;
  baseUrl: string;
  localToken: string;
  token: string;
  countryCode: string;
  partyId: string;
  backgroundPatchJob: boolean;
  status?: OCPIRegistrationStatus;
  version?: string;
  businessDetails?: OcpiBusinessDetails;
  availableEndpoints?: OCPIAvailableEndpoints;
  versionUrl?: string;
}

export interface OCPILastEmspPushToken {
  lastEmspPushTokens?: Date;
  lastEmspPushTokensResult?: {
    successNbr: number;
    failureNbr: number;
    totalNbr: number;
    tokenIDsInFailure?: string[];
  };
}

export interface OCPILastEmspPullLocation {
  lastEmspPullLocations?: Date;
  lastEmspPullLocationsResult?: {
    successNbr: number;
    failureNbr: number;
    totalNbr: number;
    locationIDsInFailure?: string[];
  };
}

export interface OCPILastCpoPullToken {
  lastCpoPullTokens?: Date;
  lastCpoPullTokensResult?: {
    successNbr: number;
    failureNbr: number;
    totalNbr: number;
    tokenIDsInFailure?: string[];
  };
}

export interface OCPILastCpoPushStatus {
  lastCpoPushStatuses?: Date;
  lastCpoPushStatusesResult?: {
    successNbr: number;
    failureNbr: number;
    totalNbr: number;
    chargeBoxIDsInFailure?: string[];
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
