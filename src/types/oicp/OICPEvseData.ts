import { OICPOperatorEvseData } from './OICPEvse';

//
// eRoamingPushEvseData_V2.3
// NOTE: The eRoamingPushEvseData operation MUST always be used sequentially as described in Data Push Operations.
//
export interface OICPPushEvseDataCpoSend {
  ActionType: OICPActionType, // Describes the action that has to be performed by Hubject with the provided data.
  OperatorEvseData: OICPOperatorEvseData
}

export enum OICPActionType {
  FULL_LOAD = 'fullLoad',
  UPDATE = 'update',
  INSERT = 'insert',
  DELETE = 'delete',
}
