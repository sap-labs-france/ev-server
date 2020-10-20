import { OICPActionType } from './OICPEvseData';
import { OICPOperatorEvseStatus } from './OICPEvse';

//
// eRoamingPushEvseStatus_V2.1
// NOTE: The eRoamingPushEvseStatus operation MUST always be used sequentially as described in Data Push Operations
//
export interface OICPPushEvseStatusCpoSend {
  ActionType: OICPActionType, // Describes the action that has to be performed by Hubject with the provided data.
  OperatorEvseStatus: OICPOperatorEvseStatus // Indicates the Eves status
}

// Best Practices:
// Please try to avoid race conditions by sending multiple status simultaneously. Status should be sent one by one.
