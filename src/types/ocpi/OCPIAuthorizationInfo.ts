import { OCPIDisplayText } from './OCPIDisplayText';
import { OCPILocationReference } from './OCPILocation';

export interface OCPIAuthorizationInfo {
  allowed: OCPIAllowed;
  location: OCPILocationReference;
  authorization_id: string;
  info?: OCPIDisplayText;
}

export enum OCPIAllowed {
  ALLOWED = 'ALLOWED',
  BLOCKED = 'BLOCKED',
  EXPIRED = 'EXPIRED',
  NO_CREDIT = 'NO_CREDIT',
  NOT_ALLOWED = 'NOT_ALLOWED',
}
