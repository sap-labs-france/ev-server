import { OICPAuthorizationStatus, OICPProviderID } from './OICPAuthentication';
import { OICPEvseID, OICPOperatorID } from './OICPEvse';
import { OICPIdentification, OICPSessionID } from './OICPIdentification';

import { OICPProductID } from './OICPPricing';
import { OICPStatus } from './OICPStatusCode';

//
// eRoamingAuthorizeStart_V2.1
//
export interface OICPAuthorizeStartCpoSend {
  SessionID?: OICPSessionID, // The Hubject SessionID that identifies the process
  CPOPartnerSessionID?: string, // Optional field containing the session id assigned by the CPO to the related operation. Partner systems can use this field to link their own session handling to HBS processes. Field Length = 250
  EMPPartnerSessionID?: string, // Optional field containing the session id assigned by an EMP to the related operation. Partner systems can use this field to link their own session handling to HBS processes. Field Length = 250
  OperatorID: OICPOperatorID, // The OperatorID is defined by Hubject and is used to identify the CPO.
  EvseID?: OICPEvseID, // The ID that identifies the charging spot.
  Identification: OICPIdentification, // Authentication data used to authorize the user or car.
  PartnerProductID?: OICPProductID // A pricing product name (for identifying a tariff) that must be unique
}

// Best Practices:
// - The EVSE ID is optional for this message which is e.g. defined after the RFID authorization at a charge point. If the Evse ID can be provided, we recommend to include the EVSE ID in this message; it will help for support matters.
// - If an authorization process could not successfully be executed, please set an error code by refering to the error code list mentioned in the OICP document.

export interface OICPAuthorizeStartCpoReceive { // NOTE: This message describes the response which has to be receive in response to the eRoamingAuthorizeStart.
  SessionID?: OICPSessionID, // The Hubject SessionID that identifies the process
  CPOPartnerSessionID?: string, // Optional field containing the session id assigned by the CPO to the related operation. Partner systems can use this field to link their own session handling to HBS processes. Field Length = 250
  EMPPartnerSessionID?: string, // Optional field containing the session id assigned by an EMP to the related operation. Partner systems can use this field to link their own session handling to HBS processes. Field Length = 250
  ProviderID?: OICPProviderID, // The ProviderID is defined by Hubject and is used to identify the EMP. In case of a positive authorization this field will be filled.
  AuthorizationStatus: OICPAuthorizationStatus, // Information specifying whether the user is authorized to charge or not.
  StatusCode: OICPStatus, // Structured status details. Can be used to specify the reason for a failed authorization
  AuthorizationStopIdentifications?: OICPIdentification[] // A list of Identification data that is authorized to stop the charging process.
}

//
// eRoamingAuthorizeStop_V2.1
//
export interface OICPAuthorizeStopCpoSend {
  SessionID: OICPSessionID, // The Hubject SessionID that identifies the process
  CPOPartnerSessionID?: string, // Optional field containing the session id assigned by the CPO to the related operation. Partner systems can use this field to link their own session handling to HBS processes. Field Length = 250
  EMPPartnerSessionID?: string, // Optional field containing the session id assigned by an EMP to the related operation. Partner systems can use this field to link their own session handling to HBS processes. Field Length = 250
  OperatorID: OICPOperatorID, // The OperatorID is defined by Hubject and is used to identify the CPO.
  EvseID?: OICPEvseID, // The ID that identifies the charging spot.
  Identification: OICPIdentification // Authentication data used to authorize the user or car.
}

export interface OICPAuthorizeStopCpoReceive { // NOTE: This message describes the response which has to be received in return to the eRoamingAuthorizeStop request.
  SessionID?: OICPSessionID, // The Hubject SessionID that identifies the process
  CPOPartnerSessionID?: string, // Optional field containing the session id assigned by the CPO to the related operation. Partner systems can use this field to link their own session handling to HBS processes. Field Length = 250
  EMPPartnerSessionID?: string, // Optional field containing the session id assigned by an EMP to the related operation. Partner systems can use this field to link their own session handling to HBS processes. Field Length = 250
  ProviderID?: OICPProviderID, // The ProviderID is defined by Hubject and is used to identify the EMP. In case of a positive authorization this field will be filled.
  AuthorizationStatus: OICPAuthorizationStatus, // Information specifying whether the user is authorized to charge or not.
  StatusCode: OICPStatus // Structured status details. Can be used to specify the reason for a failed authorization
}

//
// eRoamingAuthorizeRemoteStart_V2.1
// NOTE: This operation is used by EMPs in order to remotely start a charging process
//
export interface OICPAuthorizeRemoteStartCpoReceive {
  SessionID: OICPSessionID, // The Hubject SessionID that identifies the process
  CPOPartnerSessionID?: string, // Optional field containing the session id assigned by the CPO to the related operation. Partner systems can use this field to link their own session handling to HBS processes. Field Length = 250
  EMPPartnerSessionID?: string, // Optional field containing the session id assigned by an EMP to the related operation. Partner systems can use this field to link their own session handling to HBS processes. Field Length = 250
  ProviderID: OICPProviderID, // The ProviderID is defined by Hubject and is used to identify the EMP.
  EvseID: OICPEvseID, // The ID that identifies the charging spot.
  Identification: OICPIdentification, // Authentication data used to authorize the user or car.
  PartnerProductID?: OICPProductID // A pricing product name (for identifying a tariff) that must be unique
}
// Best Practices:
// - Please ensure a request run time of under 10 seconds including network roundtrip.

//
// eRoamingAuthorizeRemoteStop_V2.1
//
export interface OICPAuthorizeRemoteStopCpoReceive {
  SessionID: OICPSessionID, // The Hubject SessionID that identifies the process
  CPOPartnerSessionID?: string, // Optional field containing the session id assigned by the CPO to the related operation. Partner systems can use this field to link their own session handling to HBS processes. Field Length = 250
  EMPPartnerSessionID?: string, // Optional field containing the session id assigned by an EMP to the related operation. Partner systems can use this field to link their own session handling to HBS processes. Field Length = 250
  ProviderID: OICPProviderID, // The ProviderID is defined by Hubject and is used to identify the EMP.
  EvseID: OICPEvseID // The ID that identifies the charging spot.
}
