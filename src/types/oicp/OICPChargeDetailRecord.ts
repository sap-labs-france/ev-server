import { OICPCalibrationLawVerification, OICPEvseID, OICPOperatorID, OICPSignedMeteringValues } from './OICPEvse';
import { OICPIdentification, OICPSessionID } from './OICPIdentification';

import { OICPProductID } from './OICPPricing';
import { OICPProviderID } from './OICPAuthentication';

//
// eRoamingChargeDetailRecord_V2.2
// NOTE: The CPO MUST provide the same SessionID that was assigned to the corresponding charging process. Based on this information Hubject will be able to assign the session data to the correct process.
//

export interface OICPChargeDetailRecord {
  SessionID: OICPSessionID,
  CPOPartnerSessionID?: string, // Optional field containing the session id assigned by the CPO to the related operation. Partner systems can use this field to link their own session handling to HBS processes. Field Length = 250
  EMPPartnerSessionID?: string, // Optional field containing the session id assigned by an EMP to the related operation. Partner systems can use this field to link their own session handling to HBS processes. Field Length = 250
  PartnerProductID?: OICPProductID, // A pricing product name (for identifying a tariff) that must be unique
  EvseID: OICPEvseID, // The ID that identifies the charging spot.
  Identification: OICPIdentification, // Authentication data used to authorize the user or car.
  ChargingStart: Date, // The date and time at which the charging process started.
  ChargingEnd: Date, // The date and time at which the charging process stopped.
  SessionStart: Date, // The date and time at which the session started, e.g. swipe of RFID or cable connected.
  SessionEnd: Date, // The date and time at which the session ended, e.g. swipe of RFID or cable disconnected.
  MeterValueStart?: number, // Decimal (,3). The starting meter value in kWh.
  MeterValueEnd?: number, // Decimal (,3). The ending meter value in kWh.
  MeterValueInBetween?: OICPMeterValueInBetween, // List (MeterValue (Decimal (,3))). List of meter values that may have been taken in between (kWh).
  ConsumedEnergy: number, // Decimal (,3). The difference between MeterValueEnd and MeterValueStart in kWh.
  SignedMeteringValues?: OICPSignedMeteringValues[], // Metering Signature basically contains all metering signature values (these values should be in Transparency software format) for different status of charging session for eg start, end or progress. In total you can provide maximum 10 metering signature values
  CalibrationLawVerificationInfo?: OICPCalibrationLawVerification, // This field provides additional information which could help directly or indirectly to verify the signed metering value by using respective Transparency Software
  HubOperatorID?: OICPOperatorID, // Hub operator
  HubProviderID?: OICPProviderID // Hub provider
}

export interface OICPMeterValueInBetween {
  meterValues?: number[], // List (MeterValue (Decimal (,3))). List of meter values that may have been taken in between (kWh).
}
