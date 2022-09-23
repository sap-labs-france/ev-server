import { AuthorizationActions } from './Authorization';
import CreatedUpdatedProps from './CreatedUpdatedProps';

export interface CarCatalog extends CreatedUpdatedProps, AuthorizationActions {
  id: number;
  vehicleMake: string;
  vehicleModel: string;
  vehicleModelVersion?: string;
  priceFromDE?: number;
  drivetrainPropulsion: string;
  drivetrainPowerHP?: number;
  drivetrainTorque?: number;
  performanceAcceleration: number;
  performanceTopspeed: number;
  rangeWLTP?: number;
  rangeWLTPEstimate?: boolean;
  rangeWLTPTEH?: number;
  rangeNEDC?: number;
  rangeNEDCEstimate?: boolean;
  rangeReal: number;
  efficiencyReal: number;
  chargePlug2Location?: string;
  chargePlug2OptionalDE?: boolean;
  chargePlug2OptionalNL?: boolean;
  chargePlug2OptionalUK?: boolean;
  chargeStandardChargeSpeedDE?: number;
  chargeStandardChargeTimeDE?: number;
  chargeStandardChargeTimeNL?: number;
  chargeStandardChargeSpeedNL?: number;
  chargeStandarChargeTimeUK?: number;
  chargeStandardChargeSpeedUK?: number;
  chargePlug?: string;
  chargePlugLocation?: string;
  chargeStandardPower: number;
  chargeStandardPhase: number;
  chargeStandardPhaseAmp: number;
  chargeStandardChargeTime: number;
  chargeStandardChargeSpeed: number;
  fastChargePlug?: string;
  fastChargePowerMax?: number;
  batteryCapacityUseable: number;
  batteryCapacityFull: number;
  miscBody?: string;
  miscSegment?: string;
  miscSeats?: number;
  miscIsofix?: boolean;
  miscIsofixSeats?: number;
  miscTurningCircle?: number;
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

export interface CarConnectorData {
  carConnectorID?: string;
  carConnectorMeterID?: string;
}
