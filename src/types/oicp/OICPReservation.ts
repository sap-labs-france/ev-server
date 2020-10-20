import { OICPIdentification, OICPSessionID } from './OICPIdentification';

import { OICPEvseID } from './OICPEvse';
import { OICPProductID } from './OICPPricing';
import { OICPProviderID } from './OICPAuthentication';

//
// eRoamingAuthorizeRemoteReservationStart_V1.1
// NOTE: This operation is used by EMPs in order to remotely reserve a charging point.
//
export interface OICPAuthorizeRemoteReservationStartCpoReceive {
  SessionID?: OICPSessionID, // The Hubject SessionID that identifies the process
  CPOPartnerSessionID?: string, // Optional field containing the session id assigned by the CPO to the related operation. Partner systems can use this field to link their own session handling to HBS processes. Field Length = 250
  EMPPartnerSessionID?: string, // Optional field containing the session id assigned by an EMP to the related operation. Partner systems can use this field to link their own session handling to HBS processes. Field Length = 250
  ProviderID: OICPProviderID, // The ProviderID is defined by Hubject and is used to identify the EMP.
  EvseID: OICPEvseID, // The ID that identifies the charging spot.
  Identification: OICPIdentification, // Authentication data used to authorize the user or car.
  PartnerProductID?: OICPProductID, // A pricing product name (for identifying a tariff) that must be unique
  Duration: number // Integer. Duration of reservation in minutes. Field Length = 2
}

//
// eRoamingAuthorizeRemoteReservationStop_V1.1
//
export interface OICPAuthorizeRemoteReservationStopCpoReceive {
  SessionID: OICPSessionID, // The Hubject SessionID that identifies the process
  CPOPartnerSessionID?: string, // Optional field containing the session id assigned by the CPO to the related operation. Partner systems can use this field to link their own session handling to HBS processes. Field Length = 250
  EMPPartnerSessionID?: string, // Optional field containing the session id assigned by an EMP to the related operation. Partner systems can use this field to link their own session handling to HBS processes. Field Length = 250
  ProviderID: OICPProviderID, // The ProviderID is defined by Hubject and is used to identify the EMP.
  EvseID: OICPEvseID, // The ID that identifies the charging spot.
}
