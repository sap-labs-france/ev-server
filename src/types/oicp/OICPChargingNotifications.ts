import { OICPChargingNotification, OICPErrorClass } from './OICPStatusCode';
import { OICPEvseID, OICPOperatorID } from './OICPEvse';
import { OICPIdentification, OICPSessionID } from './OICPIdentification';

import { OICPMeterValueInBetween } from './OICPChargeDetailRecord';
import { OICPProductID } from './OICPPricing';

//
// eRoamingChargingNotifications Start
//
export interface OICPChargingNotificationStartCpoSend {
  Type: OICPChargingNotification, // The type of ChargingNotification. For this case only the notification type “Start” can be chosen.
  SessionID: OICPSessionID, // The Hubject SessionID that identifies the process.
  CPOPartnerSessionID?: string, // Optional field containing the session ID assigned by the CPO to the related operation. Partner systems can use this field to link their own session handling to HBS processes. Field Length = 250
  EMPPartnerSessionID?: string, // Optional field containing the session ID assigned by an EMP to the related operation. Partner systems can use this field to link their own session handling to HBS processes. Field Length = 250
  Identification?: OICPIdentification, // Authentication data
  EvseID: OICPEvseID, // The ID that identifies the charging spot.
  ChargingStart: Date, // The date and time at which the charging process started.
  SessionStart?: Date, // The date and time at which the session started, e.g. swipe of RFID or cable connected.
  MeterValueStart?: number, // Decimal (,3). The starting meter value in kWh.
  OperatorID?: OICPOperatorID, // The OperatorID is used to identify the CPO.
  PartnerProductID?: OICPProductID // A pricing product name (for identifying a tariff) that must be unique
}

//
// eRoamingChargingNotifications Progress
//
export interface OICPChargingNotificationProgressCpoSend {
  Type: OICPChargingNotification, // The type of ChargingNotification. For this case only the notification type “Progress” can be chosen.
  SessionID: OICPSessionID, // The Hubject SessionID that identifies the process.
  CPOPartnerSessionID?: string, // Optional field containing the session ID assigned by the CPO to the related operation. Partner systems can use this field to link their own session handling to HBS processes. Field Length = 250
  EMPPartnerSessionID?: string, // Optional field containing the session ID assigned by an EMP to the related operation. Partner systems can use this field to link their own session handling to HBS processes. Field Length = 250
  Identification?: OICPIdentification, // Authentication data
  EvseID: OICPEvseID, // The ID that identifies the charging spot.
  ChargingStart: Date, // The date and time at which the charging process started.
  EventOccurred: Date, // The date and time at which the charging progress parameters are captured.
  ChargingDuration?: number, // Integer. Charging Duration = EventOccurred - Charging Duration. It is a time in millisecond. Either ChargingDuration or ConsumedEnergyProgress should be provided. Both can also be provided with each progress notification.
  SessionStart?: Date, // The date and time at which the session started, e.g. swipe of RFID or cable connected.
  ConsumedEnergyProgress?: number, // Decimal (,3). This is consumed energy when from Start of charging process till the charging progress notification generated (EventOccurred). Either ChargingDuration or ConsumedEnergyProgress should be provided. Both can also be provided with each progress notification.
  MeterValueStart?: number, // Decimal (,3). The starting meter value in kWh.
  OperatorID?: OICPOperatorID, // The OperatorID is used to identify the CPO.
  PartnerProductID?: OICPProductID // A pricing product name (for identifying a tariff) that must be unique
}

//
// eRoamingChargingNotifications End
//
export interface OICPChargingNotificationEndCpoSend {
  Type: OICPChargingNotification, // The type of ChargingNotification. For this case only the notification type “End” can be chosen.
  SessionID: OICPSessionID, // The Hubject SessionID that identifies the process.
  CPOPartnerSessionID?: string, // Optional field containing the session ID assigned by the CPO to the related operation. Partner systems can use this field to link their own session handling to HBS processes. Field Length = 250
  EMPPartnerSessionID?: string, // Optional field containing the session ID assigned by an EMP to the related operation. Partner systems can use this field to link their own session handling to HBS processes. Field Length = 250
  Identification?: OICPIdentification, // Authentication data
  EvseID: OICPEvseID, // The ID that identifies the charging spot.
  ChargingStart?: Date, // The date and time at which the charging process started.
  ChargingEnd: Date, // The date and time at which the charging process stopped.
  SessionStart?: Date, // The date and time at which the session started, e.g. swipe of RFID or cable connected.
  SessionEnd?: Date, // The date and time at which the session ended, e.g. swipe of RFID or cable disconnected.
  ConsumedEnergy?: number, // Decimal (,3). The difference between MeterValueEnd and MeterValueStart in kWh.
  MeterValueStart?: number, // Decimal (,3). The starting meter value in kWh.
  MeterValueEnd?: number, // Decimal (,3). The ending meter value in kWh.
  MeterValueInBetween?: OICPMeterValueInBetween, // List (MeterValue (Decimal (,3))). List of meter values that may have been taken in between (kWh).
  OperatorID?: OICPOperatorID, // The OperatorID is used to identify the CPO.
  PartnerProductID?: OICPProductID, // A pricing product name (for identifying a tariff) that must be unique
  PenaltyTimeStart?: Date // The date and time at which the penalty time start after the grace period.
}

//
// eRoamingChargingNotifications Error
//
export interface OICPChargingNotificationErrorCpoSend {
  Type: OICPChargingNotification, // The type of ChargingNotification. For this case only the notification type “Error” can be chosen.
  SessionID: OICPSessionID, // The Hubject SessionID that identifies the process.
  CPOPartnerSessionID?: string, // Optional field containing the session ID assigned by the CPO to the related operation. Partner systems can use this field to link their own session handling to HBS processes. Field Length = 250
  EMPPartnerSessionID?: string, // Optional field containing the session ID assigned by an EMP to the related operation. Partner systems can use this field to link their own session handling to HBS processes. Field Length = 250
  Identification?: OICPIdentification, // Authentication data
  EvseID: OICPEvseID, // The ID that identifies the charging spot.
  ErrorType: OICPErrorClass, // The error code can be chosen from the list
  ErrorAdditionalInfo?: string // The CPO can put in the additional information about the error. Field Length = 250
}

