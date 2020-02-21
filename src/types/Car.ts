import CreatedUpdatedProps from "./CreatedUpdatedProps";

/*eslint-disable*/
export interface Car extends CreatedUpdatedProps{
  _id?: string;
  vehicleID: number;
  vehicleMake: string;
  VehicleModel: string;
  vehicleModelVersion?: string;
  availabilityStatus: AvailabilityStatus;
  availabilityDateFrom: string;
  availabilityDateTo?: string;
  priceFromDE?: number;
  priceFromDEEstimate: boolean;
  priceFromNL?: number;
  priceFromNLEstimate: boolean;
  priceFromUK?: number;
  priceGrantPICGUK: number;
  priceFromUKEstimate: boolean;
  drivetrainType: string;
  drivetrainFuel: string;
  drivetrainPropulsion: string;
  drivetrainPower?: number;
  drivetrainPowerHP?: number;
  drivetrainTorque?: number;
  performanceAcceleration: number;
  performanceTopspeed: number;
  rangeWLTP?: number;
  rangeWLTPEstimate?: boolean;
  rangeNEDC?: number;
  rangeNEDCEstimate?: boolean;
  rangeReal: number;
  rangeRealMode?: string;
  rangeRealWHwy?: number;
  rangeRealWCmb?: number;
  rangeRealWCty?: number;
  rangeRealBHwy?: number;
  rangeRealBCmb?: number;
  rangeRealBCty?: number;
  efficiencyWLTP?: number;
  efficiencyWLTPFuelEq?: number;
  efficiencyWLTPV?: number;
  efficiencyWLTPFuelEqV?: number;
  efficiencyWLTPCO2?: number;
  efficiencyNEDC?: number;
  efficiencyNEDCFuelEq?: number;
  efficiencyNEDCV?: number;
  efficiencyNEDCFuelEqV?: number;
  efficiencyNEDCCO2?: number;
  efficiencyReal: number;
  efficiencyRealFuelEqV?: number;
  efficiencyRealCO2?: number;
  efficiencyRealWHwy?: number;
  efficiencyRealWCmb?: number;
  efficiencyRealWCty?: number;
  efficiencyRealBHwy?: number;
  efficiencyRealBCmb?: number;
  efficiencyRealBCty?: number;
  chargePlug?: ChargePlug;
  chargePlugEstimate?: boolean;
  chargePlugLocation?: string;
  chargeStandardPower: number;
  chargeStandardPhase: number;
  chargeStandardPhaseAmp: number;
  chargeStandardChargeTime: number;
  chargeStandardChargeSpeed: number;
  chargeStandardEstimate?: boolean;
  chargeStandardTables: { [id: string]: ChargeStandardTable; };
  chargeAlternativePower: number;
  chargeAlternativePhase: number;
  chargeAlternativePhaseAmp: number;
  chargeAlternativeChargeTime: number;
  chargeAlternativeChargeSpeed: number;
  chargeAlternativeTables: { [id: string]: ChargeAlternativeTable; };
  chargeOptionPower?: number;
  chargeOptionPhase?: number;
  chargeOptionPhaseAmp?: number;
  chargeOptionChargeTime?: number;
  chargeOptionChargeSpeed?: number;
  chargeOptionTables: { [id: string]: ChargeOptionTable; };
  fastchargePlug?: string;
  fastchargePlugEstimate?: boolean;
  fastchargePlugLocation?: string;
  fastchargePowerMax?: number;
  fastchargePowerAvg?: number;
  fastchargeChargeTime?: number;
  fastchargeChargeSpeed?: number;
  fastchargeOptional?: boolean;
  fastchargeEstimate?: boolean;
  batteryCapacityUseable: number;
  batteryCapacityFull: number;
  batteryCapacityEstimate: BatteryCapacityEstimate;
  dimsLength?: number;
  dimsWidth?: number;
  dimsHeight?: number;
  dimsWheelbase?: number;
  dimsWeight?: number;
  dimsBootspace?: number;
  dimsBootspaceMax?: number;
  dimsTowWeightUnbraked?: number;
  dimsTowWeightBraked?: number;
  dimsRoofLoadMax?: number;
  miscBody?: string;
  miscSegment?: string;
  miscSeats?: number;
  miscRoofrails?: boolean;
  miscIsofix?: boolean;
  miscIsofixSeats?: number;
  miscTurningCircle?: number;
  euroNCAPRating?: number;
  euroNCAPYear?: number;
  euroNCAPAdult?: number;
  euroNCAPChild?: number;
  euroNCAPVRU?: number;
  euroNCAPSA?: number;
  relatedVehicleIDSuccesor?: number;
  eVDBDetailURL?: string;
  images?: string[];
  videos?: string[];
  hash?: string;
}
export interface ChargeOptionTable {
  EVSEPhaseVolt?: number;
  EVSEPhaseAmp?: number;
  EVSEPhase?: number;
  ChargePhaseVolt?: number;
  ChargePhaseAmp?: number;
  ChargePhase?: number;
  ChargePower?: number;
  ChargeTime?: number;
  ChargeSpeed?: number;
}
export interface ChargeAlternativeTable {
  EVSEPhaseVolt: number;
  EVSEPhaseAmp: number;
  EVSEPhase: number;
  ChargePhaseVolt: number;
  ChargePhaseAmp: number;
  ChargePhase: number;
  ChargePower: number;
  ChargeTime: number;
  ChargeSpeed: number;
}
export interface ChargeStandardTable {
  EVSEPhaseVolt: number;
  EVSEPhaseAmp: number;
  EVSEPhase: number;
  ChargePhaseVolt: number;
  ChargePhaseAmp: number;
  ChargePhase: number;
  ChargePower: number;
  ChargeTime: number;
  ChargeSpeed: number;
}

export enum AvailabilityStatus {
  NO_LONGER_FOR_SALE = 0,
  AVAILABLE = 1,
  EXPECTED_IN_MARKET_ON_DATE_WITH_PRE_ORDER = 2,
  EXPECTED_IN_MARKET_ON_DATE_WITHOUT_PRE_ORDER = 3,
  CONCEPT_NEARING_PRODUCTION_CONFIRMED_WITH_PRE_ORDER = 12,
  CONCEPT_NEARING_PRODUCTION_CONFIRMED_WITHOUT_PRE_ORDER = 13,
  CONCEPT_NOT_CLOSE_TO_PRODUCTION_UNCONFIRMED_WITH_PRE_ORDER = 22,
  CONCEPT_NOT_CLOSE_TO_PRODUCTION_UNCONFIRMED_WITHOUT_PRE_ORDER = 23,
}

export enum ChargePlug {
  Type_ONE_CONNECTOR = 'Type 1',
  Type_TWO_CONNECTOR = 'Type 2',
}
export enum BatteryCapacityEstimate {
  BOTH_OF_THE_BATTERY_KWH__FIELDS_ARE_ESTIMATES = 'B',
  BATTERY_KWH_FULL_FIELD_IS_ESTIMATE = 'F',
  NONE_OF_THE_BATTERY_KWH__FIELDS_ARE_ESTIMATES = 'N',
  BATTERY_KWH_USEABLE_FIELD_IS_ESTIMATE = 'U',
}

export interface CarSynchronizeAction {
  synchronized: number;
  error: number;
}
