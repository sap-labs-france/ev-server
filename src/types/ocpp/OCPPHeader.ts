import { OCPPProtocol, OCPPVersion } from './OCPPServer';

import ChargingStation from '../ChargingStation';
import Lock from '../Locking';
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
  lock?: Lock;
  token?: RegistrationToken;
  tokenID?: string;
  chargingStationURL?: string;
  From?: {
    Address: string | string[];
  };
}
