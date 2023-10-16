export interface OCPIToken {
  uid: string;
  type: OCPITokenType;
  auth_id: string;
  visual_number: string;
  issuer: string;
  valid: boolean;
  whitelist: OCPITokenWhitelist;
  language?: string;
  last_updated: Date;
}

export enum OCPITokenType {
  RFID = 'RFID',
  OTHER = 'OTHER',
}

export enum OCPITokenWhitelist {
  ALWAYS = 'ALWAYS', // Token always has to be whitelisted, realtime authorization is not possible/allowed.
  ALLOWED = 'ALLOWED', // It is allowed to whitelist the token, realtime authorization is also allowed.
  ALLOWED_OFFLINE = 'ALLOWED_OFFLINE', // Whitelisting is only allowed when CPO cannot reach the eMSP (communication between CPO and eMSP is offline)
  NEVER = 'NEVER', // Whitelisting is forbidden, only realtime authorization is allowed. Token should always be authorized by the eMSP.
}
