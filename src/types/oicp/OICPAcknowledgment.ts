import { OICPSessionID } from './OICPIdentification';
import { OICPStatus } from './OICPStatusCode';

//
// eRoamingAcknowledgment
// To SEND and RECEIVE
//
export interface OICPAcknowledgment {
  Result: boolean, // If result is true, the message was received and the respective operation was performed successfully. If result is false, the message was received and the respective operation was not performed successfully.
  StatusCode: OICPStatus, // Structured status details. This can be used e.g. for failure messages or further information regarding the result.
  SessionID?: OICPSessionID, // Represents the service process. In some cases the current SessionID is returned to the service requestor in this field
  CPOPartnerSessionID?: string, // Optional field containing the session id assigned by the CPO to the related operation. Field Length = 250
  EMPPartnerSessionID?: string // Optional field containing the session id assigned by an EMP to the related operation. Field Length = 250
}
