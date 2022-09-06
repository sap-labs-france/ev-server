import { AuthorizationActions } from './Authorization';
import CreatedUpdatedProps from './CreatedUpdatedProps';

export interface CarCatalog extends CreatedUpdatedProps, AuthorizationActions {
  id: number;
  vehicleMake: string;
  vehicleModel: string;
  vehicleModelVersion?: string;
  availabilityStatus?: number;
  availabilityDateFrom: Date;
  availabilityDateTo?: Date;
  priceFromDE?: number;
  priceFromDEEstimate: boolean;
  priceGrantUmweltbonusDE?: number;
  priceFromNL?: number;
  priceFromNLFiscal?: number;
  priceGrantSEPPNL?: number;
  priceFromNLEstimate: boolean;
  priceFromUK?: number;
  priceGrantPICGUK: number;
  priceFromUKEstimate: boolean;
  priceFromUKP11D?: number;
  drivetrainType: string;
  drivetrainFuel: string;
  drivetrainPropulsion: string;
  drivetrainPropulsionEstimate?: boolean;
  efficiencyWLTPTEH?: number;
  drivetrainPower?: number;
  drivetrainPowerHP?: number;
  drivetrainPowerEstimate?: boolean;
  drivetrainTorque?: number;
  drivetrainTorqueEstimate?: boolean;
  performanceAcceleration: number;
  performanceAccelerationEstimate?: boolean;
  performanceTopspeed: number;
  performanceTopspeedEstimate?: boolean;
  rangeWLTP?: number;
  rangeWLTPEstimate?: boolean;
  rangeWLTPTEH?: number;
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
  efficiencyEconomyWLTP?: number;
  efficiencyConsumptionWLTP?: number;
  efficiencyEconomyWLTPV?: number;
  efficiencyConsumptionWLTPV?: number;
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
  efficiencyEconomyWLTPTEH?: number;
  efficiencyConsumptionWLTPTEH?: number;
  efficiencyWLTPTEHFuelEq?: number;
  efficiencyWLTPTEHV?: number;
  efficiencyEconomyWLTPTEHV?: number;
  efficiencyConsumptionWLTPTEHV?: number;
  efficiencyWLTPTEHFuelEqV?: number;
  efficiencyWLTPTEHCO2?: number;
  efficiencyEconomyNEDC?: number;
  efficiencyConsumptionNEDC?: number;
  efficiencyEconomyNEDCV?: number;
  efficiencyConsumptionNEDCV?: number;
  efficiencyEconomyReal?: number;
  efficiencyConsumptionReal?: number;
  efficiencyEconomyRealWHwy?: number;
  efficiencyEconomyRealWCmb?: number;
  efficiencyRealCO2?: number;
  efficiencyEconomyRealWCty?: number;
  efficiencyEconomyRealBHwy?: number;
  efficiencyEconomyRealBCmb?: number;
  efficiencyEconomyRealBCty?: number;
  efficiencyConsumptionRealWCmb?: number;
  efficiencyConsumptionReal_WCty?: number;
  efficiencyConsumptionRealBHwy?: number;
  efficiencyConsumptionRealBCmb?: number;
  efficiencyConsumptionRealBCty?: number;
  efficiencyConsumptionRealWHwy?: number;
  chargePlug2Location?: string;
  chargePlug2OptionalDE?: boolean;
  chargePlug2OptionalNL?: boolean;
  chargePlug2OptionalUK?: boolean;
  chargeStandardPowerDE?: number;
  chargeStandardPhaseDE?: number;
  chargeStandardPhaseAmpDE?: number;
  chargeStandardChargeSpeedDE?: number;
  chargeStandardChargeTimeDE?: number;
  chargeStandardPowerNL?: number;
  chargeStandardChargeTimeNL?: number;
  chargeStandardChargeSpeedNL?: number;
  chargeStandardPowerUK?: number;
  chargeStandardPhaseUK?: number;
  chargeStandardPhaseAmpUK?: number;
  chargeStandarChargeTimeUK?: number;
  chargeStandardChargeSpeedUK?: number;
  chargeOptionPowerDE?: number;
  chargeOptionPhaseDE?: number;
  chargeOptionPhaseAmpDE?: number;
  chargeOptionChargeTimeDE?: number;
  chargeOptionChargeSpeedDE?: number;
  chargeOptionPowerNL?: number;
  chargeOptionPhaseAmpNL?: number;
  chargeOptionPhaseNL?: number;
  chargeOptionChargeTimeNL?: number;
  chargeOptionChargeSpeedNL?: number;
  chargeOptionPowerUK?: number;
  chargeOptionPhaseUK?: number;
  chargeOptionPhaseAmpUK?: number;
  chargeOptionChargeTimeUK?: number;
  chargeOptionChargeSpeedUK?: number;
  efficiencyRealWHwy?: number;
  efficiencyRealWCmb?: number;
  efficiencyRealWCty?: number;
  efficiencyRealBHwy?: number;
  efficiencyRealBCmb?: number;
  efficiencyRealBCty?: number;
  chargePlug?: string;
  chargePlugEstimate?: boolean;
  chargePlugLocation?: string;
  chargeStandardPower: number;
  chargeStandardPhase: number;
  chargeStandardPhaseAmp: number;
  chargeStandardChargeTime: number;
  chargeStandardChargeSpeed: number;
  chargeStandardEstimate?: boolean;
  chargeStandardTables: CarCatalogConverter[];
  chargeAlternativePower: number;
  chargeAlternativePhase: number;
  chargeAlternativePhaseAmp: number;
  chargeAlternativeChargeTime: number;
  chargeAlternativeChargeSpeed: number;
  chargeOptionPower?: number;
  chargeOptionPhase?: number;
  chargeOptionPhaseAmp?: number;
  chargeOptionChargeTime?: number;
  chargeOptionChargeSpeed?: number;
  chargeOptionTables: CarCatalogConverter[];
  fastChargePlug?: string;
  fastChargePlugEstimate?: boolean;
  fastChargePlugLocation?: string;
  fastChargePowerMax?: number;
  fastChargePowerAvg?: number;
  fastChargeTime?: number;
  fastChargeSpeed?: number;
  fastChargeOptional?: boolean;
  fastChargeEstimate?: boolean;
  fastChargeTables: CarCatalogFastCharge[];
  batteryCapacityUseable: number;
  batteryCapacityFull: number;
  batteryCapacityEstimate: string;
  batteryTMS?: string;
  batteryChemistry?: string;
  batteryManufacturer?: string;
  batteryCells?: string;
  batteryModules?: number;
  batteryWeight?: number;
  BatteryWarrantyPeriod?: number;
  batteryWarrantyMileage?: number;
  dimsLength?: number;
  dimsWidth?: number;
  dimsWidthMirrors?: number;
  dimsHeight?: number;
  dimsLWHEstimate?: boolean;
  dimsWheelbaseEstimate?: boolean;
  dimsWheelbase?: number;
  dimsWeight?: number;
  dimsWeightEstimate?: boolean;
  dimsTowWeightVerticalLoad?: number;
  dimsTowWeightEstimate?: boolean;
  dimsBootspaceFrunk?: number;
  dimsTowHitch?: boolean;
  dimsWeightMaxPayload?: number;
  dimsWeightGVWR?: number;
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
  miscVehiclePlatform?: string;
  miscVehiclePlatformDedicated?: boolean;
  miscOEMLinkoutURLDE?: string;
  miscOEMLinkoutURLNL?: string;
  miscOEMLinkoutURLUK?: string;
  BIKNLYear?: string;
  BIKNLRate?: string;
  BIKNLCap?: number;
  BIKNLNetLow?: number;
  BIKNLNetHigh?: number;
  BIKUKYear?: string;
  BIKUKRate?: number;
  BIKUKAmount?: number;
  BIKUKNetLow?: number;
  BIKUKNetMid?: number;
  BIKUKNetHigh?: number;
  euroNCAPRating?: number;
  euroNCAPYear?: number;
  euroNCAPAdult?: number;
  euroNCAPChild?: number;
  euroNCAPVRU?: number;
  euroNCAPSA?: number;
  relatedVehicleIDSuccessor?: number;
  eVDBDetailURL?: string;
  imageURLs?: string[];
  images?: string[];
  image?: string;
  videos?: string[];
  hash?: string;
  imagesHash?: string;
}

