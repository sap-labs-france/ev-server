import { OCPPProtocol, OCPPVersion } from './OCPPServer';

import ChargingStation from '../ChargingStation';
import RegistrationToken from '../RegistrationToken';
import Tenant from '../Tenant';

export interface OCPPHeader {
  ocppVersion?: OCPPVersion;
  ocppProtocol?: OCPPProtocol;
  chargeBoxIdentity: string;
  siteID?: string;
  siteAreaID?: string;
  companyID?: string;
  currentIPAddress?: string | string[];
  // tenantID: string;
  // tokenID?: string;
  chargingStationURL?: string;
  From?: {
    Address: string | string[];
  };
  rawConnectionData?: OcppRawConnectionData;
  connectionContext?: OcppConnectionContext;
}

export interface OcppRawConnectionData {
  tenantID: string,
  chargingStationID: string,
  tokenID: string
}

export interface OcppConnectionContext {
  tenant: Tenant,
  chargingStation: ChargingStation,
  token?: RegistrationToken
}
