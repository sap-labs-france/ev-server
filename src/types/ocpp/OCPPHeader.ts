import { OCPPProtocol, OCPPVersion } from './OCPPServer';

import ChargingStation from '../ChargingStation';
import RegistrationToken from '../RegistrationToken';
import Tenant from '../Tenant';

export interface OCPPHeader {
  ocppVersion?: OCPPVersion;
  ocppProtocol?: OCPPProtocol;
  chargeBoxIdentity: string;
  chargingStation?: ChargingStation;
  siteID?: string;
  siteAreaID?: string;
  companyID?: string;
  currentIPAddress?: string | string[];
  tenantID: string;
  tenant?: Tenant;
  token?: RegistrationToken;
  tokenID?: string;
  chargingStationURL?: string;
  From?: {
    Address: string | string[];
  };
}