export enum CarType {
  PRIVATE = 'P',
  COMPANY = 'C',
  POOL_CAR = 'PC',
}

export interface Car extends CreatedUpdatedProps, AuthorizationActions {
  id?: string;
  vin: string;
  licensePlate: string;
  carCatalogID: number;
  carCatalog?: CarCatalog;
  userID: string;
  default: boolean;
  type?: CarType;
  converter?: CarConverter;
  carConnectorData?: CarConnectorData;
}

export interface CarConverter {
  powerWatts: number;
  amperagePerPhase: number;
  numberOfPhases: number;
  type: CarConverterType;
}

export enum CarConverterType {
  STANDARD = 'S',
  OPTION = 'O',
  ALTERNATIVE = 'A',
}
export interface CarMaker {
  carMaker: string;
}

export interface CarCatalogConverter {
  type: string;
  evsePhaseVolt: number;
  evsePhaseVoltCalculated?: number;
  evsePhaseAmp: number;
  evsePhase: number;
  evsePower: number;
  chargePhaseVolt: number;
  chargePhaseAmp: number;
  chargePhase: number;
  chargePower: number;
  chargeTime: number;
  chargeSpeed: number;
}

export interface CarCatalogFastCharge {
  type: string;
  fastChargePowerMax: number;
  fastChargePowerAvg?: number;
  fastChargeChargeTime: number;
  fastChargeChargeSpeed: number;
  fastChargeLimited: boolean;
  fastChargeAvgLimited: boolean;
}

export interface CarConnectorData {
  carConnectorID?: string;
  carConnectorMeterID?: string;
}
