import CreatedUpdatedProps from '../CreatedUpdatedProps';
import { OCPIBusinessDetails } from '../Setting';
import { OCPIRegistrationStatus } from './OCPIRegistrationStatus';
import { OCPIRole } from './OCPIRole';
import { OcpiEndpointAuthorizationActions } from '../Authorization';

export default interface OCPIEndpoint extends OcpiEndpointAuthorizationActions, CreatedUpdatedProps {
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
  businessDetails?: OCPIBusinessDetails;
  availableEndpoints?: OCPIAvailableEndpoints;
  versionUrl?: string;
  lastCpoPushStatuses?: OCPILastCpoPushStatus;
  lastEmspPushTokens?: OCPILastEmspPushToken;
  lastEmspPullLocations?: OCPILastEmspPullLocation;
  lastCpoPullTokens?: OCPILastCpoPullToken;
}

export interface OCPILastEmspPushToken {
  lastUpdatedOn: Date;
  partial: boolean;
  successNbr: number;
  failureNbr: number;
  totalNbr: number;
  tokenIDsInFailure?: string[];
}

export interface OCPILastEmspPullLocation {
  lastUpdatedOn: Date;
  partial: boolean;
  successNbr: number;
  failureNbr: number;
  totalNbr: number;
  locationIDsInFailure?: string[];
}

export interface OCPILastCpoPullToken {
  lastUpdatedOn: Date;
  partial: boolean;
  successNbr: number;
  failureNbr: number;
  totalNbr: number;
  tokenIDsInFailure?: string[];
}

export interface OCPILastCpoPushStatus {
  lastUpdatedOn: Date;
  partial: boolean;
  successNbr: number;
  failureNbr: number;
  totalNbr: number;
  chargeBoxIDsInFailure?: string[];
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
