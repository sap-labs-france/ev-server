import { OICPIdentification } from './OICPIdentification';

export interface OICPProviderAuthenticationData {
  ProviderID: OICPProviderID, // The EMP whose data records are listed below.
  AuthenticationDataRecord: OICPAuthenticationDataRecord[] // 0..n
}

export interface OICPAuthenticationDataRecord {
  Identification: OICPIdentification // Authentication data
}

export enum OICPAuthorizationStatus {
  Authorized = 'Authorized', // User is authorized.
  NotAuthorized = 'NotAuthorized', // User is not authorized.
}

export type OICPProviderID = string; // A string that MUST be valid with respect to the following regular expression: ISO | DIN ^([A-Za-z]{2}\-?[A-Za-z0-9]{3}|[A-Za-z]{2}[\*|-]?[A-Za-z0-9]{3})$ Examples ISO: “DE8EO”, “DE-8EO”, Examples DIN: “DE8EO”, “DE*8EO”, “DE-8EO”
