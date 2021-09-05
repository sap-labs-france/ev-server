import { OCPPProtocol, OCPPVersion } from './OCPPServer';

export interface OCPPHeader {
  ocppVersion?: OCPPVersion;
  ocppProtocol?: OCPPProtocol;
  chargeBoxIdentity: string;
  siteID: string;
  siteAreaID: string;
  companyID: string;
  currentIPAddress?: string | string[];
  tenantID: string;
  token?: string;
  chargingStationURL?: string;
  From?: {
    Address: string | string[];
  };
}
