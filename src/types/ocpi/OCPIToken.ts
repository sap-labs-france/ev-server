export interface OCPIToken {
  uid: string;
  type: string;
  auth_id: string;
  visual_number: string;
  issuer: string;
  valid: boolean;
  whitelist: string;
  language?: string;
  last_updated: Date;
}
