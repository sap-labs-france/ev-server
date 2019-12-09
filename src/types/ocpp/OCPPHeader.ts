export interface OCPPHeader {
  ocppVersion?: string;
  ocppProtocol?: string;
  chargeBoxIdentity?: string;
  currentIPAddress?: string;
  tenantID?: string;
  token?: string;
  chargingStationURL?: string;
  From?: {
    Address: string;
  }
}
